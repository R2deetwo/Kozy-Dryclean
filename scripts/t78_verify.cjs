// =============================================================================
// Task 78 verification — the Kozy Ladder + the smart nudge, done politely.
// Runs against localhost:3000 (server started by t78_run_verify.sh with
// MEMBER_EMAIL_TEST_MODE=1 + EMAIL_CAPTURE_DIR=work/t78-emails).
//   [1] Cron auth + dry run (9 candidates, outsider suppressed, nudges
//       reported per member in the plan)
//   [2] Real sweep (test mode): 8 allowlisted SENT + captured, 1 suppressed;
//       idempotent second sweep
//   [3] THE TARGETING MATRIX (captured HTML per member):
//         power   → UPGRADE line (Household arithmetic), NO ladder line
//         loyal   → standing ladder line (₦166,500 / ₦324,000 / ₦27,000 mo),
//                   no behavioural line
//         prepaid → PREPAY-6 line (₦166,500 · ₦27,750/mo · ₦13,500 kinder)
//         deep    → PREPAY-12 line (₦324,000 · ₦27,000/mo · kindest rate)
//         first   → ladder line only (never upsell a stranger)
//         missed  → ladder line only (never upsell a struggling member)
//         capped  → ladder line only (the 30-day frequency cap)
//         card    → CARD_AUTOMATIC: ladder ONCE (sentence, not line) +
//                   UPGRADE line, no payment buttons
//         every   → no brash words (hurry / last chance / expires / act now)
//   [4] UPSELL_SHOWN ledger rows written for exactly the nudged members
//   [5] Renewal API: 6 → ₦166,500, 12 → ₦324,000 (notes carry the savings),
//       5 → 400, unauth → 401
//   [6] Portal mid-cycle: collapsed "Covered through" card → expand →
//       1/3/6/12 pills with ladder prices + save badges + per-month subtext +
//       transfer instructions at ₦324,000; deep link ?renew=1&months=6
//       expands mid-cycle with ₦166,500 preselected
//   [7] Webhook: ₦166,500 amount-only (no metadata months) infers 6 months
//       (+180d); replay ignored; ₦324,000 with months=12 adds +360d
//   [8] Admin confirm months=6 → ₦166,500 CYCLE_START, +180d
//   [9] Production-mode sweep: the outsider receives (always-on, and the
//       suppression wrote no dedupe row)
//  [10] robots intact
// =============================================================================
const { chromium } = require('playwright')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const BASE = 'http://localhost:3000'
const CRON_SECRET = 'kozy-dev-cron-secret-052'
const WEBHOOK_SECRET = 'kozy-dev-webhook-secret-052'
const CAPTURE = path.join(__dirname, '..', 'work', 't78-emails')
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

function capturedFor(email) {
  const slug = email.toLowerCase().replace(/[^a-z0-9]+/gi, '-')
  try {
    const files = fs.readdirSync(CAPTURE).filter((f) => f.endsWith('.html') && f.includes(slug))
    if (files.length === 0) return null
    // Latest capture for this recipient.
    files.sort()
    return fs.readFileSync(path.join(CAPTURE, files[files.length - 1]), 'utf8')
  } catch {
    return null
  }
}

const DAY = 24 * 60 * 60 * 1000

async function waitText(page, needle, timeout = 10000) {
  const start = Date.now()
  let t = ''
  while (Date.now() - start < timeout) {
    t = await page.textContent('body').catch(() => '')
    if (t.includes(needle)) return t
    await page.waitForTimeout(300)
  }
  return t
}

;(async () => {
  const browser = await chromium.launch()

  // ================================================================
  // [1] Cron auth + dry run
  // ================================================================
  console.log('\n[1] Cron route auth + dry run')
  let res = await fetch(`${BASE}/api/cron/member-emails`)
  ok('401 without secret', st(res) === 401, `status ${st(res)}`)
  res = await fetch(`${BASE}/api/cron/member-emails?dry=1`, {
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  })
  ok('200 with the secret', st(res) === 200, `status ${st(res)}`)
  const dryBody = await res.json().catch(() => ({}))
  ok('testMode is ON in this battery server', dryBody.testMode === true)
  ok('9 summary candidates', dryBody.summaryCandidates === 9, `got ${dryBody.summaryCandidates}`)
  ok('0 paused candidates', dryBody.pausedCandidates === 0, `got ${dryBody.pausedCandidates}`)
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
  ok('8 sent (allowlisted)', sweep1.sent === 8, `got ${sweep1.sent}`)
  ok('1 suppressed (outsider)', sweep1.suppressed === 1, `got ${sweep1.suppressed}`)
  const suppressed = (sweep1.details ?? []).find((d) => d.outcome === 'SUPPRESSED')
  ok('the outsider is the suppressed one', suppressed?.member?.email === 't78outsider@kozy.test', suppressed?.member?.email)
  const nudges = {}
  for (const d of sweep1.details ?? []) {
    if (d.member?.email && d.nudge) nudges[d.member.email] = d.nudge
  }
  ok('plan reports the power member\'s UPGRADE nudge', nudges['t78power@woosh.dpdns.org'] === 'UPGRADE', nudges['t78power@woosh.dpdns.org'])
  ok('plan reports the prepaid member\'s PREPAY-6 nudge', nudges['t78prepaid@woosh.dpdns.org'] === 'PREPAY-6', nudges['t78prepaid@woosh.dpdns.org'])
  ok('plan reports the deep member\'s PREPAY-12 nudge', nudges['t78deep@woosh.dpdns.org'] === 'PREPAY-12', nudges['t78deep@woosh.dpdns.org'])
  ok('plan reports the card member\'s UPGRADE nudge', nudges['t78card@woosh.dpdns.org'] === 'UPGRADE', nudges['t78card@woosh.dpdns.org'])
  ok('no nudge for the capped member', !nudges['t78capped@woosh.dpdns.org'])
  ok('8 emails captured to disk', fs.readdirSync(CAPTURE).filter((f) => f.endsWith('.html')).length === 8)

  // Idempotent second sweep
  res = await fetch(`${BASE}/api/cron/member-emails`, {
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  })
  const sweep2 = await res.json().catch(() => ({}))
  ok('idempotent: 0 new sends', sweep2.sent === 0, `sent ${sweep2.sent}`)
  ok('8 skipped (already sent)', sweep2.skipped === 8, `skipped ${sweep2.skipped}`)

  // ================================================================
  // [3] THE TARGETING MATRIX — one captured render per member
  // ================================================================
  console.log('\n[3] The targeting matrix (captured renders)')
  const LADDER = 'Covering longer saves more, always'
  const UPGRADE_LINE = 'The Household is ₦50,000 a month'

  const powerHtml = capturedFor('t78power@woosh.dpdns.org')
  ok('power: email captured', Boolean(powerHtml))
  if (powerHtml) {
    ok('power: the two renewal buttons stand', powerHtml.includes('Pay next month — ₦30,000') && powerHtml.includes('Pay 3 months — ₦85,000'))
    ok('power: the 3-month saving spelled out', /you save ₦5,000/i.test(powerHtml))
    ok('power: UPGRADE line present', powerHtml.includes(UPGRADE_LINE))
    ok('power: upgrade line is right-sized, not pushy', powerHtml.includes('whenever it suits you'))
    ok('power: NO standing ladder line (never two upsell lines)', !powerHtml.includes(LADDER))
    ok('power: no PREPAY nudge', !powerHtml.includes('one payment of ₦166,500'))
  }

  const loyalHtml = capturedFor('t78loyal@woosh.dpdns.org')
  ok('loyal: email captured', Boolean(loyalHtml))
  if (loyalHtml) {
    ok('loyal: standing ladder line present', loyalHtml.includes(LADDER))
    ok('loyal: ladder carries the 6-month price', loyalHtml.includes('6 months is ₦166,500'))
    ok('loyal: ladder carries the year price', loyalHtml.includes('₦324,000'))
    ok('loyal: per-month figure stated', loyalHtml.includes('₦27,000 a month'))
    ok('loyal: no UPGRADE line', !loyalHtml.includes(UPGRADE_LINE))
    ok('loyal: no PREPAY nudge (never prepaid — the button tells that story)', !loyalHtml.includes("You've been covering"))
  }

  const prepaidHtml = capturedFor('t78prepaid@woosh.dpdns.org')
  ok('prepaid: email captured', Boolean(prepaidHtml))
  if (prepaidHtml) {
    ok('prepaid: PREPAY-6 line present', prepaidHtml.includes('6 months is one payment of ₦166,500'))
    ok('prepaid: per-month figure', prepaidHtml.includes('₦27,750 a month'))
    ok('prepaid: the saving stated', prepaidHtml.includes('₦13,500 kinder'))
    ok('prepaid: thank-you framing (classy, not brash)', prepaidHtml.includes('thank you'))
    ok('prepaid: NO standing ladder line (the nudge replaces it)', !prepaidHtml.includes(LADDER))
    ok('prepaid: no UPGRADE line', !prepaidHtml.includes(UPGRADE_LINE))
  }

  const deepHtml = capturedFor('t78deep@woosh.dpdns.org')
  ok('deep: email captured', Boolean(deepHtml))
  if (deepHtml) {
    ok('deep: PREPAY-12 line present', deepHtml.includes('A year with Kozy is one payment of ₦324,000'))
    ok('deep: kindest-rate framing', deepHtml.includes('₦27,000 a month, our kindest rate'))
    ok('deep: NO standing ladder line', !deepHtml.includes(LADDER))
  }

  const firstHtml = capturedFor('t78first@woosh.dpdns.org')
  ok('first: email captured', Boolean(firstHtml))
  if (firstHtml) {
    ok('first: ladder line only (stranger = silence)', firstHtml.includes(LADDER))
    ok('first: no UPGRADE line', !firstHtml.includes(UPGRADE_LINE))
    ok('first: no PREPAY nudge', !firstHtml.includes('one payment of ₦166,500') && !firstHtml.includes('A year with Kozy is one payment'))
  }

  const missedHtml = capturedFor('t78missed@woosh.dpdns.org')
  ok('missed: email captured', Boolean(missedHtml))
  if (missedHtml) {
    ok('missed: the struggle is acknowledged', missedHtml.includes('we missed you'))
    ok('missed: ladder line only (struggling = silence)', missedHtml.includes(LADDER))
    ok('missed: no UPGRADE line', !missedHtml.includes(UPGRADE_LINE))
    ok('missed: no PREPAY nudge', !missedHtml.includes('one payment of ₦166,500'))
  }

  const cappedHtml = capturedFor('t78capped@woosh.dpdns.org')
  ok('capped: email captured', Boolean(cappedHtml))
  if (cappedHtml) {
    ok('capped: the 30-day cap held (ladder line, no nudge)', cappedHtml.includes(LADDER))
    ok('capped: no PREPAY-6 line', !cappedHtml.includes('6 months is one payment of ₦166,500'))
  }

  const cardHtml = capturedFor('t78card@woosh.dpdns.org')
  ok('card: email captured', Boolean(cardHtml))
  if (cardHtml) {
    ok('card: informational auto-renew block', cardHtml.includes('charges your saved card'))
    ok('card: ladder ONCE — the sentence, not the standing line', cardHtml.includes('3 months ₦85,000, 6 months ₦166,500, a year ₦324,000'))
    ok('card: no duplicate ladder line', !cardHtml.includes(LADDER), 'the ladder must never appear twice')
    ok('card: UPGRADE line present (usage-driven)', cardHtml.includes(UPGRADE_LINE))
    ok('card: NO payment buttons', !cardHtml.includes('Pay next month'))
    ok('card: no prepay nudge (card members are never pushed on prepay)', !cardHtml.includes("You've been covering"))
  }

  // Every email: classy vocabulary only.
  const brashWords = [/hurry/i, /last chance/i, /expires? (soon|today|tomorrow)/i, /act now/i, /don'?t miss out/i, /limited time/i]
  for (const email of ['t78power@woosh.dpdns.org', 't78loyal@woosh.dpdns.org', 't78prepaid@woosh.dpdns.org', 't78deep@woosh.dpdns.org', 't78card@woosh.dpdns.org']) {
    const html = capturedFor(email) ?? ''
    const brash = brashWords.filter((w) => w.test(html))
    ok(`${email.split('@')[0]}: no brash vocabulary`, brash.length === 0, brash.map(String).join(','))
  }

  // ================================================================
  // [4] UPSELL_SHOWN ledger rows — written for exactly the nudged members
  // ================================================================
  console.log('\n[4] The frequency governor (ledger rows)')
  const admin = await browser.newPage()
  await login(admin, 't78admin@woosh.dpdns.org', 'T78Admin!2026')
  res = await admin.request.get(`${BASE}/api/subscriptions`)
  const roster = await res.json().catch(() => ({}))
  const rowFor = (email) => (roster.items ?? []).find((m) => m.user?.email === email)
  const drillFor = async (email) => {
    const row = rowFor(email)
    if (!row) return {}
    const r = await admin.request.get(`${BASE}/api/subscriptions/${row.id}`)
    return await r.json().catch(() => ({}))
  }
  const upsellRows = async (email) => {
    const drill = await drillFor(email)
    return (drill?.activity?.events ?? []).filter((e) => e.kind === 'UPSELL_SHOWN')
  }
  const powerRows = await upsellRows('t78power@woosh.dpdns.org')
  ok('power: UPSELL_SHOWN row written', powerRows.length === 1, `${powerRows.length} rows`)
  if (powerRows[0]) {
    const meta = JSON.parse(powerRows[0].meta ?? '{}')
    ok('power: row kind UPGRADE', meta.kind === 'UPGRADE', meta.kind)
    ok('power: row carries the reason', /outgrown/i.test(String(meta.reason ?? '')), String(meta.reason ?? '').slice(0, 60))
  }
  const prepaidRows = await upsellRows('t78prepaid@woosh.dpdns.org')
  ok('prepaid: UPSELL_SHOWN row written (PREPAY)', prepaidRows.length === 1 && JSON.parse(prepaidRows[0].meta ?? '{}').kind === 'PREPAY')
  ok('prepaid: row months = 6', JSON.parse(prepaidRows[0]?.meta ?? '{}').months === 6)
  const deepRows = await upsellRows('t78deep@woosh.dpdns.org')
  ok('deep: UPSELL_SHOWN row months = 12', deepRows.length === 1 && JSON.parse(deepRows[0]?.meta ?? '{}').months === 12)
  const cardRows = await upsellRows('t78card@woosh.dpdns.org')
  ok('card: UPSELL_SHOWN row written (UPGRADE)', cardRows.length === 1 && JSON.parse(cardRows[0]?.meta ?? '{}').kind === 'UPGRADE')
  const loyalRows = await upsellRows('t78loyal@woosh.dpdns.org')
  ok('loyal: NO row (nothing behavioural was shown)', loyalRows.length === 0, `${loyalRows.length} rows`)
  const firstRows = await upsellRows('t78first@woosh.dpdns.org')
  ok('first: NO row', firstRows.length === 0)
  const missedRows = await upsellRows('t78missed@woosh.dpdns.org')
  ok('missed: NO row', missedRows.length === 0)

  // ================================================================
  // [5] Renewal API — the whole ladder at the point of payment
  // ================================================================
  console.log('\n[5] Renewal API pricing')
  const loyalPage = await browser.newPage()
  await login(loyalPage, 't78loyal@woosh.dpdns.org', 'T78Loyal!2026')
  res = await loyalPage.request.get(`${BASE}/api/subscriptions/me`)
  const meBody = await res.json().catch(() => ({}))
  const loyalSubId = meBody?.membership?.id ?? meBody?.membership?.subscription?.id
  ok('member API returns the membership', Boolean(loyalSubId))

  res = await loyalPage.request.post(`${BASE}/api/subscriptions/renew`, {
    data: { subscriptionId: loyalSubId, months: 6, method: 'BANK_TRANSFER' },
  })
  const claim6 = await res.json().catch(() => ({}))
  ok('6-month transfer claim accepted', st(res) === 200, `status ${st(res)}`)
  ok('6-month amount = ₦166,500', claim6?.transfer?.amount === 166500, `got ${claim6?.transfer?.amount}`)
  ok('6-month claim is for 6 months', claim6?.transfer?.months === 6)
  ok('6-month note carries the saving', /13,500 saved/i.test(claim6?.transfer?.note ?? ''), claim6?.transfer?.note)

  res = await loyalPage.request.post(`${BASE}/api/subscriptions/renew`, {
    data: { subscriptionId: loyalSubId, months: 12, method: 'BANK_TRANSFER' },
  })
  const claim12 = await res.json().catch(() => ({}))
  ok('12-month amount = ₦324,000', claim12?.transfer?.amount === 324000, `got ${claim12?.transfer?.amount}`)
  ok('12-month note carries the saving', /36,000 saved/i.test(claim12?.transfer?.note ?? ''))

  res = await loyalPage.request.post(`${BASE}/api/subscriptions/renew`, {
    data: { subscriptionId: loyalSubId, months: 1, method: 'BANK_TRANSFER' },
  })
  const claim1 = await res.json().catch(() => ({}))
  ok('1-month claim stays ₦30,000 (full price)', claim1?.transfer?.amount === 30000, `got ${claim1?.transfer?.amount}`)
  ok('1-month note has no saving language', !/saved/i.test(claim1?.transfer?.note ?? ''))

  // months=5 on a different member (rate limit is 6/hour per user)
  const firstPage = await browser.newPage()
  await login(firstPage, 't78first@woosh.dpdns.org', 'T78First!2026')
  res = await firstPage.request.get(`${BASE}/api/subscriptions/me`)
  const firstSubId = (await res.json().catch(() => ({})))?.membership?.id
  res = await firstPage.request.post(`${BASE}/api/subscriptions/renew`, {
    data: { subscriptionId: firstSubId, months: 5, method: 'BANK_TRANSFER' },
  })
  ok('months=5 rejected (off-ladder)', st(res) === 400, `status ${st(res)}`)

  res = await fetch(`${BASE}/api/subscriptions/renew`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscriptionId: loyalSubId, months: 3, method: 'BANK_TRANSFER' }),
  })
  ok('renew unauthenticated 401', st(res) === 401, `status ${st(res)}`)

  // ================================================================
  // [6] Portal mid-cycle — the member's own payment place, quietly there
  // ================================================================
  console.log('\n[6] Portal: the quiet mid-cycle card')
  const midPage = await browser.newPage()
  await login(midPage, 't78mid@woosh.dpdns.org', 'T78Mid!2026')
  await midPage.goto(`${BASE}/portal`, { waitUntil: 'domcontentloaded' })
  await midPage.getByRole('tab', { name: /membership/i }).click()
  let midText = await waitText(midPage, 'Covered through')
  ok('mid-cycle: the quiet card renders (covered-through line)', midText.includes('Covered through'), 'collapsed by default')
  ok('mid-cycle: "Add months early" affordance present', midText.includes('Add months early'))
  ok('mid-cycle: stacking reassurance present', /stack onto that date/i.test(midText) && /never lose a day/i.test(midText))
  ok('mid-cycle: collapsed — the ladder UI is NOT pushed at anyone', !midText.includes('How many months?'))

  // Expand it.
  await midPage.getByRole('button', { name: /add months early/i }).click()
  await midPage.waitForTimeout(800)
  midText = await midPage.textContent('body').catch(() => '')
  ok('mid-cycle: expanding reveals the ladder', midText.includes('How many months?'))
  ok('mid-cycle: all four rungs present', midText.includes('1 month') && midText.includes('3 months') && midText.includes('6 months') && midText.includes('12 months'))
  ok('mid-cycle: ladder prices on the pills', midText.includes('₦30,000') && midText.includes('₦85,000') && midText.includes('₦166,500') && midText.includes('₦324,000'))
  ok('mid-cycle: every discounted rung carries its saving', /save ₦5,000/i.test(midText) && /save ₦13,500/i.test(midText) && /save ₦36,000/i.test(midText))
  ok('mid-cycle: the standing policy line', /the longer you cover, the kinder the rate/i.test(midText))

  // Select the year → per-month figure + pay button amount.
  await midPage.getByRole('button', { name: /12 months/i }).first().click()
  await midPage.waitForTimeout(600)
  midText = await midPage.textContent('body').catch(() => '')
  ok('mid-cycle: 12-month per-month subtext', midText.includes('₦27,000 a month'))
  ok('mid-cycle: pay button shows the year price', midText.includes('₦324,000'))

  // The transfer path at the year rung.
  const transferBtn = midPage.locator('button', { hasText: 'Pay by bank transfer' }).first()
  if (await transferBtn.count()) {
    await transferBtn.click()
    await midPage.waitForTimeout(1500)
    const instr = await midPage.textContent('body').catch(() => '')
    ok('mid-cycle: transfer instructions show ₦324,000', instr.includes('Transfer ₦324,000'))
    ok('mid-cycle: instructions reference the 12 months', /12 months/i.test(instr))
    ok('mid-cycle: reference format KZY-RENEW', /KZY-RENEW/i.test(instr))
  } else {
    ok('transfer button present', false, 'button not found')
  }

  // The deep link mid-cycle: ?renew=1&months=6 expands + preselects.
  await midPage.goto(`${BASE}/portal?renew=1&months=6`, { waitUntil: 'domcontentloaded' })
  midText = await waitText(midPage, 'How many months?')
  ok('deep link: card expanded mid-cycle', midText.includes('How many months?'))
  ok('deep link: 6 months preselected at ₦166,500', midText.includes('₦166,500'))
  ok('deep link: pay button shows the 6-month price', /pay ₦166,500/i.test(midText))

  // ================================================================
  // [7] Webhook — the ladder-aware inference
  // ================================================================
  console.log('\n[7] Paystack webhook (ladder amounts)')
  const sign = (body) =>
    crypto.createHmac('sha512', WEBHOOK_SECRET).update(JSON.stringify(body)).digest('hex')

  const midRow = rowFor('t78mid@woosh.dpdns.org')
  const midBefore = new Date(midRow.periodEnd).getTime()

  // Amount-only (NO metadata months): ₦166,500 must read as 6 months —
  // plain division would say 5.55.
  const event6 = {
    event: 'charge.success',
    data: {
      reference: 'SUB-T78-MID-R6', // the sub's seeded paystackRef
      amount: 16650000, // ₦166,500 in kobo
      currency: 'NGN',
      metadata: { subscriptionId: midRow.id, kind: 'membership', renewal: true },
    },
  }
  res = await fetch(`${BASE}/api/webhooks/paystack`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-paystack-signature': sign(event6) },
    body: JSON.stringify(event6),
  })
  ok('webhook accepted (₦166,500)', st(res) === 200, `status ${st(res)}`)
  res = await admin.request.get(`${BASE}/api/subscriptions`)
  const rosterMid = await res.json().catch(() => ({}))
  const midAfterRow = (rosterMid.items ?? []).find((m) => m.user?.email === 't78mid@woosh.dpdns.org')
  const midDays6 = (new Date(midAfterRow.periodEnd).getTime() - midBefore) / DAY
  ok('₦166,500 inferred as 6 months (+180d)', midDays6 > 177 && midDays6 < 183, `${midDays6.toFixed(1)} days added`)

  // Replay — idempotent.
  res = await fetch(`${BASE}/api/webhooks/paystack`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-paystack-signature': sign(event6) },
    body: JSON.stringify(event6),
  })
  ok('replay ignored', st(res) === 200)
  res = await admin.request.get(`${BASE}/api/subscriptions`)
  const rosterMid2 = await res.json().catch(() => ({}))
  const midReplay = (rosterMid2.items ?? []).find((m) => m.user?.email === 't78mid@woosh.dpdns.org')
  ok('replay did not double-extend', Math.abs(new Date(midReplay.periodEnd).getTime() - new Date(midAfterRow.periodEnd).getTime()) < 1000)

  // The year rung with explicit months: +360d more.
  const midBefore12 = new Date(midReplay.periodEnd).getTime()
  const event12 = {
    event: 'charge.success',
    data: {
      // Same stored ref resolves the sub (Paystack mints a fresh ref per
      // charge in reality; the stored-ref lookup is what this exercises).
      reference: 'SUB-T78-MID-R6',
      amount: 32400000, // ₦324,000 in kobo
      currency: 'NGN',
      metadata: { subscriptionId: midRow.id, kind: 'membership', renewal: true, months: 12 },
    },
  }
  res = await fetch(`${BASE}/api/webhooks/paystack`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-paystack-signature': sign(event12) },
    body: JSON.stringify(event12),
  })
  ok('webhook accepted (₦324,000, months=12)', st(res) === 200, `status ${st(res)}`)
  res = await admin.request.get(`${BASE}/api/subscriptions`)
  const rosterMid3 = await res.json().catch(() => ({}))
  const midAfter12 = (rosterMid3.items ?? []).find((m) => m.user?.email === 't78mid@woosh.dpdns.org')
  const midDays12 = (new Date(midAfter12.periodEnd).getTime() - midBefore12) / DAY
  ok('12-month charge adds +360d', midDays12 > 357 && midDays12 < 363, `${midDays12.toFixed(1)} days added`)

  // The ledger recorded the 6-month CYCLE_START at the ladder price.
  const midDrill = await drillFor('t78mid@woosh.dpdns.org')
  const midCycles = (midDrill?.activity?.events ?? []).filter((e) => e.kind === 'CYCLE_START')
  const sixCycle = midCycles.map((e) => JSON.parse(e.meta ?? '{}')).find((m) => m.cycles === 6)
  ok('CYCLE_START cycles=6 recorded at ₦166,500', sixCycle?.pricePaid === 166500, `pricePaid ${sixCycle?.pricePaid}`)

  // ================================================================
  // [8] Admin confirm — months=6 defaults to the ladder price
  // ================================================================
  console.log('\n[8] Admin confirm (ladder default)')
  const loyalRow = rowFor('t78loyal@woosh.dpdns.org')
  const loyalBefore = new Date(loyalRow.periodEnd).getTime()
  res = await admin.request.patch(`${BASE}/api/subscriptions/${loyalRow.id}`, {
    data: { action: 'renew', months: 6 },
  })
  ok('renew months=6 accepted', st(res) === 200, `status ${st(res)}`)
  const renewed = await res.json().catch(() => ({}))
  const loyalAfter = new Date(renewed?.membership?.periodEnd ?? renewed?.periodEnd ?? 0).getTime()
  const loyalDays = (loyalAfter - loyalBefore) / DAY
  ok('periodEnd extends ~180 days', loyalDays > 177 && loyalDays < 183, `${loyalDays.toFixed(1)} days`)
  const loyalDrill = await drillFor('t78loyal@woosh.dpdns.org')
  const loyalCycle = (loyalDrill?.activity?.events ?? [])
    .map((e) => ({ kind: e.kind, meta: JSON.parse(e.meta ?? '{}') }))
    .filter((e) => e.kind === 'CYCLE_START')[0]
  ok('recorded price defaults to ₦166,500 (the ladder)', loyalCycle?.meta?.pricePaid === 166500, `got ${loyalCycle?.meta?.pricePaid}`)

  // ================================================================
  // [9] Production-mode sweep — always-on, and suppression never
  //     spent the outsider's dedupe row
  // ================================================================
  console.log('\n[9] Always-on (production-mode sweep, in-process)')
  const { execSync } = require('child_process')
  const prodSweep = execSync(
    'bun scripts/t78_sweep_prod_mode.ts',
    { cwd: path.join(__dirname, '..'), env: { ...process.env, EMAIL_CAPTURE_DIR: CAPTURE }, timeout: 90000 }
  ).toString()
  const sweep3 = JSON.parse(prodSweep.slice(prodSweep.indexOf('{'), prodSweep.lastIndexOf('}') + 1))
  ok('prod mode: testMode false', sweep3.testMode === false)
  ok('prod mode: outsider SENT (always on)', sweep3.sent === 1, `sent ${sweep3.sent}`)
  const outsiderDetail = (sweep3.details ?? []).find((d) => d.member?.email === 't78outsider@kozy.test')
  ok('outsider detail is SENT', outsiderDetail?.outcome === 'SENT', outsiderDetail?.outcome)
  const outsiderHtml = capturedFor('t78outsider@kozy.test')
  ok('outsider email captured', Boolean(outsiderHtml))
  if (outsiderHtml) {
    ok('outsider: ladder line (never prepaid, healthy usage)', outsiderHtml.includes(LADDER))
    ok('outsider: no behavioural nudge', !outsiderHtml.includes(UPGRADE_LINE) && !outsiderHtml.includes("You've been covering"))
  }

  // ================================================================
  // [10] robots intact
  // ================================================================
  console.log('\n[10] robots')
  res = await fetch(`${BASE}/robots.txt`)
  const robots = await res.text()
  ok('robots still disallows /kit', robots.includes('Disallow: /kit'))

  await browser.close()
  console.log(`\n[t78-verify] ${pass} pass, ${fail} fail`)
  process.exit(fail > 0 ? 1 : 0)
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
