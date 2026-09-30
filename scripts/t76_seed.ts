// =============================================================================
// Task 76 local seed — the member-email + renewal battery data.
// =============================================================================
// Four members, engineered for the daily sweep + the prepopulated renewal:
//   t76card@woosh.dpdns.org      HOUSEHOLD · PAYSTACK · ends in 3 days, with
//                                 usage (2 delivered, 1 upcoming, 1 missed) →
//                                 summary candidate, CARD_AUTOMATIC render.
//   t76transfer@woosh.dpdns.org  ESSENTIALS · BANK_TRANSFER · ends in 3 days,
//                                 light usage → summary candidate,
//                                 NEEDS_PAYMENT render (the renewal CTA).
//   t76lapsed@woosh.dpdns.org    ESSENTIALS · BANK_TRANSFER · ended 1 day ago
//                                 → PAST_DUE → paused-email candidate.
//   t76outsider@kozy.test        ESSENTIALS · ends in 3 days but NOT on the
//                                 test allowlist → SUPPRESSED (the gate).
//   t76admin@woosh.dpdns.org     the office (allowlisted) — previews land in
//                                 a woosh inbox.
// All allowlisted emails are @woosh.dpdns.org (the owner's test domain) so
// the REAL email test can fire without touching a single real member.
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
  // ----- Plans (self-seed shapes, matching the code defaults) -----
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

  // ----- People (passwords: T76<Test>!2026) -----
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
  const admin = await mkUser('t76admin@woosh.dpdns.org', 'T76 Admin', 'ADMIN', 'T76Admin!2026', 'HQ')
  const card = await mkUser('t76card@woosh.dpdns.org', 'Chidinma Eze', 'B2C', 'T76Card!2026', '5b Alexander Road, Ikoyi, Lagos')
  const transfer = await mkUser('t76transfer@woosh.dpdns.org', 'Tunde Balogun', 'B2C', 'T76Transfer!2026', '22 Admiralty Way, Lekki Phase 1, Lagos')
  const lapsed = await mkUser('t76lapsed@woosh.dpdns.org', 'Ngozi Adeyemi', 'B2C', 'T76Lapsed!2026', '9 Ozumba Mbadiwe, VI, Lagos')
  const outsider = await mkUser('t76outsider@kozy.test', 'Real Member', 'B2C', 'T76Outsider!2026', '1 Real Street, Lagos')

  // ----- Clean slate for this battery's subscriptions + their orders -----
  const userIds = [card.id, transfer.id, lapsed.id, outsider.id]
  const oldSubs = await db.subscription.findMany({
    where: { userId: { in: userIds } },
    select: { id: true },
  })
  for (const s of oldSubs) {
    const oldOrders = await db.order.findMany({ where: { subscriptionId: s.id }, select: { id: true } })
    const oldIds = oldOrders.map((o) => o.id)
    if (oldIds.length > 0) {
      await db.statusEvent.deleteMany({ where: { orderId: { in: oldIds } } })
      await db.payment.deleteMany({ where: { orderId: { in: oldIds } } })
    }
    await db.subscriptionEvent.deleteMany({ where: { subscriptionId: s.id } })
    await db.order.deleteMany({ where: { subscriptionId: s.id } })
  }
  await db.subscription.deleteMany({ where: { userId: { in: userIds } } })
  // Battery dedupe rows from a previous run
  await db.subscriptionEvent.deleteMany({ where: { kind: { in: ['SUMMARY_SENT', 'PAUSED_SENT'] } } })

  // ----- Isolation: retire every OTHER subscription (t75 leftovers age into
  // the paused/summary windows and would pollute the sweep counts). Their
  // events/orders go with them; t75 re-seeds its own world when re-run. -----
  const others = await db.subscription.findMany({
    where: { userId: { notIn: userIds } },
    select: { id: true },
  })
  for (const s of others) {
    const otherOrders = await db.order.findMany({ where: { subscriptionId: s.id }, select: { id: true } })
    const otherIds = otherOrders.map((o) => o.id)
    if (otherIds.length > 0) {
      await db.statusEvent.deleteMany({ where: { orderId: { in: otherIds } } })
      await db.payment.deleteMany({ where: { orderId: { in: otherIds } } })
    }
    await db.subscriptionEvent.deleteMany({ where: { subscriptionId: s.id } })
    await db.order.deleteMany({ where: { subscriptionId: s.id } })
  }
  await db.subscription.deleteMany({ where: { userId: { notIn: userIds } } })

  const now = new Date()
  const quarterKey = `${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`

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
      usageCycleKey: 't76',
      usageQuarterKey: quarterKey,
      usageYearKey: String(now.getFullYear()),
      kitState: 'WITH_MEMBER',
      kitDeliveredAt: new Date(now.getTime() - 26 * DAY),
    },
  })
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

  const cardOrder = mkOrder(cardSub, card.id, '5b Alexander Road, Ikoyi, Lagos')
  // delivered + upcoming + missed (the missed one lights the summary row)
  await cardOrder({
    number: 'KZ-760001',
    status: 'DELIVERED',
    pickupDate: new Date(now.getTime() - 20 * DAY),
    pickedUpAt: new Date(now.getTime() - 20 * DAY),
    deliveredAt: new Date(now.getTime() - 17 * DAY),
    createdAt: new Date(now.getTime() - 21 * DAY),
  })
  await cardOrder({
    number: 'KZ-760002',
    status: 'DELIVERED',
    pickupDate: new Date(now.getTime() - 13 * DAY),
    pickedUpAt: new Date(now.getTime() - 13 * DAY),
    deliveredAt: new Date(now.getTime() - 10 * DAY),
    createdAt: new Date(now.getTime() - 14 * DAY),
  })
  await cardOrder({
    number: 'KZ-760003',
    status: 'REQUESTED',
    pickupDate: new Date(now.getTime() + 1 * DAY),
    createdAt: new Date(now.getTime() - 1 * DAY),
  })
  await cardOrder({
    number: 'KZ-760004',
    status: 'REQUESTED',
    pickupDate: new Date(now.getTime() - 4 * DAY),
    createdAt: new Date(now.getTime() - 6 * DAY),
  })

  // ----- The transfer member: ESSENTIALS, ends in 3 days, light usage -----
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
      usageCycleKey: 't76',
      usageQuarterKey: quarterKey,
      usageYearKey: String(now.getFullYear()),
      kitState: 'WITH_MEMBER',
      kitDeliveredAt: new Date(now.getTime() - 26 * DAY),
    },
  })
  const transferOrder = mkOrder(transferSub, transfer.id, '22 Admiralty Way, Lekki Phase 1, Lagos')
  await transferOrder({
    number: 'KZ-760005',
    status: 'DELIVERED',
    pickupDate: new Date(now.getTime() - 15 * DAY),
    pickedUpAt: new Date(now.getTime() - 15 * DAY),
    deliveredAt: new Date(now.getTime() - 12 * DAY),
    createdAt: new Date(now.getTime() - 16 * DAY),
  })

  // ----- The lapsed member: ended 1 day ago → PAST_DUE -----
  // paystackRef is seeded the way the card-initialize route would store it,
  // so the webhook leg of the battery can deliver a signed multi-month
  // charge.success against this exact reference.
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
      usageCycleKey: 't76',
      usageQuarterKey: quarterKey,
      usageYearKey: String(now.getFullYear()),
      kitState: 'WITH_MEMBER',
      kitDeliveredAt: new Date(now.getTime() - 30 * DAY),
      paystackRef: 'SUB-T76-LAPSED-RTEST',
    },
  })
  const lapsedOrder = mkOrder(lapsedSub, lapsed.id, '9 Ozumba Mbadiwe, VI, Lagos')
  await lapsedOrder({
    number: 'KZ-760006',
    status: 'DELIVERED',
    pickupDate: new Date(now.getTime() - 20 * DAY),
    pickedUpAt: new Date(now.getTime() - 20 * DAY),
    deliveredAt: new Date(now.getTime() - 18 * DAY),
    createdAt: new Date(now.getTime() - 21 * DAY),
  })

  // ----- The outsider: in the window but NOT allowlisted (the gate proof) -----
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
      usageCycleKey: 't76',
      usageQuarterKey: quarterKey,
      usageYearKey: String(now.getFullYear()),
      kitState: 'PENDING_DELIVERY',
    },
  })

  console.log('[t76-seed] done:', {
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
