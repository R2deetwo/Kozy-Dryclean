// =============================================================================
// Task 76 verification — the member email automation + prepopulated renewal.
// Runs against localhost:3000 (server started by t76_run_verify.sh).
//   [1] Cron auth: 401 without/with-wrong secret; 200 with the secret
//   [2] Dry run: the exact plan (who would get what, and why), no sends,
//       no dedupe rows
//   [3] Real sweep (automation OFF): allowlisted members SENT + dedupe rows,
//       the outsider SUPPRESSED (the owner's safety gate)
//   [4] Idempotency: second sweep → SKIPPED_SENT_ALREADY, suppressed member
//       NOT deduped (still receives once armed)
//   [5] Renewal API: months whitelist, transfer claim + RENEWAL_INTENT row,
//       ownership 403, unauth 401, PAYSTACK 503 without key
//   [6] Admin multi-month confirm: periodEnd +3 cycles, CYCLE_START cycles=3,
//       claimed months prefill the record-renewal intent (API level)
//   [7] Webhook multi-month: signed charge.success with metadata.months=3 →
//       periodEnd extends 3 cycles; replay is ignored (idempotent)
//   [8] Member portal: /portal?renew=1&months=3 lands on the Membership tab,
//       renewal card visible, 3 months preselected, transfer flow shows the
//       instructions block
//   [9] Admin: settings API round-trip (arm toggle + allowlist validation),
//       preview-summary delivers to the ADMIN's own inbox, drill-down has
//       the preview button
//  [10] robots/noindex guards intact
// =============================================================================
const { chromium } = require('playwright')
const crypto = require('crypto')

const BASE = 'http://localhost:3000'
const CRON_SECRET = 'kozy-dev-cron-secret-052'
const WEBHOOK_SECRET = 'kozy-dev-webhook-secret-052'
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

// t73 lesson: Playwright's APIResponse.status is a METHOD, native fetch's
// is a PROPERTY — this battery mixes both, so normalize every read.
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

const DAY = 24 * 60 * 60 * 1000

;(async () => {
  const browser = await chromium.launch()

  // ================================================================
  // [1] Cron auth
  // ================================================================
  console.log('\n[1] Cron route auth')
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

  // ================================================================
  // [2] Dry run — the plan, nothing sent, nothing recorded
  // ================================================================
  console.log('\n[2] Dry run plan')
  ok('dryRun flag set', dryBody.dryRun === true)
  ok('automation disarmed by default', dryBody.automationArmed === false)
  ok('allowlist is the default', String(dryBody.allowlist || '').includes('@woosh.dpdns.org'))
  ok('3 summary candidates', dryBody.summaryCandidates === 3, `got ${dryBody.summaryCandidates}`)
  ok('1 paused candidate', dryBody.pausedCandidates === 1, `got ${dryBody.pausedCandidates}`)
  ok('nothing sent in dry mode', dryBody.sent === 0, `sent ${dryBody.sent}`)
  ok('the outsider is SUPPRESSED in the plan too (realistic)', dryBody.suppressed === 1, `suppressed ${dryBody.suppressed}`)
  const dryDetails = dryBody.details ?? []
  ok('allowlisted members are DRY_RUN', dryDetails.filter((d) => d.outcome === 'DRY_RUN').length === 3, dryDetails.map((d) => d.outcome).join(','))
  const cardDry = dryDetails.find((d) => d.member?.email === 't76card@woosh.dpdns.org')
  const transferDry = dryDetails.find((d) => d.member?.email === 't76transfer@woosh.dpdns.org')
  const lapsedDry = dryDetails.find((d) => d.member?.email === 't76lapsed@woosh.dpdns.org')
  ok('card member gets CARD_AUTOMATIC subject', /card renews/i.test(cardDry?.subjectHint ?? ''), cardDry?.subjectHint)
  ok('transfer member gets days-to-renew subject', /days to renew/i.test(transferDry?.subjectHint ?? ''), transferDry?.subjectHint)
  ok('lapsed member gets the paused email', /has paused/i.test(lapsedDry?.subjectHint ?? ''), lapsedDry?.subjectHint)

  // ================================================================
  // [3] Real sweep with the automation OFF — the safety gate
  // ================================================================
  console.log('\n[3] Real sweep, automation OFF (the gate)')
  res = await fetch(`${BASE}/api/cron/member-emails`, {
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  })
  const sweep1 = await res.json().catch(() => ({}))
  ok('sweep 200', st(res) === 200)
  ok('3 sent (the allowlisted members)', sweep1.sent === 3, `got ${sweep1.sent}`)
  ok('1 suppressed (the outsider)', sweep1.suppressed === 1, `got ${sweep1.suppressed}`)
  const suppressed = (sweep1.details ?? []).find((d) => d.outcome === 'SUPPRESSED')
  ok('the outsider is the suppressed one', suppressed?.member?.email === 't76outsider@kozy.test', suppressed?.member?.email)
  ok('suppression explains the gate', /Automation is OFF/i.test(suppressed?.reason ?? ''))

  // Dedupe rows landed (SUMMARY_SENT ×2 + PAUSED_SENT ×1)
  const admin = await browser.newPage()
  await login(admin, 't76admin@woosh.dpdns.org', 'T76Admin!2026')
  res = await admin.request.get(`${BASE}/api/subscriptions`)
  const roster = await res.json().catch(() => ({}))
  const items = roster.items ?? []
  const cardRow = items.find((i) => i.user?.email === 't76card@woosh.dpdns.org')
  const transferRow = items.find((i) => i.user?.email === 't76transfer@woosh.dpdns.org')
  const lapsedRow = items.find((i) => i.user?.email === 't76lapsed@woosh.dpdns.org')
  ok('roster carries the t76 members', Boolean(cardRow && transferRow && lapsedRow))
  res = await admin.request.get(`${BASE}/api/subscriptions/${cardRow.id}`)
  let drill = await res.json().catch(() => ({}))
  ok('SUMMARY_SENT row on the card member', (drill.activity?.events ?? []).some((e) => e.kind === 'SUMMARY_SENT'))
  res = await admin.request.get(`${BASE}/api/subscriptions/${lapsedRow.id}`)
  drill = await res.json().catch(() => ({}))
  ok('PAUSED_SENT row on the lapsed member', (drill.activity?.events ?? []).some((e) => e.kind === 'PAUSED_SENT'))

  // ================================================================
  // [4] Idempotency — the second sweep is a no-op
  // ================================================================
  console.log('\n[4] Idempotency')
  res = await fetch(`${BASE}/api/cron/member-emails`, {
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  })
  const sweep2 = await res.json().catch(() => ({}))
  ok('second sweep sends nothing', sweep2.sent === 0, `got ${sweep2.sent}`)
  ok('3 skipped as already sent', sweep2.skipped === 3, `got ${sweep2.skipped}`)
  ok('outsider still suppressed (no dedupe on suppression)', sweep2.suppressed === 1, `got ${sweep2.suppressed}`)

  // ================================================================
  // [5] The renewal API — the prepopulated payment place
  // ================================================================
  console.log('\n[5] Renewal API')
  const memberPage = await browser.newPage()
  await login(memberPage, 't76transfer@woosh.dpdns.org', 'T76Transfer!2026')
  res = await memberPage.request.get(`${BASE}/api/subscriptions/me`)
  let me = await res.json().catch(() => ({}))
  const mySubId = me.membership?.id
  ok('transfer member me loads', st(res) === 200 && Boolean(mySubId))

  // unauthenticated
  res = await fetch(`${BASE}/api/subscriptions/renew`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscriptionId: mySubId, months: 1, method: 'BANK_TRANSFER' }),
  })
  ok('401 unauthenticated', st(res) === 401, `status ${st(res)}`)

  // months whitelist
  res = await memberPage.request.post(`${BASE}/api/subscriptions/renew`, {
    data: { subscriptionId: mySubId, months: 5, method: 'BANK_TRANSFER' },
  })
  ok('months=5 rejected', st(res) === 400, `status ${st(res)}`)

  // the transfer claim (3 months)
  res = await memberPage.request.post(`${BASE}/api/subscriptions/renew`, {
    data: { subscriptionId: mySubId, months: 3, method: 'BANK_TRANSFER' },
  })
  const claim = await res.json().catch(() => ({}))
  ok('transfer claim 200', st(res) === 200, `status ${st(res)}`)
  ok('amount = 3 × plan price', claim.transfer?.amount === 90000, `got ${claim.transfer?.amount}`)
  ok('months echoed', claim.transfer?.months === 3)
  ok('reference minted', /^KZY-RENEW-/.test(claim.transfer?.reference ?? ''), claim.transfer?.reference)
  ok('bank details included', Boolean(claim.transfer?.bankName && claim.transfer?.accountNumber))
  res = await admin.request.get(`${BASE}/api/subscriptions/${mySubId}`)
  drill = await res.json().catch(() => ({}))
  const intentRow = (drill.activity?.events ?? []).find((e) => e.kind === 'RENEWAL_INTENT')
  ok('RENEWAL_INTENT ledger row', Boolean(intentRow))
  let intentMeta = {}
  try { intentMeta = JSON.parse(intentRow?.meta ?? '{}') } catch {}
  ok('intent meta carries months + amount', intentMeta.months === 3 && intentMeta.amount === 90000)

  // ownership
  const otherPage = await browser.newPage()
  await login(otherPage, 't76card@woosh.dpdns.org', 'T76Card!2026')
  res = await otherPage.request.post(`${BASE}/api/subscriptions/renew`, {
    data: { subscriptionId: mySubId, months: 1, method: 'BANK_TRANSFER' },
  })
  ok('403 on someone else\u2019s membership', st(res) === 403, `status ${st(res)}`)

  // PAYSTACK without a key → 503 with the clear message
  res = await memberPage.request.post(`${BASE}/api/subscriptions/renew`, {
    data: { subscriptionId: mySubId, months: 1, method: 'PAYSTACK' },
  })
  const psBody = await res.json().catch(() => ({}))
  ok('PAYSTACK 503 without key', st(res) === 503 && psBody.error === 'PAYSTACK_NOT_CONFIGURED', `status ${st(res)}`)

  // ================================================================
  // [6] Admin multi-month confirm (the office's money-moving step)
  // ================================================================
  console.log('\n[6] Admin multi-month confirm')
  const beforeEnd = new Date(transferRow.periodEnd).getTime()
  res = await admin.request.patch(`${BASE}/api/subscriptions/${mySubId}`, {
    data: { action: 'renew', months: 3 },
  })
  const renewed = await res.json().catch(() => ({}))
  ok('renew 200', st(res) === 200, `status ${st(res)}`)
  const afterEnd = new Date(renewed.membership?.periodEnd ?? 0).getTime()
  const extensionDays = (afterEnd - beforeEnd) / DAY
  ok('periodEnd extends ~3 cycles (90d)', extensionDays > 88 && extensionDays < 92, `${extensionDays.toFixed(1)}d`)
  res = await admin.request.get(`${BASE}/api/subscriptions/${mySubId}`)
  drill = await res.json().catch(() => ({}))
  const cycleRows = (drill.activity?.events ?? []).filter((e) => e.kind === 'CYCLE_START')
  let cyclesMeta = {}
  try { cyclesMeta = JSON.parse(cycleRows?.[0]?.meta ?? '{}') } catch {}
  ok('CYCLE_START records cycles=3', cyclesMeta.cycles === 3)

  // ================================================================
  // [7] Webhook multi-month charge
  // ================================================================
  console.log('\n[7] Webhook multi-month')
  // The lapsed sub's paystackRef is seeded exactly as the card-initialize
  // route would store it — the webhook matches the stored ref, reads
  // metadata.months, and must reactivate the lapsed membership ~3 cycles
  // ahead. The replay must be idempotent.
  const lapsedSubId = lapsedRow.id
  res = await admin.request.get(`${BASE}/api/subscriptions/${lapsedSubId}`)
  drill = await res.json().catch(() => ({}))
  const lapsedEndBefore = new Date(drill.membership?.periodEnd ?? 0).getTime()
  const lapsedRef = drill.membership?.paystackRef
  ok('lapsed sub carries a seeded ref', typeof lapsedRef === 'string' && lapsedRef.startsWith('SUB-'), String(lapsedRef))

  const webhookPayload = {
    event: 'charge.success',
    data: {
      reference: lapsedRef,
      amount: 9000000, // ₦90,000 in kobo = 3 months of ESSENTIALS
      currency: 'NGN',
      metadata: { subscriptionId: lapsedSubId, kind: 'membership', renewal: true, months: 3 },
    },
  }
  const raw = JSON.stringify(webhookPayload)
  const signature = crypto.createHmac('sha512', WEBHOOK_SECRET).update(raw).digest('hex')
  res = await fetch(`${BASE}/api/webhooks/paystack`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-paystack-signature': signature },
    body: raw,
  })
  ok('webhook 200', st(res) === 200, `status ${st(res)}`)
  res = await admin.request.get(`${BASE}/api/subscriptions/${lapsedSubId}`)
  drill = await res.json().catch(() => ({}))
  const lapsedEndAfter = new Date(drill.membership?.periodEnd ?? 0).getTime()
  const lapsedDays = (lapsedEndAfter - Date.now()) / DAY
  ok('lapsed membership reactivated ~3 cycles ahead', lapsedDays > 86 && lapsedDays < 94, `${lapsedDays.toFixed(1)}d`)

  // Replay → idempotent (no double extension)
  const lapsedEndBeforeReplay = lapsedEndAfter
  res = await fetch(`${BASE}/api/webhooks/paystack`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-paystack-signature': signature },
    body: raw,
  })
  ok('webhook replay 200', st(res) === 200)
  res = await admin.request.get(`${BASE}/api/subscriptions/${lapsedSubId}`)
  drill = await res.json().catch(() => ({}))
  const lapsedEndReplay = new Date(drill.membership?.periodEnd ?? 0).getTime()
  ok('replay does not double-extend', Math.abs(lapsedEndReplay - lapsedEndBeforeReplay) < 1000)

  // ================================================================
  // [8] Member portal — the prepopulated renewal landing
  // ================================================================
  // NOTE: the CARD member is used here — the battery renewed the transfer
  // member in [6] (their card correctly vanishes once no longer expiring).
  // The card member (HOUSEHOLD, ends in 3 days) still needs to renew.
  console.log('\n[8] Portal renewal landing')
  const cardPage = await browser.newPage()
  await login(cardPage, 't76card@woosh.dpdns.org', 'T76Card!2026')
  await cardPage.goto(`${BASE}/portal?renew=1&months=3`, { waitUntil: 'domcontentloaded' })
  await cardPage.waitForTimeout(2200)
  const portalText = (await cardPage.textContent('body')) || ''
  ok('membership tab is the landing tab', portalText.includes('The Kozy Circle') || portalText.includes('This month'))
  ok('renewal card renders', portalText.includes('How many months?'))
  ok('3 months preselected with the HOUSEHOLD price', portalText.includes('3 months') && /150,000/.test(portalText), '')
  try {
    await cardPage.getByRole('button', { name: /Pay by bank transfer/i }).click({ timeout: 8000 })
    await cardPage.waitForTimeout(1200)
    const afterTransfer = (await cardPage.textContent('body')) || ''
    ok('transfer instructions appear', afterTransfer.includes('Account number') && afterTransfer.includes('KZY-RENEW-'))
    ok('transfer amount shown', /150,000/.test(afterTransfer))
  } catch (e) {
    ok('transfer flow completes', false, String(e).slice(0, 120))
  }

  // ================================================================
  // [9] Admin — settings round-trip + preview to the admin's own inbox
  // ================================================================
  console.log('\n[9] Admin settings + preview')
  res = await admin.request.get(`${BASE}/api/settings/app`)
  const settingsBody = await res.json().catch(() => ({}))
  ok('memberEmailAutomation present + OFF', settingsBody.settings?.memberEmailAutomation === false)
  ok('allowlist hidden from public? (admin sees it)', String(settingsBody.settings?.memberEmailTestAllowlist ?? '').includes('@woosh.dpdns.org'))
  // Public payload must NOT carry the allowlist
  const pubRes = await fetch(`${BASE}/api/settings/app`)
  const pubSettings = await pubRes.json().catch(() => ({}))
  ok('allowlist stripped for anonymous reads', pubSettings.settings?.memberEmailTestAllowlist === undefined)

  // PUT round-trip: arm → disarm
  res = await admin.request.put(`${BASE}/api/settings/app`, {
    data: { settings: { memberEmailAutomation: true } },
  })
  let putBody = await res.json().catch(() => ({}))
  ok('arm toggle saves', st(res) === 200 && putBody.settings?.memberEmailAutomation === true)
  res = await admin.request.put(`${BASE}/api/settings/app`, {
    data: { settings: { memberEmailAutomation: false } },
  })
  putBody = await res.json().catch(() => ({}))
  ok('disarm saves', st(res) === 200 && putBody.settings?.memberEmailAutomation === false)
  // Allowlist validation
  res = await admin.request.put(`${BASE}/api/settings/app`, {
    data: { settings: { memberEmailTestAllowlist: 'not-an-email' } },
  })
  ok('bad allowlist entry rejected', st(res) === 400, `status ${st(res)}`)
  res = await admin.request.put(`${BASE}/api/settings/app`, {
    data: { settings: { memberEmailTestAllowlist: '@woosh.dpdns.org,practiceprosystems@gmail.com' } },
  })
  putBody = await res.json().catch(() => ({}))
  ok('good allowlist saves', st(res) === 200 && putBody.settings?.memberEmailTestAllowlist === '@woosh.dpdns.org,practiceprosystems@gmail.com')

  // Preview-summary → the ADMIN's own inbox
  res = await admin.request.patch(`${BASE}/api/subscriptions/${cardRow.id}`, {
    data: { action: 'preview-summary' },
  })
  const preview = await res.json().catch(() => ({}))
  ok('preview 200', st(res) === 200, `status ${st(res)}`)
  ok('preview goes to the signed-in admin', preview.sentTo === 't76admin@woosh.dpdns.org', preview.sentTo)
  ok('preview notes the member was NOT emailed', /member was not emailed/i.test(preview.note ?? ''))
  ok('preview carries a subject hint', /Your .* with Kozy/i.test(preview.subjectHint ?? ''), preview.subjectHint)

  // Drill-down UI: the preview button
  try {
    await admin.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' })
    await admin.waitForTimeout(2000)
    await admin.getByRole('button', { name: /Memberships/i }).first().click({ timeout: 10000 })
    await admin.waitForTimeout(1500)
    await admin.getByRole('tab', { name: /Subscribers/i }).click({ timeout: 8000 })
    await admin.waitForTimeout(2000)
    await admin.getByText('Chidinma Eze').first().click({ timeout: 8000 })
    await admin.waitForSelector('[role="dialog"]', { timeout: 8000 })
    await admin.waitForTimeout(1500)
    const drillText = (await admin.textContent('[role="dialog"]')) || ''
    ok('drill-down offers the preview button', drillText.includes('Preview summary email'))
  } catch (e) {
    ok('drill-down renders with preview', false, String(e).slice(0, 120))
  }

  // ================================================================
  // [10] SEO guards intact
  // ================================================================
  console.log('\n[10] Guards')
  const robots = await (await fetch(`${BASE}/robots.txt`)).text()
  ok('robots still disallows /kit', /Disallow: \/kit/.test(robots))
  const portalHtml = await (await fetch(`${BASE}/portal`)).text()
  ok('portal stays noindex (a private surface, unchanged)', portalHtml.includes('noindex'))

  console.log(`\n========================================`)
  console.log(`RESULT: ${pass} passed, ${fail} failed`)
  console.log(`========================================`)
  await browser.close()
  process.exit(fail > 0 ? 1 : 0)
})().catch((e) => {
  console.error('BATTERY CRASH:', e)
  process.exit(1)
})
