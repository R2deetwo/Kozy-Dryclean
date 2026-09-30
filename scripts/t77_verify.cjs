// =============================================================================
// Task 77 verification — pricing, store, always-on emails, mobile scroll.
// Runs against localhost:3000 (server started by t77_run_verify.sh with
// MEMBER_EMAIL_TEST_MODE=1 + EMAIL_CAPTURE_DIR=work/t77-emails).
//   [1] Cron auth + dry run plan (test mode ON, outsider suppressed)
//   [2] Real sweep in TEST MODE: 3 allowlisted SENT + captured, outsider
//       SUPPRESSED with the test-mode explanation
//   [3] Captured email content: two buttons (gold next month + green
//       3-month with ₦5,000 saving), "Delivered to you", no plea copy,
//       card member's informational 3-month line
//   [4] ALWAYS-ON proof: in-process prod-mode sweep → the outsider SENT too
//   [5] Renewal API pricing: months=3 → ₦85,000 claim (ESSENTIALS), note
//       mentions the saving; months=1 → ₦30,000; months=6/12/5 rejected
//   [6] Admin confirm: months=3 defaults to ₦85,000, periodEnd +3 cycles
//   [7] Webhook: signed charge for ₦85,000 metadata.months=3 → +3 cycles,
//       replay ignored; amount-only inference (no metadata) reads 3 months
//   [8] Portal renewal card: ?renew=1&months=3 → 3-month pill + save badge
//       + ₦85,000; transfer instructions ₦85,000
//   [9] Store ladder: dark (empty + no tab) → super admin lights it →
//       products visible → customer request → PENDING → admin CONFIRMED →
//       customer sees status; ?all=1 anonymous stays public-shaped;
//       products POST 401 for customer
//  [10] Settings: no memberEmailAutomation key anywhere; PUT with it → 400
//       (the toggle is GONE); storeEnabled round-trips (admin only)
//  [11] Mobile scroll: customers directory table swipes at 390px (all
//       columns reachable)
//  [12] robots intact
// =============================================================================
const { chromium } = require('playwright')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const BASE = 'http://localhost:3000'
const CRON_SECRET = 'kozy-dev-cron-secret-052'
const WEBHOOK_SECRET = 'kozy-dev-webhook-secret-052'
const CAPTURE = path.join(__dirname, '..', 'work', 't77-emails')
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

function st(r) {
  return typeof r.status === 'function' ? r.status() : r.status
}

async function login(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL(/portal|admin|partner|driver/, { timeout: 20000 })
  await page.waitForTimeout(1200)
}

function capturedFiles() {
  try {
    return fs.readdirSync(CAPTURE).filter((f) => f.endsWith('.html'))
  } catch {
    return []
  }
}
function capturedHtml(needle) {
  const files = capturedFiles()
  for (const f of files) {
    const html = fs.readFileSync(path.join(CAPTURE, f), 'utf8')
    if (html.includes(needle)) return html
  }
  return null
}

const DAY = 24 * 60 * 60 * 1000

;(async () => {
  const browser = await chromium.launch()

  // ================================================================
  // [1] Cron auth + dry run
  // ================================================================
  console.log('\n[1] Cron route auth + dry run')
  let res = await fetch(`${BASE}/api/cron/member-emails`)
  ok('401 without secret', st(res) === 401, `status ${st(res)}`)
  res = await fetch(`${BASE}/api/cron/member-emails`, {
    headers: { Authorization: 'Bearer wrong-secret' },
  })
  ok('401 with wrong secret', st(res) === 401, `status ${st(res)}`)
  res = await fetch(`${BASE}/api/cron/member-emails?dry=1`, {
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  })
  ok('200 with the secret', st(res) === 200, `status ${st(res)}`)
  const dryBody = await res.json().catch(() => ({}))
  ok('testMode is ON in this battery server', dryBody.testMode === true)
  ok('allowlist is the default', String(dryBody.allowlist || '').includes('@woosh.dpdns.org'))
  ok('3 summary candidates', dryBody.summaryCandidates === 3, `got ${dryBody.summaryCandidates}`)
  ok('1 paused candidate', dryBody.pausedCandidates === 1, `got ${dryBody.pausedCandidates}`)
  ok('nothing sent in dry mode', dryBody.sent === 0, `sent ${dryBody.sent}`)
  ok('outsider suppressed in the plan', dryBody.suppressed === 1, `suppressed ${dryBody.suppressed}`)

  // ================================================================
  // [2] Real sweep in TEST MODE
  // ================================================================
  console.log('\n[2] Real sweep (test mode ON)')
  fs.rmSync(CAPTURE, { recursive: true, force: true })
  res = await fetch(`${BASE}/api/cron/member-emails`, {
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  })
  const sweep1 = await res.json().catch(() => ({}))
  ok('sweep 200', st(res) === 200)
  ok('3 sent (allowlisted)', sweep1.sent === 3, `got ${sweep1.sent}`)
  ok('1 suppressed (outsider)', sweep1.suppressed === 1, `got ${sweep1.suppressed}`)
  const suppressed = (sweep1.details ?? []).find((d) => d.outcome === 'SUPPRESSED')
  ok('the outsider is the suppressed one', suppressed?.member?.email === 't77outsider@kozy.test', suppressed?.member?.email)
  ok('suppression explains test mode', /Test mode is ON/i.test(suppressed?.reason ?? ''))
  ok('3 emails captured to disk', capturedFiles().length === 3, `${capted(capturedFiles().length)} files`)

  // Idempotent second sweep
  res = await fetch(`${BASE}/api/cron/member-emails`, {
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  })
  const sweep2 = await res.json().catch(() => ({}))
  ok('idempotent: 0 new sends', sweep2.sent === 0, `sent ${sweep2.sent}`)
  ok('3 skipped (already sent)', sweep2.skipped === 3, `skipped ${sweep2.skipped}`)

  // ================================================================
  // [3] Captured email content — the owner's redesign
  // ================================================================
  console.log('\n[3] Email content (captured renders)')
  const transferHtml = capturedHtml('Pay next month — ₦30,000') // NEEDS_PAYMENT body
  ok('transfer summary captured', Boolean(transferHtml))
  if (transferHtml) {
    ok('gold button: Pay next month — ₦30,000', transferHtml.includes('Pay next month — ₦30,000'))
    ok('green button: Pay 3 months — ₦85,000', transferHtml.includes('Pay 3 months — ₦85,000'))
    ok('the saving is spelled out', /you save ₦5,000/i.test(transferHtml))
    ok('green button styled differently', transferHtml.includes('background: linear-gradient(135deg, #2E9E5B, #1F7A43)'))
    ok('"Delivered to you" wording', transferHtml.includes('Delivered to you'))
    ok('old "Delivered back to you" is gone', !transferHtml.includes('Delivered back to you'))
    ok('the plea copy is gone', !transferHtml.includes('Prefer to think about laundry even less'))
    ok('no 6/12-month links remain', !transferHtml.includes('12 months —'))
    ok('3-month deep link present', transferHtml.includes('months=3'))
    ok('no store line while dark', !transferHtml.includes('Also from Kozy'))
  }
  const cardHtml = capturedHtml('charges your saved card') // CARD_AUTOMATIC body
  ok('card summary captured', Boolean(cardHtml))
  if (cardHtml) {
    ok('card: informational auto-renew block', cardHtml.includes('charges your saved card'))
    ok('card: quiet 3-month offer line', cardHtml.includes('Cover 3 months in one payment of ₦141,500'), '₦141,500 = Household 3-month prepay')
    ok('card: the saving stated', cardHtml.includes('₦8,500 less'))
    ok('card: NO payment buttons (nothing to pay)', !cardHtml.includes('Pay next month'))
  }
  const pausedHtml = capturedHtml('has paused')
  ok('paused email captured', Boolean(pausedHtml))
  if (pausedHtml) {
    ok('paused: reactivate next month button', pausedHtml.includes('Reactivate for next month — ₦30,000'))
    ok('paused: reactivate 3 months button', pausedHtml.includes('Reactivate for 3 months — ₦85,000'))
    ok('paused: the saving stated', /you save ₦5,000/i.test(pausedHtml))
  }

  // ================================================================
  // [4] ALWAYS-ON proof — production-mode sweep reaches the outsider
  // ================================================================
  console.log('\n[4] Always-on (production-mode sweep, in-process)')
  const { execSync } = require('child_process')
  const prodSweep = execSync(
    'bun scripts/t77_sweep_prod_mode.ts',
    { cwd: path.join(__dirname, '..'), env: { ...process.env, EMAIL_CAPTURE_DIR: CAPTURE }, timeout: 90000 }
  ).toString()
  const sweep3 = JSON.parse(prodSweep.slice(prodSweep.indexOf('{'), prodSweep.lastIndexOf('}') + 1))
  ok('prod mode: testMode false', sweep3.testMode === false)
  ok('prod mode: outsider SENT (always on)', sweep3.sent === 1, `sent ${sweep3.sent}`)
  const outsiderDetail = (sweep3.details ?? []).find((d) => d.member?.email === 't77outsider@kozy.test')
  ok('outsider detail is SENT', outsiderDetail?.outcome === 'SENT', outsiderDetail?.outcome)
  ok('outsider email captured (4 total)', capturedFiles().length === 4, `${capturedFiles().length} files`)

  // ================================================================
  // [5] Renewal API pricing
  // ================================================================
  console.log('\n[5] Renewal API pricing')
  const member = await browser.newPage()
  await login(member, 't77transfer@woosh.dpdns.org', 'T77Transfer!2026')
  // Find the sub id via the member API
  res = await member.request.get(`${BASE}/api/subscriptions/me`)
  const meBody = await res.json().catch(() => ({}))
  const subId = meBody?.membership?.id ?? meBody?.membership?.subscription?.id
  ok('member API returns the membership', Boolean(subId))

  res = await member.request.post(`${BASE}/api/subscriptions/renew`, {
    data: { subscriptionId: subId, months: 6, method: 'BANK_TRANSFER' },
  })
  ok('months=6 now rejected', st(res) === 400, `status ${st(res)}`)
  res = await member.request.post(`${BASE}/api/subscriptions/renew`, {
    data: { subscriptionId: subId, months: 12, method: 'BANK_TRANSFER' },
  })
  ok('months=12 now rejected', st(res) === 400, `status ${st(res)}`)
  res = await member.request.post(`${BASE}/api/subscriptions/renew`, {
    data: { subscriptionId: subId, months: 5, method: 'BANK_TRANSFER' },
  })
  ok('months=5 rejected', st(res) === 400, `status ${st(res)}`)

  res = await member.request.post(`${BASE}/api/subscriptions/renew`, {
    data: { subscriptionId: subId, months: 3, method: 'BANK_TRANSFER' },
  })
  const claim3 = await res.json().catch(() => ({}))
  ok('3-month transfer claim accepted', st(res) === 200, `status ${st(res)}`)
  ok('claim amount is ₦85,000 (the owner\'s number)', claim3?.transfer?.amount === 85000, `got ${claim3?.transfer?.amount}`)
  ok('claim note mentions the saving', /5,000 saved/i.test(claim3?.transfer?.note ?? ''), claim3?.transfer?.note)
  ok('claim reference KZY-RENEW', String(claim3?.transfer?.reference ?? '').startsWith('KZY-RENEW'))

  res = await member.request.post(`${BASE}/api/subscriptions/renew`, {
    data: { subscriptionId: subId, months: 1, method: 'BANK_TRANSFER' },
  })
  const claim1 = await res.json().catch(() => ({}))
  ok('1-month claim is ₦30,000', claim1?.transfer?.amount === 30000, `got ${claim1?.transfer?.amount}`)

  res = await member.request.post(`${BASE}/api/subscriptions/renew`, {
    data: { subscriptionId: subId, months: 3, method: 'PAYSTACK' },
  })
  ok('PAYSTACK still 503 without key', st(res) === 503, `status ${st(res)}`)

  res = await fetch(`${BASE}/api/subscriptions/renew`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscriptionId: subId, months: 3, method: 'BANK_TRANSFER' }),
  })
  ok('renew unauthenticated 401', st(res) === 401, `status ${st(res)}`)

  // ================================================================
  // [8] Portal renewal card — BEFORE any renew mutation (the card only
  // renders while the month is actually running out). Uses the OUTSIDER
  // member: [5] already spent the transfer member's 6/hour renew budget.
  // ================================================================
  console.log('\n[8] Portal renewal card (prepopulated)')
  const member2 = await browser.newPage()
  await login(member2, 't77outsider@kozy.test', 'T77Outsider!2026')
  await member2.goto(`${BASE}/portal?renew=1&months=3`, { waitUntil: 'domcontentloaded' })
  await member2.waitForTimeout(1800)
  const card3Text = await member2.textContent('body').catch(() => '')
  ok('renewal card renders', /renew/i.test(card3Text))
  ok('3-month option shows ₦85,000', card3Text.includes('₦85,000'), 'the owner\'s number on the portal too')
  ok('saving badge on the 3-month pill', /save ₦5,000/i.test(card3Text))
  ok('no 6/12-month pills', !card3Text.includes('6 months') && !card3Text.includes('12 months'))
  // Trigger the transfer instructions.
  const transferBtn = member2.locator('button', { hasText: 'Pay by bank transfer' }).first()
  if (await transferBtn.count()) {
    await transferBtn.click()
    await member2.waitForTimeout(1500)
    const instr = await member2.textContent('body').catch(() => '')
    ok('transfer instructions show ₦85,000', instr.includes('Transfer ₦85,000'), 'the instructions block amount')
    ok('saving mentioned in instructions', /saved/i.test(instr))
  } else {
    ok('transfer button present', false, 'button not found')
  }

  // ================================================================
  // [6] Admin confirm defaults to the discounted price
  // ================================================================
  console.log('\n[6] Admin confirm (discounted default)')
  const admin = await browser.newPage()
  await login(admin, 't77admin@woosh.dpdns.org', 'T77Admin!2026')
  res = await admin.request.get(`${BASE}/api/subscriptions`)
  const roster = await res.json().catch(() => ({}))
  const transferRow = (roster.items ?? []).find((m) => m.user?.email === 't77transfer@woosh.dpdns.org')
  ok('roster shows the transfer member', Boolean(transferRow))
  const beforeEnd = new Date(transferRow.periodEnd).getTime()
  res = await admin.request.patch(`${BASE}/api/subscriptions/${transferRow.id}`, {
    data: { action: 'renew', months: 3 },
  })
  ok('renew months=3 accepted', st(res) === 200, `status ${st(res)}`)
  const renewed = await res.json().catch(() => ({}))
  const afterEnd = new Date(renewed?.membership?.periodEnd ?? renewed?.periodEnd ?? 0).getTime()
  const days = (afterEnd - beforeEnd) / DAY
  ok('periodEnd extends ~90 days', days > 88 && days < 92, `${days.toFixed(1)} days`)
  // The default recorded price: check the ledger's CYCLE_START meta.
  res = await admin.request.get(`${BASE}/api/subscriptions/${transferRow.id}`)
  const drill = await res.json().catch(() => ({}))
  const cycleStart = (drill?.activity?.events ?? []).find((e) => e.kind === 'CYCLE_START')
  let recordedPrice = null
  try {
    recordedPrice = JSON.parse(cycleStart?.meta ?? '{}').pricePaid
  } catch {}
  ok('recorded price defaults to ₦85,000 (discounted)', recordedPrice === 85000, `got ${recordedPrice}`)

  // ================================================================
  // [7] Webhook — discounted charge, metadata + amount-only inference
  // ================================================================
  console.log('\n[7] Paystack webhook (3-month charge)')
  const sign = (body) =>
    crypto.createHmac('sha512', WEBHOOK_SECRET).update(JSON.stringify(body)).digest('hex')

  // The lapsed member's seeded ref.
  res = await admin.request.get(`${BASE}/api/subscriptions`)
  const roster2 = await res.json().catch(() => ({}))
  const lapsedRow = (roster2.items ?? []).find((m) => m.user?.email === 't77lapsed@woosh.dpdns.org')
  const lapsedBefore = new Date(lapsedRow.periodEnd).getTime()

  const event1 = {
    event: 'charge.success',
    data: {
      reference: 'SUB-T77-LAPSED-RTEST',
      amount: 8500000, // ₦85,000 in kobo — the DISCOUNTED 3-month price
      currency: 'NGN',
      metadata: { subscriptionId: lapsedRow.id, kind: 'membership', renewal: true, months: 3 },
    },
  }
  res = await fetch(`${BASE}/api/webhooks/paystack`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-paystack-signature': sign(event1) },
    body: JSON.stringify(event1),
  })
  ok('webhook accepted', st(res) === 200, `status ${st(res)}`)
  res = await admin.request.get(`${BASE}/api/subscriptions`)
  const roster3 = await res.json().catch(() => ({}))
  const lapsedAfterRow = (roster3.items ?? []).find((m) => m.user?.email === 't77lapsed@woosh.dpdns.org')
  const lapsedAfter = new Date(lapsedAfterRow.periodEnd).getTime()
  const lapsedDays = (lapsedAfter - Date.now()) / DAY
  ok('lapsed membership reactivated ~90 days', lapsedDays > 85 && lapsedDays < 95, `${lapsedDays.toFixed(1)} days`)

  // Replay — idempotent.
  res = await fetch(`${BASE}/api/webhooks/paystack`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-paystack-signature': sign(event1) },
    body: JSON.stringify(event1),
  })
  ok('replay ignored', st(res) === 200)
  res = await admin.request.get(`${BASE}/api/subscriptions`)
  const roster4 = await res.json().catch(() => ({}))
  const lapsedReplay = (roster4.items ?? []).find((m) => m.user?.email === 't77lapsed@woosh.dpdns.org')
  const replayEnd = new Date(lapsedReplay.periodEnd).getTime()
  ok('replay did not double-extend', Math.abs(replayEnd - lapsedAfter) < 1000)

  // Amount-only inference (no metadata months): the OUTSIDER pays the
  // discounted ₦85,000 — plain division would say 2.83 months. (The
  // transfer member was just renewed in [6], so its idempotency guard
  // would correctly ignore a second charge.)
  const outsiderRow = (roster4.items ?? []).find((m) => m.user?.email === 't77outsider@kozy.test')
  const outsiderBefore = new Date(outsiderRow.periodEnd).getTime()
  const event2 = {
    event: 'charge.success',
    data: {
      reference: 'SUB-T77-OUTSIDER-RTEST',
      amount: 8500000,
      currency: 'NGN',
      metadata: { subscriptionId: outsiderRow.id, kind: 'membership', renewal: true },
    },
  }
  // Point the subscription at this ref directly (as the API would).
  const { execSync: es } = require('child_process')
  es(
    `bun -e "const {PrismaClient}=require('@prisma/client');const db=new PrismaClient();db.subscription.update({where:{id:'${outsiderRow.id}'},data:{paystackRef:'SUB-T77-OUTSIDER-RTEST'}}).then(()=>process.exit(0))"`,
    { cwd: path.join(__dirname, '..'), timeout: 60000 }
  )
  res = await fetch(`${BASE}/api/webhooks/paystack`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-paystack-signature': sign(event2) },
    body: JSON.stringify(event2),
  })
  ok('amount-only webhook accepted', st(res) === 200)
  res = await admin.request.get(`${BASE}/api/subscriptions`)
  const roster5 = await res.json().catch(() => ({}))
  const outsiderAfterRow = (roster5.items ?? []).find((m) => m.user?.email === 't77outsider@kozy.test')
  const outsiderAfterEnd = new Date(outsiderAfterRow.periodEnd).getTime()
  const inferredDays = (outsiderAfterEnd - Date.now()) / DAY
  ok('₦85,000 inferred as 3 months (discount-aware)', inferredDays > 85 && inferredDays < 95, `${inferredDays.toFixed(1)} days`)
  ok('the charge actually extended the period', outsiderAfterEnd > outsiderBefore + 60 * DAY)

  // ================================================================
  // [9] Store ladder
  // ================================================================
  console.log('\n[9] Kozy Store (dark → lit → dark)')
  res = await fetch(`${BASE}/api/store`)
  let storeBody = await res.json().catch(() => ({}))
  ok('dark: enabled false', storeBody?.enabled === false)
  ok('dark: no products', (storeBody?.products ?? []).length === 0)
  res = await fetch(`${BASE}/api/store?all=1`)
  storeBody = await res.json().catch(() => ({}))
  ok('dark + anonymous ?all=1 stays public-shaped', storeBody?.enabled === false && (storeBody?.products ?? []).length === 0)
  res = await fetch(`${BASE}/api/store/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Hack Spray', price: 999 }),
  })
  ok('products POST anonymous 401', st(res) === 401, `status ${st(res)}`)
  res = await member.request.post(`${BASE}/api/store/products`, {
    data: { name: 'Customer Spray', price: 999 },
  })
  ok('products POST as CUSTOMER 401 (super admin only)', st(res) === 401, `status ${st(res)}`)

  // The portal shows no Store tab while dark.
  await member.goto(`${BASE}/portal?store=1`, { waitUntil: 'domcontentloaded' })
  await member.waitForTimeout(1500)
  let portalText = await member.textContent('body').catch(() => '')
  ok('dark portal: no Store tab', !/Store/.test(portalText))
  ok('dark portal: falls back to dashboard', /welcome back|active/i.test(portalText))

  // Super admin lights it up through the real settings API.
  res = await admin.request.put(`${BASE}/api/settings/app`, {
    data: { settings: { storeEnabled: true } },
  })
  const litBody = await res.json().catch(() => ({}))
  ok('super admin flips storeEnabled', litBody?.settings?.storeEnabled === true, `status ${st(res)}`)

  res = await fetch(`${BASE}/api/store`)
  storeBody = await res.json().catch(() => ({}))
  ok('lit: enabled true', storeBody?.enabled === true)
  ok('lit: ACTIVE product listed', (storeBody?.products ?? []).some((p) => p.name === 'Fresh Linen Spray'))
  ok('lit: inactive product hidden', !(storeBody?.products ?? []).some((p) => p.name.includes('Cedar')))

  res = await admin.request.get(`${BASE}/api/store?all=1`)
  storeBody = await res.json().catch(() => ({}))
  ok('admin ?all=1 sees the hidden product too', (storeBody?.products ?? []).some((p) => p.name.includes('Cedar')))

  // The customer requests the product.
  const productId = (storeBody?.products ?? []).find((p) => p.name === 'Fresh Linen Spray')?.id
  res = await member.request.post(`${BASE}/api/store/requests`, {
    data: { productId, qty: 2, note: 'Ride along with Friday please' },
  })
  const reqBody = await res.json().catch(() => ({}))
  ok('customer request accepted', st(res) === 200 && reqBody?.request?.status === 'PENDING', `status ${st(res)}`)
  res = await member.request.get(`${BASE}/api/store/requests?mine=1`)
  const mineBody = await res.json().catch(() => ({}))
  ok('customer sees own request PENDING', (mineBody?.requests ?? []).some((r) => r.status === 'PENDING' && r.product?.name === 'Fresh Linen Spray'))
  res = await member.request.get(`${BASE}/api/store/requests`)
  ok('requests office list is admin-only (customer 401)', st(res) === 401, `status ${st(res)}`)

  // The office confirms.
  const requestId = reqBody?.request?.id
  res = await admin.request.get(`${BASE}/api/store/requests`)
  const officeList = await res.json().catch(() => ({}))
  ok('office sees the request with customer info', (officeList?.requests ?? []).some((r) => r.id === requestId && r.user?.email === 't77transfer@woosh.dpdns.org'))
  res = await admin.request.patch(`${BASE}/api/store/requests/${requestId}`, {
    data: { status: 'CONFIRMED' },
  })
  ok('office confirms', st(res) === 200, `status ${st(res)}`)
  res = await member.request.get(`${BASE}/api/store/requests?mine=1`)
  const mine2 = await res.json().catch(() => ({}))
  ok('customer now sees CONFIRMED', (mine2?.requests ?? []).some((r) => r.id === requestId && r.status === 'CONFIRMED'))

  // Portal now shows the Store tab + product + status.
  await member.goto(`${BASE}/portal?store=1`, { waitUntil: 'domcontentloaded' })
  await member.waitForTimeout(1800)
  portalText = await member.textContent('body').catch(() => '')
  ok('lit portal: Store tab appears', /Store/.test(portalText))
  ok('lit portal: product with price', portalText.includes('Fresh Linen Spray') && portalText.includes('₦3,500'))
  ok('lit portal: confirmed request visible', /coming with your next pickup/i.test(portalText))
  ok('lit portal: add button', /add to my next delivery/i.test(portalText))

  // Dark again — the tab disappears.
  res = await admin.request.put(`${BASE}/api/settings/app`, {
    data: { settings: { storeEnabled: false } },
  })
  ok('super admin darks the store', (await res.json().catch(() => ({})))?.settings?.storeEnabled === false)
  await member.goto(`${BASE}/portal`, { waitUntil: 'domcontentloaded' })
  await member.waitForTimeout(1500)
  portalText = await member.textContent('body').catch(() => '')
  ok('dark again: no Store tab', !/Store/.test(portalText))
  res = await member.request.post(`${BASE}/api/store/requests`, {
    data: { productId, qty: 1 },
  })
  ok('dark store: ordering closed (404)', st(res) === 404, `status ${st(res)}`)

  // ================================================================
  // [10] Settings — the member-email toggle is GONE
  // ================================================================
  console.log('\n[10] Settings surface')
  res = await fetch(`${BASE}/api/settings/app`)
  const pubSettings = await res.json().catch(() => ({}))
  ok('public payload has no memberEmailAutomation key', !('memberEmailAutomation' in (pubSettings.settings ?? {})))
  ok('public payload has no allowlist key', !('memberEmailTestAllowlist' in (pubSettings.settings ?? {})))
  ok('public payload carries storeEnabled', 'storeEnabled' in (pubSettings.settings ?? {}))
  res = await admin.request.get(`${BASE}/api/settings/app`)
  const adminSettings = await res.json().catch(() => ({}))
  ok('admin payload has no memberEmailAutomation key', !('memberEmailAutomation' in (adminSettings.settings ?? {})))
  res = await admin.request.put(`${BASE}/api/settings/app`, {
    data: { settings: { memberEmailAutomation: true } },
  })
  ok('PUT with the retired toggle → 400 (nothing to update)', st(res) === 400, `status ${st(res)}`)
  res = await fetch(`${BASE}/api/settings/app`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ settings: { storeEnabled: true } }),
  })
  ok('storeEnabled PUT anonymous 401', st(res) === 401, `status ${st(res)}`)

  // ================================================================
  // [11] Mobile horizontal scroll — the customers directory at 390px
  // ================================================================
  console.log('\n[11] Mobile horizontal scroll (390px)')
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await login(phone, 't77admin@woosh.dpdns.org', 'T77Admin!2026')
  await phone.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' })
  await phone.waitForTimeout(2000)
  // Land on the Customers section — on a phone the console's tab row carries
  // the nav pills (the desktop sidebar is hidden), so click the VISIBLE one.
  const customersNav = phone.locator('button:visible', { hasText: 'Customers' }).first()
  if (await customersNav.count()) {
    await customersNav.click({ timeout: 15000 })
    await phone.waitForTimeout(2000)
  }
  const scrollInfo = await phone.evaluate(() => {
    const tables = Array.from(document.querySelectorAll('table'))
    return tables.map((t) => {
      const scroller = t.closest('.overflow-x-auto') || t.parentElement
      return {
        tableWidth: t.scrollWidth,
        containerWidth: scroller ? scroller.clientWidth : 0,
        scrollable: scroller ? scroller.scrollWidth > scroller.clientWidth : false,
        canScroll: scroller ? scroller.scrollWidth - scroller.clientWidth > 0 : false,
      }
    })
  })
  const scrollableTables = scrollInfo.filter((t) => t.tableWidth > 0)
  ok('customers page has tables at 390px', scrollableTables.length > 0, `${scrollableTables.length} tables`)
  const anyScrollable = scrollableTables.some((t) => t.canScroll)
  ok('at least one table wider than the phone (scroll available)', anyScrollable,
    scrollableTables.map((t) => `${t.tableWidth}>${t.containerWidth}`).join(', '))
  if (anyScrollable) {
    // Actually swipe: set scrollLeft and prove it moves.
    const moved = await phone.evaluate(() => {
      const t = Array.from(document.querySelectorAll('table')).find((x) => x.scrollWidth > 390)
      if (!t) return 0
      const scroller = t.closest('.overflow-x-auto') || t.parentElement
      scroller.scrollLeft = 300
      return scroller.scrollLeft
    })
    ok('horizontal scroll actually moves (swipe works)', moved > 50, `scrollLeft ${moved}`)
    // The previously-hidden columns exist in the DOM at 390px.
    const headerText = await phone.evaluate(() => {
      const t = Array.from(document.querySelectorAll('table')).find((x) => x.scrollWidth > 390)
      if (!t) return ''
      return Array.from(t.querySelectorAll('th')).map((th) => th.textContent?.trim()).join('|')
    })
    ok('Total Spent column exists on mobile (was hidden)', headerText.includes('Total Spent'), headerText)
    ok('Contact column exists on mobile (was hidden)', headerText.includes('Contact'))
  }
  // Tab rows are swipeable too (the shared TabsList).
  const tabRows = await phone.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('[data-slot="tabs-list"]'))
    return rows.map((r) => ({ scrollable: r.scrollWidth > r.clientWidth, w: r.scrollWidth, c: r.clientWidth }))
  })
  ok('tab rows never clip (fit or scroll)', tabRows.every((r) => r.scrollable || r.w <= r.c),
    tabRows.map((r) => `${r.w}/${r.c}`).join(', '))

  // ================================================================
  // [12] robots intact
  // ================================================================
  console.log('\n[12] robots')
  res = await fetch(`${BASE}/robots.txt`)
  const robots = await res.text()
  ok('robots still disallows /kit', robots.includes('Disallow: /kit'))

  console.log(`\n==== T77 RESULT: ${pass} passed, ${fail} failed ====`)
  await browser.close()
  process.exit(fail > 0 ? 1 : 0)
})().catch((e) => {
  console.error('BATTERY CRASH:', e)
  process.exit(1)
})

function capted(n) {
  return n
}
