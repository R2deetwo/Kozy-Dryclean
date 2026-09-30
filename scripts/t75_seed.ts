// =============================================================================
// Task 75 local seed — the subscription-tracking battery data.
// =============================================================================
// Two members, engineered so the whole radar lights up:
//   t75member  HOUSEHOLD, cycle 10 days in: one delivered pickup, one upcoming,
//              one MISSED pickup, one delivered duvet → counters 3/4 + duvet,
//              health = MISSED_PICKUP (the "call today" flag), kit WITH_MEMBER.
//   t75quiet   ESSENTIALS, cycle 25 days in, ZERO usage → UNUSED_RISK (the
//              "nudge before the month runs out" flag).
// Ledger rows accompany every movement so the drill-down has history.
// The battery then BOOKS a real pickup through the API (counter 3→4), cancels
// it (refund → 3), and re-cancels (idempotency — stays 3).
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

  // ----- People -----
  const adminHash = await bcrypt.hash('T75Admin!2026', 10)
  const admin = await db.user.upsert({
    where: { email: 't75admin@kozy.test' },
    update: { passwordHash: adminHash, role: 'ADMIN', accessStatus: 'ACTIVE', mustChangePassword: false },
    create: {
      email: 't75admin@kozy.test',
      name: 'T75 Admin',
      phone: '+2347000000081',
      role: 'ADMIN',
      passwordHash: adminHash,
      emailVerified: new Date(),
    },
  })
  const riderHash = await bcrypt.hash('T75Rider!2026', 10)
  const rider = await db.user.upsert({
    where: { email: 't75rider@kozy.test' },
    update: { passwordHash: riderHash, role: 'DRIVER', accessStatus: 'ACTIVE', mustChangePassword: false },
    create: {
      email: 't75rider@kozy.test',
      name: 'T75 Rider',
      phone: '+2347000000082',
      role: 'DRIVER',
      passwordHash: riderHash,
      emailVerified: new Date(),
    },
  })
  const memberHash = await bcrypt.hash('T75Member!2026', 10)
  const member = await db.user.upsert({
    where: { email: 't75member@kozy.test' },
    update: { passwordHash: memberHash, role: 'B2C' },
    create: {
      email: 't75member@kozy.test',
      name: 'Amara Okafor',
      phone: '+2347000000083',
      role: 'B2C',
      passwordHash: memberHash,
      emailVerified: new Date(),
      address: '12 Admiralty Way, Lekki Phase 1, Lagos',
    },
  })
  const quietHash = await bcrypt.hash('T75Quiet!2026', 10)
  const quiet = await db.user.upsert({
    where: { email: 't75quiet@kozy.test' },
    update: { passwordHash: quietHash, role: 'B2C' },
    create: {
      email: 't75quiet@kozy.test',
      name: 'Bode Solana',
      phone: '+2347000000084',
      role: 'B2C',
      passwordHash: quietHash,
      emailVerified: new Date(),
      address: '4 Allen Avenue, Ikeja, Lagos',
    },
  })

  // ----- Clean slate for this battery's subscriptions + their orders -----
  const oldSubs = await db.subscription.findMany({
    where: { userId: { in: [member.id, quiet.id] } },
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
  await db.subscription.deleteMany({ where: { userId: { in: [member.id, quiet.id] } } })

  // ----- The busy member: HOUSEHOLD, cycle day 10 of 30 -----
  const now = new Date()
  const memberStart = new Date(now.getTime() - 10 * DAY)
  const memberEnd = new Date(now.getTime() + 20 * DAY)
  const memberSub = await db.subscription.create({
    data: {
      userId: member.id,
      planId: household.id,
      status: 'ACTIVE',
      periodStart: memberStart,
      periodEnd: memberEnd,
      pricePaid: 50000,
      paymentMethod: 'BANK_TRANSFER',
      unitsUsed: 3, // ORD1 (delivered) + ORD2 (upcoming) + ORD3 (missed)
      duvetsUsed: 1, // ORD4
      usageCycleKey: 'seed',
      usageQuarterKey: `${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`,
      usageYearKey: String(now.getFullYear()),
      kitState: 'WITH_MEMBER',
      kitDeliveredAt: new Date(now.getTime() - 9 * DAY),
    },
  })

  const mk = async (opts: {
    number: string
    status: any
    pickupDate: Date
    pickedUpAt?: Date | null
    deliveredAt?: Date | null
    manifest: Array<{ id: string; name: string; quantity: number; unitPrice: number }>
    createdAt: Date
  }) =>
    db.order.create({
      data: {
        orderNumber: opts.number,
        userId: member.id,
        status: opts.status,
        type: 'ITEM',
        guaranteeActive: false,
        serviceSpeed: 'STANDARD',
        modeOfWash: 'MACHINE',
        deliveryFee: 0,
        itemsManifest: JSON.stringify(opts.manifest),
        totalPrice: 0,
        subscriptionId: memberSub.id,
        pickupAddress: '12 Admiralty Way, Lekki Phase 1, Lagos',
        pickupDate: opts.pickupDate,
        pickupTimeSlot: '09:00 - 10:00',
        deliveryAddress: '12 Admiralty Way, Lekki Phase 1, Lagos',
        ...(opts.pickedUpAt ? { pickedUpAt: opts.pickedUpAt } : {}),
        ...(opts.deliveredAt ? { deliveredAt: opts.deliveredAt, deliveryDate: opts.deliveredAt } : {}),
        createdAt: opts.createdAt,
      },
    })

  // ORD1 — delivered bag pickup (7 days ago) → the LAST pickup fact
  const ord1 = await mk({
    number: 'KZ-750001',
    status: 'DELIVERED',
    pickupDate: new Date(now.getTime() - 7 * DAY),
    pickedUpAt: new Date(now.getTime() - 7 * DAY),
    deliveredAt: new Date(now.getTime() - 4 * DAY),
    manifest: [{ id: 'member_unit', name: 'Kozy Box — wash & fold (The Household)', quantity: 1, unitPrice: 0 }],
    createdAt: new Date(now.getTime() - 8 * DAY),
  })
  // ORD2 — upcoming bag pickup (+5 days) → the NEXT pickup fact
  const ord2 = await mk({
    number: 'KZ-750002',
    status: 'REQUESTED',
    pickupDate: new Date(now.getTime() + 5 * DAY),
    manifest: [{ id: 'member_unit', name: 'Kozy Box — wash & fold (The Household)', quantity: 1, unitPrice: 0 }],
    createdAt: new Date(now.getTime() - 1 * DAY),
  })
  // ORD3 — MISSED bag pickup (3 days ago, never collected)
  const ord3 = await mk({
    number: 'KZ-750003',
    status: 'REQUESTED',
    pickupDate: new Date(now.getTime() - 3 * DAY),
    manifest: [{ id: 'member_unit', name: 'Kozy Box — wash & fold (The Household)', quantity: 1, unitPrice: 0 }],
    createdAt: new Date(now.getTime() - 5 * DAY),
  })
  // ORD4 — delivered duvet perk (6 days ago)
  const ord4 = await mk({
    number: 'KZ-750004',
    status: 'DELIVERED',
    pickupDate: new Date(now.getTime() - 6 * DAY),
    pickedUpAt: new Date(now.getTime() - 6 * DAY),
    deliveredAt: new Date(now.getTime() - 3 * DAY),
    manifest: [{ id: 'member_perk_duvet', name: 'Duvet wash — included (The Household)', quantity: 1, unitPrice: 0 }],
    createdAt: new Date(now.getTime() - 7 * DAY),
  })

  // The ledger behind those counters
  await db.subscriptionEvent.createMany({
    data: [
      {
        subscriptionId: memberSub.id,
        kind: 'CYCLE_START',
        delta: 0,
        count: 0,
        meta: JSON.stringify({ periodStart: memberStart.toISOString(), periodEnd: memberEnd.toISOString(), pricePaid: 50000, method: 'BANK_TRANSFER', renewal: false }),
      },
      { subscriptionId: memberSub.id, kind: 'KIT_DELIVERED', delta: 0, count: 0, note: 'Kit handed over with the first member pickup', orderId: ord1.id },
      { subscriptionId: memberSub.id, kind: 'UNIT', delta: 1, count: 1, meta: JSON.stringify({ includedUnits: 1, extraUnits: 0 }), note: 'Booked by member', orderId: ord1.id },
      { subscriptionId: memberSub.id, kind: 'DUVET', delta: 1, count: 1, note: 'Booked by member', orderId: ord4.id },
      { subscriptionId: memberSub.id, kind: 'UNIT', delta: 1, count: 1, meta: JSON.stringify({ includedUnits: 1, extraUnits: 0 }), note: 'Booked by member', orderId: ord3.id },
      { subscriptionId: memberSub.id, kind: 'UNIT', delta: 1, count: 1, meta: JSON.stringify({ includedUnits: 1, extraUnits: 0 }), note: 'Booked by member', orderId: ord2.id },
    ],
  })

  // ----- The quiet member: ESSENTIALS, cycle day 25 of 30, ZERO usage -----
  const quietStart = new Date(now.getTime() - 25 * DAY)
  const quietEnd = new Date(now.getTime() + 5 * DAY)
  const quietSub = await db.subscription.create({
    data: {
      userId: quiet.id,
      planId: essentials.id,
      status: 'ACTIVE',
      periodStart: quietStart,
      periodEnd: quietEnd,
      pricePaid: 30000,
      paymentMethod: 'BANK_TRANSFER',
      unitsUsed: 0,
      usageCycleKey: 'seed',
      usageQuarterKey: `${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`,
      usageYearKey: String(now.getFullYear()),
      kitState: 'WITH_MEMBER',
      kitDeliveredAt: new Date(now.getTime() - 24 * DAY),
    },
  })
  await db.subscriptionEvent.create({
    data: {
      subscriptionId: quietSub.id,
      kind: 'CYCLE_START',
      delta: 0,
      count: 0,
      meta: JSON.stringify({ periodStart: quietStart.toISOString(), periodEnd: quietEnd.toISOString(), pricePaid: 30000, method: 'BANK_TRANSFER', renewal: false }),
    },
  })

  console.log('T75 seed complete:')
  console.log(`  member sub ${memberSub.id} (HOUSEHOLD, 3/4 units, missed pickup present)`)
  console.log(`  quiet  sub ${quietSub.id} (ESSENTIALS, 0/4 units, UNUSED_RISK)`)
  console.log(`  admin=${admin.email} rider=${rider.email}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .then(() => process.exit(0))
