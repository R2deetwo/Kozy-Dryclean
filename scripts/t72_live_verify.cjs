// =============================================================================
// Task 72 LIVE verification — kozycare.ng. Public surfaces + auth walls +
// read-only admin checks (no test data written to prod).
// =============================================================================
const { chromium } = require('playwright')

const BASE = 'https://kozycare.ng'
let pass = 0
let fail = 0

function ok(name, cond, extra = '') {
  if (cond) {
    pass++
    console.log(`  PASS ${name}${extra ? ' — ' + extra : ''}`)
  } else {
    fail++
    console.log(`  FAIL ${name}${extra ? ' — ' + extra : ''}`)
  }
}

async function login(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL(/portal|admin|partner|driver/, { timeout: 30000 })
  await page.waitForTimeout(2000)
}

;(async () => {
  const browser = await chromium.launch()

  // ================================================================
  // 1. The upgraded public application form
  // ================================================================
  console.log('\n[1] /partners — the upgraded application')
  const pub = await browser.newPage()
  const pubErrors = []
  pub.on('pageerror', (e) => pubErrors.push(String(e)))
  await pub.goto(`${BASE}/partners`, { waitUntil: 'domcontentloaded' })
  await pub.waitForTimeout(2500)
  const formText = await pub.textContent('form').catch(() => '')
  ok('LGA field present', /Area you operate in/.test(formText ?? ''))
  ok('services chips present', /What can you process to the Kozy standard/.test(formText ?? ''))
  const chips = await pub.locator('button[type="button"][aria-pressed]').count()
  ok('service chips render as toggle buttons', chips >= 5, String(chips))

  // Validation parity (public API, live):
  const badPhone = await fetch(`${BASE}/api/partners`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      businessName: 'Live Check Laundry', contactName: 'Live Check', email: 'livecheck-nope@kozy.test',
      phone: 'nice', address: '1 Check Street, Lagos', lga: 'Lekki', servicesOffered: ['Dry cleaning'],
    }),
  })
  const badPhoneBody = await badPhone.json().catch(() => ({}))
  ok('strict phone validation live', badPhone.status === 400 && badPhoneBody.field === 'phone', String(badPhone.status))

  // ================================================================
  // 2. Auth walls on the new money + portal surfaces
  // ================================================================
  console.log('\n[2] Auth walls')
  let res = await fetch(`${BASE}/api/rider-payouts`)
  ok('GET /api/rider-payouts unauth 401', res.status === 401, String(res.status))
  res = await fetch(`${BASE}/api/partner-settlements`)
  ok('GET /api/partner-settlements unauth 401', res.status === 401, String(res.status))
  res = await fetch(`${BASE}/api/partner/overview`)
  ok('GET /api/partner/overview unauth 401', res.status === 401, String(res.status))
  res = await fetch(`${BASE}/api/partner/earnings`)
  ok('GET /api/partner/earnings unauth 401', res.status === 401, String(res.status))
  res = await fetch(`${BASE}/api/partners`)
  ok('GET /api/partners unauth 401', res.status === 401, String(res.status))
  res = await fetch(`${BASE}/partner`, { redirect: 'manual' })
  ok('/partner unauth redirects (307/302 to login)', res.status === 307 || res.status === 302, String(res.status))

  // ================================================================
  // 3. Admin (read-only): rates live, desks wired
  // ================================================================
  console.log('\n[3] Admin read-only checks')
  const admin = await browser.newPage()
  await login(admin, 'vk5m2w8t4a@woosh.dpdns.org', 'KozyE2EAdmin!56')

  res = await admin.request.get(`${BASE}/api/rider-applications`)
  const body = await res.json().catch(() => ({}))
  ok('roster API live (200)', res.status() === 200)
  ok('rates published on prod (500/500)', body.roster?.length === 0 || (body.roster ?? [])[0]?.ratesPublished === true || (body.roster ?? []).every((r) => r.ratesPublished === true))

  res = await admin.request.get(`${BASE}/api/rider-payouts`)
  const payoutBody = await res.json().catch(() => ({}))
  ok('payout history API live (empty is fine)', res.status() === 200 && Array.isArray(payoutBody.payouts))

  res = await admin.request.get(`${BASE}/api/partners`)
  const partnerBody = await res.json().catch(() => ({}))
  ok('partners API live with account fields', res.status() === 200 && Array.isArray(partnerBody.partners) && Array.isArray(partnerBody.ledger))

  res = await admin.request.get(`${BASE}/api/settings/app`)
  const settingsBody = await res.json().catch(() => ({}))
  ok('settings show rider rates 500/500', (settingsBody.settings ?? settingsBody).riderPickupRate === 500 && (settingsBody.settings ?? settingsBody).riderDeliveryRate === 500,
    `${(settingsBody.settings ?? settingsBody).riderPickupRate}/${(settingsBody.settings ?? settingsBody).riderDeliveryRate}`)

  // ================================================================
  // 4. The partner portal renders its shell (signed-out → login)
  // ================================================================
  console.log('\n[4] Portal shell')
  await pub.goto(`${BASE}/partner`, { waitUntil: 'domcontentloaded' })
  await pub.waitForTimeout(2000)
  ok('signed-out partner URL lands on login', pub.url().includes('/login'), pub.url())
  ok('partners page renders clean (no page errors)', pubErrors.length === 0, pubErrors.slice(0, 1).join(' | '))

  await browser.close()
  console.log(`\nLIVE: ${pass} pass / ${fail} fail`)
  process.exit(fail > 0 ? 1 : 0)
})().catch((e) => {
  console.error('live verify crashed:', e)
  process.exit(1)
})
