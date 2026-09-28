// =============================================================================
// Task 72 verification — PHASE A: public application strictness, the rider
// payout desk, rider earnings + bank self-service, partner approval → login.
// (Phase B — the partner portal itself — runs in t72_verify2.cjs after the
// pw-setter gives the freshly created PARTNER account a known password.)
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
  // 1. Public application — strictness parity with riders
  // ================================================================
  console.log('\n[1] Partner application validation')
  const validRes = await fetch(`${BASE}/api/partners`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      businessName: 'Verify Laundromat',
      contactName: 'Vera Operator',
      email: 't72verify-laundry@kozy.test',
      phone: '+234 803 111 2222',
      address: '5 Norman Williams, Ikoyi, Lagos',
      lga: 'Ikoyi',
      servicesOffered: ['Dry cleaning', 'Pressing & finishing'],
      capacityNotes: 'E2E battery application.',
    }),
  })
  const validBody = await validRes.json().catch(() => ({}))
  ok('valid application 201', validRes.status === 201)
  ok('KZP reference minted', typeof validBody.refCode === 'string' && validBody.refCode.startsWith('KZP-'), String(validBody.refCode))

  const badPhone = await fetch(`${BASE}/api/partners`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      businessName: 'Bad Phone Laundry', contactName: 'Bo Operator', email: 't72badphone@kozy.test',
      phone: 'nice', address: '5 Norman Williams, Ikoyi, Lagos', lga: 'Ikoyi',
      servicesOffered: ['Dry cleaning'],
    }),
  })
  const badPhoneBody = await badPhone.json().catch(() => ({}))
  ok('non-NG phone rejected with field', badPhone.status === 400 && badPhoneBody.field === 'phone')

  const noServices = await fetch(`${BASE}/api/partners`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      businessName: 'No Services Laundry', contactName: 'No Operator', email: 't72noservices@kozy.test',
      phone: '+234 803 111 3333', address: '5 Norman Williams, Ikoyi, Lagos', lga: 'Ikoyi',
      servicesOffered: [],
    }),
  })
  ok('empty services rejected', noServices.status === 400)

  const noLga = await fetch(`${BASE}/api/partners`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      businessName: 'No Area Laundry', contactName: 'No Area Operator', email: 't72nolga@kozy.test',
      phone: '+234 803 111 4444', address: '5 Norman Williams, Ikoyi, Lagos',
      servicesOffered: ['Wash & fold'],
    }),
  })
  ok('missing lga rejected', noLga.status === 400)

  // ================================================================
  // 2. Admin — the payout desk
  // ================================================================
  console.log('\n[2] Admin: rider roster + payout desk')
  const admin = await browser.newPage()
  await login(admin, 't72admin@kozy.test', 'T72Admin!2026')

  let res = await admin.request.get(`${BASE}/api/rider-applications`)
  let body = await res.json().catch(() => ({}))
  const rider = (body.roster ?? []).find((r) => r.email === 't72rider@kozy.test')
  ok('roster loads', res.status() === 200 && !!rider)
  ok('rates published (500/500 defaults)', rider && rider.ratesPublished === true)
  ok('rider earned 2000 (4 legs × 500)', rider && rider.earnedTotal === 2000, String(rider?.earnedTotal))
  ok('rider pending 2000 (nothing paid)', rider && rider.pendingPayout === 2000, String(rider?.pendingPayout))
  ok('bank not on file yet', rider && rider.bankOnFile === false)

  res = await admin.request.post(`${BASE}/api/rider-payouts`, {
    data: { riderId: rider.id, amount: 1000, method: 'BANK_TRANSFER', reference: 'TRF-72-001', note: 'Week of the battery' },
  })
  body = await res.json().catch(() => ({}))
  ok('payout recorded 201', res.status() === 201)
  ok('pending drops to 1000', body?.balance?.pending === 1000, JSON.stringify(body?.balance))

  res = await admin.request.get(`${BASE}/api/rider-payouts`)
  body = await res.json().catch(() => ({}))
  const row = (body.payouts ?? []).find((p) => p.reference === 'TRF-72-001')
  ok('payout history lists the row + recorder', !!row && row.riderName === 'T72 Rider' && row.method === 'BANK_TRANSFER' && !!row.recordedByName)

  res = await admin.request.get(`${BASE}/api/rider-applications`)
  body = await res.json().catch(() => ({}))
  const rider2 = (body.roster ?? []).find((r) => r.email === 't72rider@kozy.test')
  ok('roster reflects paid 1000 / pending 1000', rider2 && rider2.paidTotal === 1000 && rider2.pendingPayout === 1000)

  // ================================================================
  // 3. Rider — earnings money side + bank self-service
  // ================================================================
  console.log('\n[3] Rider: earnings + bank')
  const riderPage = await browser.newPage()
  await login(riderPage, 't72rider@kozy.test', 'T72Rider!2026')

  res = await riderPage.request.get(`${BASE}/api/driver/earnings`)
  body = await res.json().catch(() => ({}))
  ok('earnings published at 500/500', body.published === true && body.rates?.pickup === 500 && body.rates?.delivery === 500)
  ok('all-time earned 2000', body.summary?.total === 2000, String(body.summary?.total))
  ok('paid total 1000, pending 1000', body.payouts?.paidTotal === 1000 && body.payouts?.pending === 1000)
  ok('payout history visible to rider', (body.payouts?.history ?? []).some((p) => p.reference === 'TRF-72-001' && p.amount === 1000))
  ok('bank flagged as not set', body.bank?.set === false)

  res = await riderPage.request.patch(`${BASE}/api/users/me`, {
    data: { bankName: 'GTBank', bankAccountNumber: '0123456789', bankAccountName: 'T72 Rider' },
  })
  body = await res.json().catch(() => ({}))
  ok('bank details saved', res.status() === 200 && body.bank?.set === true)

  res = await riderPage.request.get(`${BASE}/api/users/me`)
  body = await res.json().catch(() => ({}))
  ok('me returns bank fields to rider', body.user?.bankName === 'GTBank' && body.user?.bankAccountNumber === '0123456789')

  res = await riderPage.request.get(`${BASE}/api/driver/earnings`)
  body = await res.json().catch(() => ({}))
  ok('earnings now shows bank set', body.bank?.set === true && body.bank?.bankName === 'GTBank')

  // ================================================================
  // 4. Admin — approve the seeded partner → PARTNER login
  // ================================================================
  console.log('\n[4] Admin: partner approval creates the portal login')
  res = await admin.request.get(`${BASE}/api/partners`)
  body = await res.json().catch(() => ({}))
  const pendingPartner = (body.partners ?? []).find((p) => p.email === 't72laundry@kozy.test')
  ok('seeded application present with KZP ref + lga + services', !!pendingPartner && pendingPartner.refCode === 'KZP-TST1' && pendingPartner.lga === 'Lekki' && /Wash & fold/.test(pendingPartner.servicesOffered ?? ''))
  ok('no account before approval', pendingPartner && !pendingPartner.account)

  const branchesRes = await admin.request.get(`${BASE}/api/branches`)
  const branchesBody = await branchesRes.json().catch(() => ({}))
  const chevron = (branchesBody.branches ?? []).find((b) => b.slug === 'chevron') ?? (branchesBody ?? []).find?.((b) => b.slug === 'chevron')
  ok('branch list available', !!chevron)

  res = await admin.request.patch(`${BASE}/api/partners/${pendingPartner.id}`, {
    data: { action: 'approve', branchId: chevron?.id ?? null, revenueSharePartnerPct: 75, note: 'Welcome aboard' },
  })
  body = await res.json().catch(() => ({}))
  ok('approve 200', res.status() === 200)
  ok('partner APPROVED with account linked', body.partner?.status === 'APPROVED' && !!body.partner?.userId && !!body.account?.id)
  ok('welcome outcome reported (email locally fails — honest)', body.welcome && typeof body.welcome.ok === 'boolean')
  ok('hint present either way', typeof body.hint === 'string' && body.hint.length > 10)

  res = await admin.request.get(`${BASE}/api/partners`)
  body = await res.json().catch(() => ({}))
  const approved = (body.partners ?? []).find((p) => p.email === 't72laundry@kozy.test')
  ok('account row visible with ACTIVE status', approved?.account?.accessStatus === 'ACTIVE' && approved?.account?.email === 't72laundry@kozy.test')
  ok('ledger row exists for approved partner', (body.ledger ?? []).some((l) => l.partnerId === approved.id))

  // Duplicate-email guard for account creation: approving again should
  // re-arm the SAME account, not fail.
  res = await admin.request.patch(`${BASE}/api/partners/${pendingPartner.id}`, {
    data: { action: 'approve', revenueSharePartnerPct: 75 },
  })
  body = await res.json().catch(() => ({}))
  ok('re-approve re-arms the same account (200)', res.status() === 200 && body.account?.id, String(res.status()))

  await browser.close()
  console.log(`\nPHASE A: ${pass} pass / ${fail} fail`)
  process.exit(fail > 0 ? 1 : 0)
})().catch((e) => {
  console.error('phase A crashed:', e)
  process.exit(1)
})
