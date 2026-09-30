// =============================================================================
// Task 78 local seed — the Kozy Ladder + smart-nudge battery data.
// =============================================================================
// The behaviour matrix, one member per profile (all allowlisted unless noted):
//   t78power@woosh.dpdns.org    ESSENTIALS · transfer · ends in 3d · renewed
//                               once before (2 CYCLE_START) · 4/4 bags + 1
//                               extra → UPGRADE nudge (The Household).
//   t78loyal@woosh.dpdns.org    ESSENTIALS · transfer · ends in 3d · 3 cycles,
//                               always monthly (maxPrepaid=1) · 2/4 used → no
//                               behavioural line, the standing ladder line.
//   t78prepaid@woosh.dpdns.org  ESSENTIALS · transfer · ends in 3d · CYCLE_
//                               START with cycles=3 (paid ₦85,000 once) →
//                               PREPAY-6 nudge (₦166,500 · ₦27,750/mo).
//   t78deep@woosh.dpdns.org     ESSENTIALS · transfer · ends in 3d · CYCLE_
//                               START with cycles=6 → PREPAY-12 (₦324,000 ·
//                               ₦27,000/mo · "our kindest rate").
//   t78first@woosh.dpdns.org    ESSENTIALS · transfer · ends in 3d · FIRST
//                               cycle (1 CYCLE_START) · 2/4 used → silence
//                               (ladder line only — never upsell a stranger).
//   t78missed@woosh.dpdns.org   ESSENTIALS · transfer · ends in 3d · renewed
//                               once · one MISSED pickup → silence (a
//                               struggling member is never upsold).
//   t78capped@woosh.dpdns.org   like t78prepaid + an UPSELL_SHOWN row 10 days
//                               ago → the 30-day cap suppresses the nudge.
//   t78card@woosh.dpdns.org     ESSENTIALS · PAYSTACK card · ends in 3d ·
//                               renewed once · 4/4 + 1 extra → CARD_AUTOMATIC
//                               render + UPGRADE nudge (card members get
//                               usage-driven upgrades, never prepay pushes).
//   t78mid@woosh.dpdns.org      ESSENTIALS · transfer · ends in 20d → the
//                               portal's quiet mid-cycle "cover more months"
//                               card (collapsed by default).
//   t78outsider@kozy.test       in the window, NOT allowlisted → suppressed
//                               in test mode (receives in production mode).
//   t78admin@woosh.dpdns.org    the office.
// Plans: ESSENTIALS + HOUSEHOLD (both KIT, active) so the upgrade path has a
// destination. No paused member this time (phase 77 covered that render).
// =============================================================================
import { db } from '../src/lib/db'
import bcrypt from 'bcryptjs'

const DAY = 24 * 60 * 60 * 1000

async function upsertPlan(code: string, data: any) {
  const existing = await db.subscriptionPlan.findUnique({ where: { code } })
  if (existing) return existing
  return db.subscriptionPlan.create({ data: { code, ...data } })
}

async function main() {
  // ----- Plans (ESSENTIALS + HOUSEHOLD — the upgrade destination) -----
  const essentials = await upsertPlan('ESSENTIALS', {
    name: 'The Essentials',
    tagline: 'One person’s clothes, every week.',
    family: 'KIT',
    priceMonthly: 30000,
    sortOrder: 1,
    includedUnits: 4,
    unitKind: 'bag',
    unitName: 'Kozy Bag',
    extraUnitPrice: 5000,
    maxExtraUnits: 2,
    replacementFee: 5000,
    shoesPerMonth: 1,
    memberDiscountPct: 5,
  })
  await upsertPlan('HOUSEHOLD', {
    name: 'The Household',
    tagline: 'The whole family’s weekly load in one big box — plus the beds.',
    family: 'KIT',
    priceMonthly: 50000,
    sortOrder: 2,
    includedUnits: 4,
    unitKind: 'box',
    unitName: 'Kozy Box',
    extraUnitPrice: 7500,
    maxExtraUnits: 2,
    replacementFee: 12000,
    duvetsPerQuarter: 3,
    shoesPerMonth: 3,
    memberDiscountPct: 10,
  })

  // ----- People -----
  const mkUser = async (email: string, name: string, role: string, pw: string, address: string) => {
    const hash = await bcrypt.hash(pw, 10)
    return db.user.upsert({
      where: { email },
      update: { passwordHash: hash, role, accessStatus: 'ACTIVE', mustChangePassword: false },
      create: {
        email,
        name,
        phone: '+2347000000091',
        role,
        passwordHash: hash,
        emailVerified: new Date(),
        address,
      },
    })
  }
  const admin = await mkUser('t78admin@woosh.dpdns.org', 'T78 Admin', 'ADMIN', 'T78Admin!2026', 'HQ')
  const power = await mkUser('t78power@woosh.dpdns.org', 'Amaka Okoro', 'B2C', 'T78Power!2026', '12 Kingsway Road, Ikoyi, Lagos')
  const loyal = await mkUser('t78loyal@woosh.dpdns.org', 'Bola Adesanya', 'B2C', 'T78Loyal!2026', '3 Bourdillon Road, Ikoyi, Lagos')
  const prepaid = await mkUser('t78prepaid@woosh.dpdns.org', 'Chuka Nwosu', 'B2C', 'T78Prepaid!2026', '7 Akin Adesola St, VI, Lagos')
  const deep = await mkUser('t78deep@woosh.dpdns.org', 'Funke Adeleke', 'B2C', 'T78Deep!2026', '18 Ahmadu Bello Way, VI, Lagos')
  const first = await mkUser('t78first@woosh.dpdns.org', 'Emeka Obi', 'B2C', 'T78First!2026', '9 Kingsway Road, Ikoyi, Lagos')
  const missed = await mkUser('t78missed@woosh.dpdns.org', 'Yetunde Alabi', 'B2C', 'T78Missed!2026', '21 Ozumba Mbadiwe, VI, Lagos')
  const capped = await mkUser('t78capped@woosh.dpdns.org', 'Ifeanyi Eneh', 'B2C', 'T78Capped!2026', '5 Alexander Ave, Ikoyi, Lagos')
  const card = await mkUser('t78card@woosh.dpdns.org', 'Chidinma Eze', 'B2C', 'T78Card!2026', '5b Alexander Road, Ikoyi, Lagos')
  const mid = await mkUser('t78mid@woosh.dpdns.org', 'Tunde Balogun', 'B2C', 'T78Mid!2026', '22 Admiralty Way, Lekki Phase 1, Lagos')
  const outsider = await mkUser('t78outsider@kozy.test', 'Real Member', 'B2C', 'T78Outsider!2026', '1 Real Street, Lagos')

  // ----- Clean slate for this battery -----
  const allSubs = await db.subscription.findMany({ select: { id: true } })
  for (const s of allSubs) {
    const oldOrders = await db.order.findMany({ where: { subscriptionId: s.id }, select: { id: true } })
    const oldIds = oldOrders.map((o) => o.id)
    if (oldIds.length > 0) {
      await db.statusEvent.deleteMany({ where: { orderId: { in: oldIds } } })
      await db.payment.deleteMany({ where: { orderId: { in: oldIds } } })
    }
    await db.subscriptionEvent.deleteMany({ where: { subscriptionId: s.id } })
    await db.order.deleteMany({ where: { subscriptionId: s.id } })
  }
  await db.subscription.deleteMany({})
  await db.productRequest.deleteMany({})
  await db.storeProduct.deleteMany({})
  await db.appSetting.upsert({
    where: { key: 'store_enabled' },
    update: { value: JSON.stringify(false) },
    create: { key: 'store_enabled', value: JSON.stringify(false) },
  })

  const now = new Date()
  const quarterKey = `${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`

  const mkOrder = (sub: any, userId: string, address: string) => async (opts: {
    number: string
    status: any
    pickupDate: Date
    pickedUpAt?: Date | null
    deliveredAt?: Date | null
    createdAt: Date
  }) =>
    db.order.create({
      data: {
        orderNumber: opts.number,
        userId,
        status: opts.status,
        type: 'ITEM',
        guaranteeActive: false,
        serviceSpeed: 'STANDARD',
        modeOfWash: 'MACHINE',
        deliveryFee: 0,
        itemsManifest: JSON.stringify([
          { id: 'member_unit', name: 'Member pickup', quantity: 1, unitPrice: 0 },
        ]),
        totalPrice: 0,
        subscriptionId: sub.id,
        pickupAddress: address,
        pickupDate: opts.pickupDate,
        pickupTimeSlot: '09:00 - 10:00',
        deliveryAddress: address,
        ...(opts.pickedUpAt ? { pickedUpAt: opts.pickedUpAt } : {}),
        ...(opts.deliveredAt ? { deliveredAt: opts.deliveredAt, deliveryDate: opts.deliveredAt } : {}),
        createdAt: opts.createdAt,
      },
    })

  interface Profile {
    user: { id: string; email: string; name: string }
    address: string
    paymentMethod: string
    endsInDays: number
    cycles: number[] // one CYCLE_START row per past cycle, value = months paid
    unitsUsed: number
    extraUnitsUsed?: number
    paystackRef?: string
    preUpsellRows?: Array<{ kind: string; months?: number; daysAgo: number }>
    orders: Array<{ number: string; status: any; daysAgo: number; pickedUp?: boolean; delivered?: boolean; pickupInDays?: number }>
  }

  const profiles: Profile[] = [
    // The power user → UPGRADE
    {
      user: power, address: '12 Kingsway Road, Ikoyi, Lagos', paymentMethod: 'BANK_TRANSFER',
      endsInDays: 3, cycles: [1, 1], unitsUsed: 4, extraUnitsUsed: 1,
      orders: [
        { number: 'KZ-780001', status: 'DELIVERED', daysAgo: 20, pickedUp: true, delivered: true },
        { number: 'KZ-780002', status: 'DELIVERED', daysAgo: 13, pickedUp: true, delivered: true },
        { number: 'KZ-780003', status: 'DELIVERED', daysAgo: 6, pickedUp: true, delivered: true },
        { number: 'KZ-780004', status: 'REQUESTED', daysAgo: 1, pickupInDays: 1 },
      ],
    },
    // The serial monthly renewer → standing ladder line only
    {
      user: loyal, address: '3 Bourdillon Road, Ikoyi, Lagos', paymentMethod: 'BANK_TRANSFER',
      endsInDays: 3, cycles: [1, 1, 1], unitsUsed: 2,
      orders: [
        { number: 'KZ-780005', status: 'DELIVERED', daysAgo: 18, pickedUp: true, delivered: true },
        { number: 'KZ-780006', status: 'DELIVERED', daysAgo: 9, pickedUp: true, delivered: true },
      ],
    },
    // Has prepaid 3 months before → PREPAY-6
    {
      user: prepaid, address: '7 Akin Adesola St, VI, Lagos', paymentMethod: 'BANK_TRANSFER',
      endsInDays: 3, cycles: [1, 3], unitsUsed: 2,
      orders: [
        { number: 'KZ-780007', status: 'DELIVERED', daysAgo: 17, pickedUp: true, delivered: true },
        { number: 'KZ-780008', status: 'DELIVERED', daysAgo: 8, pickedUp: true, delivered: true },
      ],
    },
    // Has prepaid 6 months before → PREPAY-12
    {
      user: deep, address: '18 Ahmadu Bello Way, VI, Lagos', paymentMethod: 'BANK_TRANSFER',
      endsInDays: 3, cycles: [1, 6], unitsUsed: 3,
      orders: [
        { number: 'KZ-780009', status: 'DELIVERED', daysAgo: 15, pickedUp: true, delivered: true },
        { number: 'KZ-780010', status: 'DELIVERED', daysAgo: 7, pickedUp: true, delivered: true },
      ],
    },
    // First cycle → silence
    {
      user: first, address: '9 Kingsway Road, Ikoyi, Lagos', paymentMethod: 'BANK_TRANSFER',
      endsInDays: 3, cycles: [1], unitsUsed: 2,
      orders: [
        { number: 'KZ-780011', status: 'DELIVERED', daysAgo: 12, pickedUp: true, delivered: true },
      ],
    },
    // Missed a pickup → silence
    {
      user: missed, address: '21 Ozumba Mbadiwe, VI, Lagos', paymentMethod: 'BANK_TRANSFER',
      endsInDays: 3, cycles: [1, 1], unitsUsed: 2,
      orders: [
        { number: 'KZ-780012', status: 'DELIVERED', daysAgo: 16, pickedUp: true, delivered: true },
        { number: 'KZ-780013', status: 'REQUESTED', daysAgo: 3, pickedUp: false }, // pickup day passed, never collected
      ],
    },
    // Nudged 10 days ago → the 30-day cap
    {
      user: capped, address: '5 Alexander Ave, Ikoyi, Lagos', paymentMethod: 'BANK_TRANSFER',
      endsInDays: 3, cycles: [1, 3], unitsUsed: 2,
      preUpsellRows: [{ kind: 'PREPAY', months: 6, daysAgo: 10 }],
      orders: [
        { number: 'KZ-780014', status: 'DELIVERED', daysAgo: 14, pickedUp: true, delivered: true },
      ],
    },
    // Card member, power user → CARD_AUTOMATIC + UPGRADE
    {
      user: card, address: '5b Alexander Road, Ikoyi, Lagos', paymentMethod: 'PAYSTACK',
      endsInDays: 3, cycles: [1, 1], unitsUsed: 4, extraUnitsUsed: 1,
      orders: [
        { number: 'KZ-780015', status: 'DELIVERED', daysAgo: 19, pickedUp: true, delivered: true },
        { number: 'KZ-780016', status: 'DELIVERED', daysAgo: 11, pickedUp: true, delivered: true },
        { number: 'KZ-780017', status: 'DELIVERED', daysAgo: 4, pickedUp: true, delivered: true },
      ],
    },
    // Mid-cycle → the quiet portal card
    {
      user: mid, address: '22 Admiralty Way, Lekki Phase 1, Lagos', paymentMethod: 'BANK_TRANSFER',
      endsInDays: 20, cycles: [1, 1], unitsUsed: 2,
      // The webhook battery charges this member (ladder amounts) — the
      // seeded paystackRef is how the webhook resolves the sub.
      paystackRef: 'SUB-T78-MID-R6',
      orders: [
        { number: 'KZ-780018', status: 'DELIVERED', daysAgo: 8, pickedUp: true, delivered: true },
      ],
    },
    // Outsider → suppressed in test mode
    {
      user: outsider, address: '1 Real Street, Lagos', paymentMethod: 'BANK_TRANSFER',
      endsInDays: 3, cycles: [1, 1], unitsUsed: 2,
      orders: [
        { number: 'KZ-780019', status: 'DELIVERED', daysAgo: 10, pickedUp: true, delivered: true },
      ],
    },
  ]

  const subIds: Record<string, string> = {}
  for (const p of profiles) {
    const cycleRows = p.cycles.length
    const startDaysAgo = 30 - p.endsInDays // periodStart 30d before periodEnd
    const sub = await db.subscription.create({
      data: {
        userId: p.user.id,
        planId: essentials.id,
        status: 'ACTIVE',
        periodStart: new Date(now.getTime() - startDaysAgo * DAY),
        periodEnd: new Date(now.getTime() + p.endsInDays * DAY),
        pricePaid: 30000,
        paymentMethod: p.paymentMethod,
        unitsUsed: p.unitsUsed,
        extraUnitsUsed: p.extraUnitsUsed ?? 0,
        usageCycleKey: 't78',
        usageQuarterKey: quarterKey,
        usageYearKey: String(now.getFullYear()),
        kitState: 'WITH_MEMBER',
        kitDeliveredAt: new Date(now.getTime() - (startDaysAgo - 1) * DAY),
        ...(p.paystackRef ? { paystackRef: p.paystackRef } : {}),
      },
    })
    subIds[p.user.email] = sub.id

    // The renewal history: one CYCLE_START per past cycle (spread back in
    // time), carrying the months paid so nudgeFacts reads the depth.
    for (let i = 0; i < cycleRows; i++) {
      const months = p.cycles[i]
      const daysBack = startDaysAgo + (cycleRows - i) * 30
      await db.subscriptionEvent.create({
        data: {
          subscriptionId: sub.id,
          kind: 'CYCLE_START',
          delta: 0,
          count: 0,
          meta: JSON.stringify({ cycles: months, months, pricePaid: months === 3 ? 85000 : months === 6 ? 166500 : 30000 }),
          note: months > 1 ? `Renewed for ${months} months (seeded history)` : 'Monthly cycle started (seeded history)',
          createdAt: new Date(now.getTime() - daysBack * DAY),
        },
      })
    }
    // Pre-seeded upsell rows (the frequency caps read these back).
    for (const row of p.preUpsellRows ?? []) {
      await db.subscriptionEvent.create({
        data: {
          subscriptionId: sub.id,
          kind: 'UPSELL_SHOWN',
          delta: 0,
          count: 0,
          meta: JSON.stringify({ kind: row.kind, ...(row.months ? { months: row.months } : {}), automation: true }),
          note: 'Smart nudge emailed (seeded history)',
          createdAt: new Date(now.getTime() - row.daysAgo * DAY),
        },
      })
    }
    // The orders.
    const addOrder = mkOrder(sub, p.user.id, p.address)
    for (const o of p.orders) {
      await addOrder({
        number: o.number,
        status: o.status,
        pickupDate: o.pickupInDays
          ? new Date(now.getTime() + o.pickupInDays * DAY)
          : new Date(now.getTime() - o.daysAgo * DAY),
        pickedUpAt: o.pickedUp ? new Date(now.getTime() - o.daysAgo * DAY) : null,
        deliveredAt: o.delivered ? new Date(now.getTime() - (o.daysAgo - 2) * DAY) : null,
        createdAt: new Date(now.getTime() - (o.daysAgo + 1) * DAY),
      })
    }
  }

  console.log('[t78-seed] done:', { admin: admin.id, ...subIds })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .then(() => process.exit(0))
