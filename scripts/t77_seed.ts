// =============================================================================
// Task 77 local seed — the pricing + store + always-on email battery data.
// =============================================================================
// Same member world as t76 (fresh t77 addresses), plus the Kozy Store:
//   t77card@woosh.dpdns.org      HOUSEHOLD · PAYSTACK · ends in 3 days →
//                                 summary candidate, CARD_AUTOMATIC render
//                                 (informational block + the 3-month line).
//   t77transfer@woosh.dpdns.org  ESSENTIALS (₦30,000) · BANK_TRANSFER · ends
//                                 in 3 days → NEEDS_PAYMENT render — THE
//                                 OWNER'S EXACT NUMBERS: 3 months ₦85,000,
//                                 save ₦5,000.
//   t77lapsed@woosh.dpdns.org    ESSENTIALS · ended 1 day ago → paused email
//                                 (two reactivation buttons).
//   t77outsider@kozy.test        in the window, NOT on the test allowlist →
//                                 suppressed in test mode, receives in
//                                 production mode (always-on proof).
//   t77admin@woosh.dpdns.org     the office (allowlisted).
// Store: one ACTIVE product + one hidden product; the switch itself stays
// OFF (the verify flips it through the real settings API).
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
  // ----- Plans -----
  const household = await upsertPlan('HOUSEHOLD', {
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
  const admin = await mkUser('t77admin@woosh.dpdns.org', 'T77 Admin', 'ADMIN', 'T77Admin!2026', 'HQ')
  const card = await mkUser('t77card@woosh.dpdns.org', 'Chidinma Eze', 'B2C', 'T77Card!2026', '5b Alexander Road, Ikoyi, Lagos')
  const transfer = await mkUser('t77transfer@woosh.dpdns.org', 'Tunde Balogun', 'B2C', 'T77Transfer!2026', '22 Admiralty Way, Lekki Phase 1, Lagos')
  const lapsed = await mkUser('t77lapsed@woosh.dpdns.org', 'Ngozi Adeyemi', 'B2C', 'T77Lapsed!2026', '9 Ozumba Mbadiwe, VI, Lagos')
  const outsider = await mkUser('t77outsider@kozy.test', 'Real Member', 'B2C', 'T77Outsider!2026', '1 Real Street, Lagos')

  // ----- Clean slate for this battery -----
  const userIds = [card.id, transfer.id, lapsed.id, outsider.id, admin.id]
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
  await db.subscriptionEvent.deleteMany({
    where: { kind: { in: ['SUMMARY_SENT', 'PAUSED_SENT'] } },
  })
  await db.productRequest.deleteMany({})
  await db.storeProduct.deleteMany({})
  // The store switch ships dark.
  await db.appSetting.upsert({
    where: { key: 'store_enabled' },
    update: { value: JSON.stringify(false) },
    create: { key: 'store_enabled', value: JSON.stringify(false) },
  })

  // ----- Store products (the shelf the office will fill later) -----
  await db.storeProduct.create({
    data: {
      name: 'Fresh Linen Spray',
      tagline: 'One spritz and your sheets smell like a five-star hotel',
      price: 3500,
      active: true,
      sortOrder: 1,
    },
  })
  await db.storeProduct.create({
    data: {
      name: 'Cedar Blocks (retiring)',
      tagline: null,
      price: 2000,
      active: false,
      sortOrder: 2,
    },
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

  // ----- The card member: HOUSEHOLD, ends in 3 days, healthy usage -----
  const cardSub = await db.subscription.create({
    data: {
      userId: card.id,
      planId: household.id,
      status: 'ACTIVE',
      periodStart: new Date(now.getTime() - 27 * DAY),
      periodEnd: new Date(now.getTime() + 3 * DAY),
      pricePaid: 50000,
      paymentMethod: 'PAYSTACK',
      unitsUsed: 2,
      usageCycleKey: 't77',
      usageQuarterKey: quarterKey,
      usageYearKey: String(now.getFullYear()),
      kitState: 'WITH_MEMBER',
      kitDeliveredAt: new Date(now.getTime() - 26 * DAY),
    },
  })
  const cardOrder = mkOrder(cardSub, card.id, '5b Alexander Road, Ikoyi, Lagos')
  await cardOrder({
    number: 'KZ-770001',
    status: 'DELIVERED',
    pickupDate: new Date(now.getTime() - 20 * DAY),
    pickedUpAt: new Date(now.getTime() - 20 * DAY),
    deliveredAt: new Date(now.getTime() - 17 * DAY),
    createdAt: new Date(now.getTime() - 21 * DAY),
  })
  await cardOrder({
    number: 'KZ-770002',
    status: 'DELIVERED',
    pickupDate: new Date(now.getTime() - 13 * DAY),
    pickedUpAt: new Date(now.getTime() - 13 * DAY),
    deliveredAt: new Date(now.getTime() - 10 * DAY),
    createdAt: new Date(now.getTime() - 14 * DAY),
  })
  await cardOrder({
    number: 'KZ-770003',
    status: 'REQUESTED',
    pickupDate: new Date(now.getTime() + 1 * DAY),
    createdAt: new Date(now.getTime() - 1 * DAY),
  })
  await cardOrder({
    number: 'KZ-770004',
    status: 'REQUESTED',
    pickupDate: new Date(now.getTime() - 4 * DAY),
    createdAt: new Date(now.getTime() - 6 * DAY),
  })

  // ----- The transfer member: ESSENTIALS ₦30,000, ends in 3 days -----
  const transferSub = await db.subscription.create({
    data: {
      userId: transfer.id,
      planId: essentials.id,
      status: 'ACTIVE',
      periodStart: new Date(now.getTime() - 27 * DAY),
      periodEnd: new Date(now.getTime() + 3 * DAY),
      pricePaid: 30000,
      paymentMethod: 'BANK_TRANSFER',
      unitsUsed: 1,
      usageCycleKey: 't77',
      usageQuarterKey: quarterKey,
      usageYearKey: String(now.getFullYear()),
      kitState: 'WITH_MEMBER',
      kitDeliveredAt: new Date(now.getTime() - 26 * DAY),
    },
  })
  const transferOrder = mkOrder(transferSub, transfer.id, '22 Admiralty Way, Lekki Phase 1, Lagos')
  await transferOrder({
    number: 'KZ-770005',
    status: 'DELIVERED',
    pickupDate: new Date(now.getTime() - 15 * DAY),
    pickedUpAt: new Date(now.getTime() - 15 * DAY),
    deliveredAt: new Date(now.getTime() - 12 * DAY),
    createdAt: new Date(now.getTime() - 16 * DAY),
  })

  // ----- The lapsed member: ended 1 day ago → PAST_DUE -----
  const lapsedSub = await db.subscription.create({
    data: {
      userId: lapsed.id,
      planId: essentials.id,
      status: 'ACTIVE',
      periodStart: new Date(now.getTime() - 31 * DAY),
      periodEnd: new Date(now.getTime() - 1 * DAY),
      pricePaid: 30000,
      paymentMethod: 'BANK_TRANSFER',
      unitsUsed: 2,
      usageCycleKey: 't77',
      usageQuarterKey: quarterKey,
      usageYearKey: String(now.getFullYear()),
      kitState: 'WITH_MEMBER',
      kitDeliveredAt: new Date(now.getTime() - 30 * DAY),
      paystackRef: 'SUB-T77-LAPSED-RTEST',
    },
  })
  const lapsedOrder = mkOrder(lapsedSub, lapsed.id, '9 Ozumba Mbadiwe, VI, Lagos')
  await lapsedOrder({
    number: 'KZ-770006',
    status: 'DELIVERED',
    pickupDate: new Date(now.getTime() - 20 * DAY),
    pickedUpAt: new Date(now.getTime() - 20 * DAY),
    deliveredAt: new Date(now.getTime() - 18 * DAY),
    createdAt: new Date(now.getTime() - 21 * DAY),
  })

  // ----- The outsider: in the window but NOT allowlisted -----
  const outsiderSub = await db.subscription.create({
    data: {
      userId: outsider.id,
      planId: essentials.id,
      status: 'ACTIVE',
      periodStart: new Date(now.getTime() - 27 * DAY),
      periodEnd: new Date(now.getTime() + 3 * DAY),
      pricePaid: 30000,
      paymentMethod: 'BANK_TRANSFER',
      unitsUsed: 1,
      usageCycleKey: 't77',
      usageQuarterKey: quarterKey,
      usageYearKey: String(now.getFullYear()),
      kitState: 'PENDING_DELIVERY',
    },
  })

  console.log('[t77-seed] done:', {
    card: cardSub.id,
    transfer: transferSub.id,
    lapsed: lapsedSub.id,
    outsider: outsiderSub.id,
    admin: admin.id,
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .then(() => process.exit(0))
