// Phase 55 — unit proof that EMAIL_OVERRIDE_TO emails carry PRODUCTION links.
//
// The bug: test emails sent from the dev server resolved baseUrl() from
// NEXTAUTH_URL=http://localhost:3000, so the owner's "Open the rider app"
// button opened a blank localhost screen on his phone. The fix makes
// baseUrl() return the production URL whenever the override valve is open.
//
// This script intercepts global fetch (no real email is sent), calls
// notifyRiderApproved with the override active + a localhost NEXTAUTH_URL —
// exactly the dev-server condition — and asserts the email body links to
// https://kozycare.ng.
//
// Run: EMAIL_OVERRIDE_TO=practiceprosystems@gmail.com NEXTAUTH_URL=http://localhost:3000 \
//      npx tsx scripts/p55_email_link_check.ts

process.env.BREVO_API_KEY = process.env.BREVO_API_KEY || 'dummy-key-for-intercept'
process.env.EMAIL_OVERRIDE_TO = process.env.EMAIL_OVERRIDE_TO || 'practiceprosystems@gmail.com'
// Dev-server condition: localhost origin.
process.env.NEXTAUTH_URL = 'http://localhost:3000'
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54329/kozy'
process.env.DIRECT_URL = process.env.DATABASE_URL

let pass = 0, fail = 0
const log = (name: string, ok: boolean, extra?: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? `  (${extra})` : ''}`)
  ok ? pass++ : fail++
}

async function main() {
  const captured: { to: string; subject: string; html: string }[] = []
  const realFetch = global.fetch
  global.fetch = (async (url: any, init: any = {}) => {
    if (String(url).includes('api.brevo.com')) {
      const body = JSON.parse(init.body)
      captured.push({ to: body.to[0].email, subject: body.subject, html: body.htmlContent })
      return new Response(JSON.stringify({ messageId: 'intercepted' }), { status: 200 })
    }
    return realFetch(url, init)
  }) as any

  const { notifyRiderApproved } = await import('../src/lib/notifications')

  const res = await notifyRiderApproved({
    to: 'rider@example.com',
    name: 'Test Rider',
    password: 'Rider!Pass55',
    managerName: 'The Owner',
    refCode: 'KZR-TEST',
    lga: 'Lekki',
    note: 'Welcome aboard — link check.',
  })

  global.fetch = realFetch

  log('welcome email send reported ok', res.ok === true)
  log('exactly one send intercepted', captured.length === 1, `sends: ${captured.length}`)

  const html = captured[0]?.html ?? ''
  log(
    'email redirects to the override inbox',
    captured[0]?.to === process.env.EMAIL_OVERRIDE_TO,
    captured[0]?.to
  )
  log(
    'CTA link points at PRODUCTION (https://kozycare.ng/login), not localhost',
    html.includes('https://kozycare.ng/login?email=') && !html.includes('localhost'),
    html.match(/https:\/\/kozycare\.ng[^"']*/) ?.[0] ?? 'no link found'
  )
  log(
    'email pre-fills the rider email in the login link',
    html.includes(encodeURIComponent('rider@example.com')),
  )

  console.log(`\n${pass}/${pass + fail} PASS`)
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('FATAL', e)
  process.exit(1)
})
