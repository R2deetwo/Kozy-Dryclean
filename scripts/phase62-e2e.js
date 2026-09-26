// =============================================================================
// Phase 62 E2E smoke test (local dev DB only)
// =============================================================================
// Walks the full membership + branch + partner flows against the dev server:
//   1. Customer signs in → subscribes (bank transfer) → admin verifies
//   2. Member books a bag pickup → order created + routed to a branch
//   3. Usage counters increment; perk gating works
//   4. Partner application → admin approval → ledger derivation
// Resetting the local test customer's password first (LOCAL DB ONLY — never
// touches production or any real account).
// =============================================================================

const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const db = new PrismaClient()

const BASE = 'http://localhost:3000'
const CUSTOMER = { email: 'cust6101@p61.test', password: 'Phase62Test!2026' }
const ADMIN = { email: 'admin61@kozy-test.example', password: 'Phase62Admin!2026' }

let failures = 0
function check(name, cond, detail = '') {
  console.log(`${cond ? '  ✓' : '  ✗ FAIL'} ${name}${detail ? ' — ' + detail : ''}`)
  if (!cond) failures++
}

async function signIn({ email, password }) {
  // CSRF token
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`, { credentials: 'include' })
  const { csrfToken } = await csrfRes.json()
  const cookie = csrfRes.headers.get('set-cookie')?.split(';')[0] ?? ''
  // Credentials callback
  const body = new URLSearchParams({
    csrfToken,
    email,
    password,
    json: 'true',
  })
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    body,
    redirect: 'manual',
    credentials: 'include',
  })
  const sessionCookie = res.headers.get('set-cookie') ?? ''
  const all = [cookie, ...sessionCookie.split(/,(?=[^;]+=)/)].filter(Boolean).join('; ')
  // Verify the session works
  const me = await fetch(`${BASE}/api/auth/session`, { headers: { Cookie: all } })
  const session = await me.json()
  return { cookie: all, session }
}

async function main() {
  // ----- 0. Reset local test passwords (LOCAL DB ONLY) -----
  await db.user.update({
    where: { email: CUSTOMER.email },
    data: { passwordHash: await bcrypt.hash(CUSTOMER.password, 10), emailVerified: new Date() },
  })
  await db.user.update({
    where: { email: ADMIN.email },
    data: { passwordHash: await bcrypt.hash(ADMIN.password, 10) },
  })
  console.log('• Test passwords reset (local dev DB)')

  // Clean slate: remove any prior membership for the test customer
  const cust = await db.user.findUnique({ where: { email: CUSTOMER.email } })
  await db.subscription.deleteMany({ where: { userId: cust.id } })

  // ----- 1. Plans + branches are live -----
  console.log('\n1. Public data')
  const plansRes = await fetch(`${BASE}/api/subscriptions/plans`)
  const plans = (await plansRes.json()).plans
  check('plans endpoint returns 3 tiers', plans.length === 3, plans.map((p) => p.code).join(','))
  check('prices are 30k/50k/80k', [30000, 50000, 80000].every((p, i) => plans.find((x) => x.priceMonthly === p)))
  const branchesRes = await fetch(`${BASE}/api/branches`)
  const branches = (await branchesRes.json()).branches
  check('branches seeded (Ogombo + Chevron)', branches.length === 2, branches.map((b) => b.name).join(' + '))

  // ----- 2. Customer signs in and subscribes -----
  console.log('\n2. Subscribe flow (bank transfer)')
  const custSession = await signIn(CUSTOMER)
  check('customer can sign in', Boolean(custSession.session?.user))
  const subRes = await fetch(`${BASE}/api/subscriptions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: custSession.cookie },
    body: JSON.stringify({ planCode: 'HOUSEHOLD', paymentMethod: 'BANK_TRANSFER' }),
  })
  const subData = await subRes.json()
  check('subscription created (PENDING_ACTIVATION)', subRes.status === 201 && subData.subscription?.status === 'PENDING_ACTIVATION')

  // Double-subscribe guard
  const dupRes = await fetch(`${BASE}/api/subscriptions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: custSession.cookie },
    body: JSON.stringify({ planCode: 'ESSENTIALS', paymentMethod: 'BANK_TRANSFER' }),
  })
  check('double-subscribe blocked with ALREADY_MEMBER', dupRes.status === 409)

  // me endpoint shows pending
  const meRes = await fetch(`${BASE}/api/subscriptions/me`, { headers: { Cookie: custSession.cookie } })
  const meData = await meRes.json()
  check('my-membership reflects PENDING_ACTIVATION', meData.membership?.status === 'PENDING_ACTIVATION')

  // ----- 3. Admin verifies the transfer -----
  console.log('\n3. Admin verification')
  const adminSession = await signIn(ADMIN)
  check('admin can sign in', adminSession.session?.user?.role === 'ADMIN')
  const verifyRes = await fetch(`${BASE}/api/subscriptions/${subData.subscription.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: adminSession.cookie },
    body: JSON.stringify({ action: 'verify' }),
  })
  const verifyData = await verifyRes.json()
  check('membership activated', verifyRes.ok && verifyData.membership?.status === 'ACTIVE', `periodEnd=${verifyData.membership?.periodEnd}`)

  // ----- 4. Member books a bag pickup -----
  console.log('\n4. Member pickup flow')
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const pickupRes = await fetch(`${BASE}/api/subscriptions/pickup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: custSession.cookie },
    body: JSON.stringify({
      kind: 'unit',
      pickupAddress: '12 Chevron Drive, Lekki, Lagos',
      pickupDate: new Date(tomorrow + 'T00:00:00').toISOString(),
      pickupTimeSlot: '09:00 - 10:00',
    }),
  })
  const pickupData = await pickupRes.json()
  check('pickup order created', pickupRes.status === 201, `order ${pickupData.order?.orderNumber}`)
  check('order is PAYMENT_VERIFIED (covered by plan)', pickupData.order?.status === 'PAYMENT_VERIFIED')
  check('order total is 0 (included unit)', pickupData.order?.totalPrice === 0)

  // Branch assignment: Chevron Drive zone (Lekki) → chevron branch
  const created = await db.order.findUnique({ where: { id: pickupData.order.id } })
  const chevron = branches.find((b) => b.slug === 'chevron')
  check('order routed to Chevron Drive branch', created?.branchId === chevron?.id, `branchId=${created?.branchId}`)
  check('order linked to the membership', created?.subscriptionId === subData.subscription.id)

  // Usage incremented + kit hand-over flagged
  const after = await db.subscription.findUnique({ where: { id: subData.subscription.id } })
  check('usage counter incremented (1/4)', after?.unitsUsed === 1)
  check('kit marked WITH_MEMBER (first pickup)', after?.kitState === 'WITH_MEMBER')

  // ----- 5. Perk gating -----
  console.log('\n5. Perk flow (quarterly duvets)')
  const duvetRes = await fetch(`${BASE}/api/subscriptions/pickup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: custSession.cookie },
    body: JSON.stringify({
      kind: 'duvet',
      count: 2,
      pickupAddress: '12 Chevron Drive, Lekki, Lagos',
      pickupDate: new Date(tomorrow + 'T00:00:00').toISOString(),
      pickupTimeSlot: '10:00 - 11:00',
    }),
  })
  const duvetData = await duvetRes.json()
  check('duvet perk order created (2 duvets)', duvetRes.status === 201)
  const afterDuvet = await db.subscription.findUnique({ where: { id: subData.subscription.id } })
  check('duvet counter incremented (2/3 this quarter)', afterDuvet?.duvetsUsed === 2)

  // Over-limit perk: 2 more duvets should be blocked (only 1 left)
  const overRes = await fetch(`${BASE}/api/subscriptions/pickup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: custSession.cookie },
    body: JSON.stringify({
      kind: 'duvet',
      count: 2,
      pickupAddress: '12 Chevron Drive, Lekki, Lagos',
      pickupDate: new Date(tomorrow + 'T00:00:00').toISOString(),
      pickupTimeSlot: '10:00 - 11:00',
    }),
  })
  check('over-limit perk rejected (PERK_EXCEEDED)', overRes.status === 400)

  // Curtain perk on HOUSEHOLD = not included
  const curtainRes = await fetch(`${BASE}/api/subscriptions/pickup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: custSession.cookie },
    body: JSON.stringify({
      kind: 'curtain',
      pickupAddress: '12 Chevron Drive, Lekki, Lagos',
      pickupDate: new Date(tomorrow + 'T00:00:00').toISOString(),
      pickupTimeSlot: '10:00 - 11:00',
    }),
  })
  check('curtain perk rejected on Household tier (not included)', curtainRes.status === 400)

  // ----- 6. Member à-la-carte order gets member pricing -----
  console.log('\n6. Member pricing on à-la-carte orders')
  // Isolate the MEMBER discount: consume the first-order benefit flag so the
  // only percentage discount on this basket is the plan's 10%.
  await db.user.update({ where: { id: cust.id }, data: { signupDiscountUsed: true } })
  const orderRes = await fetch(`${BASE}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: custSession.cookie },
    body: JSON.stringify({
      type: 'ITEM',
      items: [{ id: 'item_shirt', name: 'Shirt', quantity: 2 }],
      serviceSpeed: 'STANDARD',
      modeOfWash: 'MACHINE',
      pickupAddress: `12 Chevron Drive, Lekki Phase 1, Lagos (basket ${Date.now()})`,
      pickupDate: new Date(tomorrow + 'T00:00:00').toISOString(),
      pickupTimeSlot: '11:00 - 12:00',
      paymentMethod: 'BANK_TRANSFER',
    }),
  })
  const orderData = await orderRes.json()
  check('à-la-carte order placed by member', orderRes.status === 201)
  const manifest = JSON.parse(orderData.order?.itemsManifest ?? '[]')
  const shirtUnit = manifest[0]?.unitPrice ?? 0
  const expectedRaw = shirtUnit * 2 // before member discount
  const expectedMember = Math.round(expectedRaw * 0.9) // HOUSEHOLD = 10% off, free delivery
  check('member discount applied (10% off, free delivery)', orderData.order?.totalPrice === expectedMember, `total=${orderData.order?.totalPrice} expected≈${expectedMember} (raw ${expectedRaw})`)
  check('delivery fee waived for member', orderData.order?.deliveryFee === 0)

  // ----- 7. Partner application + approval + ledger -----
  console.log('\n7. Kozy Network flow')
  const partnerEmail = `partner62.${Date.now()}@kozy-test.example`
  const appRes = await fetch(`${BASE}/api/partners`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      businessName: 'Sunshine Laundry Test',
      contactName: 'Ada Test',
      email: partnerEmail,
      phone: '+2348012345678',
      address: '5 Admiralty Way, Lekki Phase 1, Lagos',
      capacityNotes: '3 washers, 2 dryers, 6 staff — testing the network flow.',
    }),
  })
  check('partner application accepted', appRes.status === 201)

  // Duplicate guard
  const dupApp = await fetch(`${BASE}/api/partners`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      businessName: 'Sunshine Laundry Test',
      contactName: 'Ada Test',
      email: partnerEmail,
      phone: '+2348012345678',
      address: '5 Admiralty Way, Lekki Phase 1, Lagos',
    }),
  })
  check('duplicate application blocked (409) or rate-limited (429)', dupApp.status === 409 || dupApp.status === 429, `status=${dupApp.status}`)

  // Admin approves with branch + share
  const partnersList = await (await fetch(`${BASE}/api/partners`, { headers: { Cookie: adminSession.cookie } })).json()
  const pendingPartner = partnersList.partners.find((p) => p.email === partnerEmail)
  check('application visible in admin list', Boolean(pendingPartner))
  const approveRes = await fetch(`${BASE}/api/partners/${pendingPartner.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: adminSession.cookie },
    body: JSON.stringify({ action: 'approve', branchId: chevron?.id, revenueSharePartnerPct: 65 }),
  })
  check('partner approved with 65% share', approveRes.ok && (await approveRes.json()).partner?.revenueSharePartnerPct === 65)

  // Tag the member's duvet order as fulfilled by the partner, deliver it, check ledger
  const tagRes = await fetch(`${BASE}/api/orders/${duvetData.order.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: adminSession.cookie },
    body: JSON.stringify({ fulfilledByPartnerId: pendingPartner.id, status: 'DELIVERED' }),
  })
  check('order tagged to partner + delivered', tagRes.ok)
  const ledgerList = await (await fetch(`${BASE}/api/partners`, { headers: { Cookie: adminSession.cookie } })).json()
  const ledger = ledgerList.ledger.find((l) => l.partnerId === pendingPartner.id)
  check('ledger counts the delivered order', ledger?.ordersThisMonth === 1, JSON.stringify(ledger ?? null))

  // ----- 8. Admin re-routing is admin-only -----
  console.log('\n8. RBAC on routing')
  const stafflessRes = await fetch(`${BASE}/api/orders/${pickupData.order.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: custSession.cookie },
    body: JSON.stringify({ branchId: branches.find((b) => b.slug === 'ogombo')?.id }),
  })
  check('customer cannot re-route orders (403)', stafflessRes.status === 403)

  // ----- 9. Cancel at period end -----
  console.log('\n9. Cancellation')
  const cancelRes = await fetch(`${BASE}/api/subscriptions/me`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: custSession.cookie },
    body: JSON.stringify({ action: 'cancel' }),
  })
  const cancelData = await cancelRes.json()
  check('cancel-at-period-end set', cancelRes.ok && cancelData.membership?.cancelAtPeriodEnd === true)

  // ----- 10. Pages render -----
  console.log('\n10. Pages')
  for (const path of ['/', '/memberships', '/partners', '/book', '/services']) {
    const res = await fetch(`${BASE}${path}`)
    check(`${path} renders`, res.status === 200)
  }

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' FAILURE(S)'}`)
  await db.$disconnect()
  process.exit(failures === 0 ? 0 : 1)
}

main().catch(async (e) => {
  console.error('E2E crashed:', e)
  await db.$disconnect()
  process.exit(1)
})
