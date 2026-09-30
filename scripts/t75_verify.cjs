// =============================================================================
// Task 75 verification — the subscription tracking system end to end.
// Runs against localhost:3000 (server started by t75_run_verify.sh).
//   [1] Member API: usage + activity ledger + missed flag
//   [2] Real booking → counter 3→4 + UNIT ledger row
//   [3] Cancel → allowance refund → back to 3 + idempotent re-cancel
//   [4] Admin roster: health radar, last/next pickup, kitTag
//   [5] Adjust-usage + renewal → USAGE_ADJUST + CYCLE_START ledger rows
//   [6] Kit tag: mint + QR, privacy ladder (public / rider / office), 404
//   [7] Kit scan page: public brand card vs admin identification
//   [8] Member portal UI: "Your pickups this month"
//   [9] Admin UI: stat cards, health chips, drill-down, label preview
//  [10] robots.txt /kit + noindex
// =============================================================================
const { chromium } = require('playwright')

const BASE = 'http://localhost:3000'
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
  await page.waitForURL(/portal|admin|partner|driver/, { timeout: 20000 })
  await page.waitForTimeout(1200)
}

;(async () => {
  const browser = await chromium.launch()

  // ================================================================
  // [1] Member API — usage, activity, missed
  // ================================================================
  console.log('\n[1] Member API')
  const memberPage = await browser.newPage()
  await login(memberPage, 't75member@kozy.test', 'T75Member!2026')
  let res = await memberPage.request.get(`${BASE}/api/subscriptions/me`)
  let body = await res.json().catch(() => ({}))
  ok('me 200 with membership', res.status() === 200 && body.membership?.status === 'ACTIVE')
  ok('usage counters seeded (3/4 units, 1 duvet)', body.usage?.unitsUsed === 3 && body.usage?.duvetsUsed === 1)
  const activity = body.activity?.activity ?? []
  ok('activity has 4 bookings', activity.length === 4, `got ${activity.length}`)
  ok('activity includes the missed pickup', activity.some((a) => a.missed && a.orderNumber === 'KZ-750003'))
  ok('activity labels the duvet perk', activity.some((a) => a.label.toLowerCase().includes('duvet')))
  ok('ledger events exposed', (body.activity?.events ?? []).length >= 6)
  const subId = body.membership?.id

  // ================================================================
  // [2] A real booking → counter + ledger
  // ================================================================
  console.log('\n[2] Booking through the API')
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  res = await memberPage.request.post(`${BASE}/api/subscriptions/pickup`, {
    data: {
      kind: 'unit',
      count: 1,
      pickupAddress: '12 Admiralty Way, Lekki Phase 1, Lagos',
      pickupDate: tomorrow,
      pickupTimeSlot: '09:00 - 10:00',
    },
  })
  const booked = await res.json().catch(() => ({}))
  ok('pickup booked 201', res.status() === 201, `status ${res.status()}`)
  const bookedOrderId = booked.order?.id
  res = await memberPage.request.get(`${BASE}/api/subscriptions/me`)
  body = await res.json().catch(() => ({}))
  ok('counter 3→4 after booking', body.usage?.unitsUsed === 4, `got ${body.usage?.unitsUsed}`)
  ok('new booking in activity', (body.activity?.activity ?? []).some((a) => a.id === bookedOrderId))

  // ================================================================
  // [3] Cancel → refund → idempotency
  // ================================================================
  console.log('\n[3] Cancel + refund')
  const admin = await browser.newPage()
  await login(admin, 't75admin@kozy.test', 'T75Admin!2026')
  res = await admin.request.patch(`${BASE}/api/orders/${bookedOrderId}`, { data: { status: 'CANCELLED' } })
  ok('admin cancels the order', res.status() === 200, `status ${res.status()}`)
  res = await memberPage.request.get(`${BASE}/api/subscriptions/me`)
  body = await res.json().catch(() => ({}))
  ok('allowance refunded 4→3', body.usage?.unitsUsed === 3, `got ${body.usage?.unitsUsed}`)
  const cancelledRow = (body.activity?.activity ?? []).find((a) => a.id === bookedOrderId)
  ok('cancelled booking shows in activity as CANCELLED', cancelledRow?.status === 'CANCELLED')
  ok('refund row in ledger', (body.activity?.events ?? []).some((e) => e.kind === 'UNIT_REFUND' && e.orderId === bookedOrderId))
  // Idempotent: a second CANCELLED move must NOT refund again
  res = await admin.request.patch(`${BASE}/api/orders/${bookedOrderId}`, { data: { status: 'CANCELLED' } })
  res = await memberPage.request.get(`${BASE}/api/subscriptions/me`)
  body = await res.json().catch(() => ({}))
  ok('re-cancel is idempotent (stays 3)', body.usage?.unitsUsed === 3, `got ${body.usage?.unitsUsed}`)

  // ================================================================
  // [4] Admin roster — the retention radar
  // ================================================================
  console.log('\n[4] Admin roster health')
  res = await admin.request.get(`${BASE}/api/subscriptions`)
  const roster = await res.json().catch(() => ({}))
  const items = roster.items ?? []
  const memberRow = items.find((i) => i.user?.email === 't75member@kozy.test')
  const quietRow = items.find((i) => i.user?.email === 't75quiet@kozy.test')
  ok('roster loads with both members', res.status() === 200 && Boolean(memberRow && quietRow))
  ok('busy member flagged MISSED_PICKUP', memberRow?.health?.state === 'MISSED_PICKUP', memberRow?.health?.state)
  ok('missed count = 1', memberRow?.health?.missedPickups === 1)
  ok('last pickup present', Boolean(memberRow?.lastPickupAt))
  ok('next pickup present', Boolean(memberRow?.nextPickupAt))
  ok('quiet member flagged UNUSED_RISK', quietRow?.health?.state === 'UNUSED_RISK', quietRow?.health?.state)

  // ================================================================
  // [6] Kit tag — mint + privacy ladder
  // ================================================================
  console.log('\n[6] Kit tag')
  res = await admin.request.patch(`${BASE}/api/subscriptions/${subId}`, { data: { action: 'kit-tag' } })
  const tag = await res.json().catch(() => ({}))
  ok('kit tag minted', res.status() === 200 && /^KZK-[A-Z2-9]{6}$/.test(tag.code ?? ''), tag.code ?? 'none')
  ok('QR svg returned', typeof tag.qrSvg === 'string' && tag.qrSvg.includes('<svg'))
  ok('QR encodes the scan URL', (tag.url ?? '').includes(`/kit/${tag.code}`))
  const code = tag.code

  // Public: no names
  const pubRes = await fetch(`${BASE}/api/kit/${code}`)
  const pubBody = await pubRes.json().catch(() => ({}))
  ok('public scope is brand-only', pubBody.scope === 'public')
  ok('public payload has NO member name', !JSON.stringify(pubBody).includes('Amara'))

  // Rider: name, no phone
  const riderPage = await browser.newPage()
  await login(riderPage, 't75rider@kozy.test', 'T75Rider!2026')
  res = await riderPage.request.get(`${BASE}/api/kit/${code}`)
  const riderBody = await res.json().catch(() => ({}))
  ok('rider scope', riderBody.scope === 'rider')
  ok('rider sees the member name', riderBody.member?.name === 'Amara Okafor')
  ok('rider gets NO phone/email', !riderBody.member?.phone && !riderBody.member?.email)

  // Office: full contact + usage
  res = await admin.request.get(`${BASE}/api/kit/${code}`)
  const officeBody = await res.json().catch(() => ({}))
  ok('office scope', officeBody.scope === 'office')
  ok('office sees phone', Boolean(officeBody.member?.phone))
  ok('office sees usage meters', officeBody.usage?.unitsUsed === 3)
  ok('office sees recent bookings', (officeBody.activity ?? []).length >= 3)

  // Unknown tag
  const bogus = await fetch(`${BASE}/api/kit/KZK-ZZZZZZ`)
  ok('unknown tag 404', bogus.status === 404)

  // ================================================================
  // [7] The scan page itself
  // ================================================================
  console.log('\n[7] Kit scan page')
  const anon = await browser.newPage()
  await anon.goto(`${BASE}/kit/${code}`, { waitUntil: 'domcontentloaded' })
  await anon.waitForTimeout(1500)
  const pubPageText = (await anon.textContent('body')) || ''
  ok('public page renders the brand card', pubPageText.includes('Kozy Circle'))
  ok('public page hides the member name', !pubPageText.includes('Amara'))

  await admin.goto(`${BASE}/kit/${code}`, { waitUntil: 'domcontentloaded' })
  await admin.waitForTimeout(1500)
  const adminPageText = (await admin.textContent('body')) || ''
  ok('office page shows the member name', adminPageText.includes('Amara Okafor'))
  ok('office page shows usage', adminPageText.includes('This cycle'))
  ok('office page shows kit expectation', /with the member/i.test(adminPageText))

  // ================================================================
  // [8] Member portal UI
  // ================================================================
  console.log('\n[8] Member portal')
  await memberPage.goto(`${BASE}/portal`, { waitUntil: 'domcontentloaded' })
  await memberPage.waitForTimeout(1500)
  // open the Membership tab
  try {
    await memberPage.getByRole('tab', { name: /Membership/i }).click({ timeout: 8000 })
    await memberPage.waitForTimeout(1200)
    const portalText = (await memberPage.textContent('body')) || ''
    ok('pickups-this-month section renders', portalText.includes('Your pickups this month'))
    ok('next pickup callout renders', portalText.includes('Next pickup'))
    ok('missed banner renders', portalText.includes('We missed'))
    ok('rebook CTA on the missed banner', portalText.includes('Rebook a pickup'))
    ok('delivered counter', /\d+\/\s?\d+\s*delivered/.test(portalText))
    ok('order numbers in the ledger', portalText.includes('KZ-750001') && portalText.includes('KZ-750003'))
  } catch (e) {
    ok('membership tab opens', false, String(e).slice(0, 120))
  }

  // ================================================================
  // [9] Admin console UI
  // ================================================================
  console.log('\n[9] Admin console')
  await admin.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' })
  await admin.waitForTimeout(2000)
  try {
    await admin.getByRole('button', { name: /Memberships/i }).first().click({ timeout: 10000 })
    await admin.waitForTimeout(1500)
    await admin.getByRole('tab', { name: /Subscribers/i }).click({ timeout: 8000 })
    await admin.waitForTimeout(2000)
    const consoleText = (await admin.textContent('body')) || ''
    ok('stat cards render', consoleText.includes('Running members') && consoleText.includes('Kits with members'))
    ok('needs-attention filter chip', consoleText.includes('Needs attention'))
    ok('health chip on the busy member', consoleText.includes('missed pickup'))
    ok('quiet member flagged barely used', consoleText.includes('barely used'))
    ok('kit tag code on the roster', consoleText.includes(code))
    ok('last/next pickup line', consoleText.includes('Last pickup') && consoleText.includes('Next'))

    // Drill-down
    await admin.getByText('Amara Okafor').first().click({ timeout: 8000 })
    await admin.waitForSelector('[role="dialog"]', { timeout: 8000 })
    await admin.waitForTimeout(1500)
    const drillText = (await admin.textContent('[role="dialog"]')) || ''
    ok('drill-down opens the member ledger', drillText.includes('the member ledger'))
    ok('drill-down shows bookings', drillText.includes("cycle's bookings") && drillText.includes('KZ-750001'))
    ok('drill-down shows the raw ledger', drillText.includes('Ledger (why the counters moved)') && drillText.includes('UNIT'))
    ok('drill-down shows the tag + QR', drillText.includes('Bag / box tag') && drillText.includes(code))
    ok('drill-down offers the print label', drillText.includes('Print label'))
    ok('drill-down has the adjust form', drillText.includes('Adjust a counter'))
    ok('drill-down has retention nudges', drillText.includes('Send usage nudge') && drillText.includes('Send renewal reminder'))
  } catch (e) {
    ok('admin console memberships renders', false, String(e).slice(0, 120))
  }

  // ================================================================
  // [5] Adjust-usage + renewal → ledger rows
  // ================================================================
  console.log('\n[5] Adjust + renew')
  const quietId = quietRow?.id
  res = await admin.request.patch(`${BASE}/api/subscriptions/${quietId}`, {
    data: { action: 'adjust-usage', counter: 'unitsUsed', delta: 1, note: 'goodwill: bag collected off-book' },
  })
  ok('adjust-usage applied', res.status() === 200, `status ${res.status()}`)
  res = await admin.request.patch(`${BASE}/api/subscriptions/${quietId}`, {
    data: { action: 'adjust-usage', counter: 'unitsUsed', delta: 1 },
  })
  ok('adjust-usage without note rejected', res.status() === 400, `status ${res.status()}`)
  res = await admin.request.patch(`${BASE}/api/subscriptions/${quietId}`, {
    data: { action: 'renew', pricePaid: 30000 },
  })
  ok('renewal recorded', res.status() === 200, `status ${res.status()}`)
  res = await admin.request.get(`${BASE}/api/subscriptions/${quietId}`)
  let drill = await res.json().catch(() => ({}))
  const quietEvents = drill.activity?.events ?? []
  ok('USAGE_ADJUST ledger row', quietEvents.some((e) => e.kind === 'USAGE_ADJUST' && e.delta === 1))
  ok('renewal wrote CYCLE_START (second)', quietEvents.filter((e) => e.kind === 'CYCLE_START').length >= 2)
  ok('renewal reset counters', drill.membership?.unitsUsed === 0)

  // ================================================================
  // [10] SEO guards
  // ================================================================
  console.log('\n[10] SEO guards')
  const robots = await (await fetch(`${BASE}/robots.txt`)).text()
  ok('robots disallows /kit', robots.includes('Disallow: /kit'))
  const kitHtml = await (await fetch(`${BASE}/kit/${code}`)).text()
  ok('kit page is noindex', /<meta\s+name="robots"\s+content="noindex/i.test(kitHtml))
  const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text()
  ok('sitemap does NOT list /kit', !sitemap.includes('/kit/'))

  // ----- Console errors on every page we visited -----
  console.log(`\n========================================`)
  console.log(`RESULT: ${pass} passed, ${fail} failed`)
  console.log(`========================================`)
  await browser.close()
  process.exit(fail > 0 ? 1 : 0)
})().catch((e) => {
  console.error('BATTERY CRASHED:', e)
  process.exit(1)
})
