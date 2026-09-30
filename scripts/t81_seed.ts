// =============================================================================
// Task 81 seed — the payment-UX battery's people.
//
//   t81admin@woosh.dpdns.org    the office (ADMIN)
//   t81pend@woosh.dpdns.org     HOUSEHOLD · PENDING_ACTIVATION · BANK_TRANSFER
//                               (the owner's screenshot persona: joined, no
//                                payment yet — the FIRST-PAYMENT BANNER at
//                                the top of the portal, the two-step
//                                transfer, the claim, the ?pay=1 deep link)
//   t81clubpend@woosh.dpdns.org SHOES2 · PENDING_ACTIVATION (club banner)
//   t81active@woosh.dpdns.org   HOUSEHOLD · ACTIVE · 25 days left
//                               (the quiet plan-change door: schedule
//                                WHOLEHOME / ESSENTIALS, undo, renewal
//                                priced on the switch target)
//   t81expiring@woosh.dpdns.org HOUSEHOLD · ACTIVE · 4 days left
//                               (the RenewalCard: two-step transfer +
//                                scheduled-switch pricing line)
//
// No Paystack key — the exact production condition (transfer is the path).
// =============================================================================
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()
const DAY = 24 * 60 * 60 * 1000

async function upsertPlan(code: string, data: any) {
  const existing = await db.subscriptionPlan.findUnique({ where: { code } })
  if (existing) {
    return db.subscriptionPlan.update({ where: { code }, data })
  }
  return db.subscriptionPlan.create({ data: { code, ...data } })
}

async function main() {
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
    isActive: true,
  })
  const household = await upsertPlan('HOUSEHOLD', {
    name: 'The Household',
    tagline: 'The whole family’s weekly load in one big box.',
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
    shoesPerMonth: 2,
    memberDiscountPct: 10,
    isActive: true,
  })
  await upsertPlan('WHOLEHOME', {
    name: 'The Whole Home',
    tagline: 'Everything in the house — the box, the duvets, the curtains.',
    family: 'KIT',
    priceMonthly: 80000,
    sortOrder: 3,
    includedUnits: 4,
    unitKind: 'box',
    unitName: 'Kozy Box',
    extraUnitPrice: 7500,
    maxExtraUnits: 2,
    replacementFee: 12000,
    duvetsPerQuarter: 3,
    curtainsPerQuarter: 6,
    springCleanPerYear: 1,
    shoesPerMonth: 5,
    memberDiscountPct: 15,
    prioritySlots: true,
    isActive: true,
  })
  const shoes2 = await upsertPlan('SHOES2', {
    name: 'Shoe Club · 2 pairs',
    tagline: 'The fortnightly freshen.',
    family: 'SHOES',
    priceMonthly: 3000,
    sortOrder: 11,
    includedUnits: 0,
    unitKind: 'pair',
    unitName: 'pair',
    extraUnitPrice: 0,
    maxExtraUnits: 0,
    replacementFee: 0,
    shoesPerMonth: 2,
    memberDiscountPct: 5,
    isActive: true,
  })
  await upsertPlan('SHOES4', {
    name: 'Shoe Club · 4 pairs',
    tagline: 'The weekly rotation.',
    family: 'SHOES',
    priceMonthly: 5000,
    sortOrder: 12,
    includedUnits: 0,
    unitKind: 'pair',
    unitName: 'pair',
    extraUnitPrice: 0,
    maxExtraUnits: 0,
    replacementFee: 0,
    shoesPerMonth: 4,
    memberDiscountPct: 5,
    isActive: true,
  })
  await upsertPlan('SHOES6', {
    name: 'Shoe Club · 6 pairs',
    tagline: 'The sneakerhead’s rotation.',
    family: 'SHOES',
    priceMonthly: 7200,
    sortOrder: 13,
    includedUnits: 0,
    unitKind: 'pair',
    unitName: 'pair',
    extraUnitPrice: 0,
    maxExtraUnits: 0,
    replacementFee: 0,
    shoesPerMonth: 6,
    memberDiscountPct: 5,
    isActive: true,
  })

  const mkUser = async (email: string, name: string, role: string, pw: string, address: string) => {
    const hash = await bcrypt.hash(pw, 10)
    return db.user.upsert({
      where: { email },
      update: { passwordHash: hash, role, accessStatus: 'ACTIVE', mustChangePassword: false },
      create: {
        email,
        name,
        phone: '+2347000000081',
        role,
        passwordHash: hash,
        emailVerified: new Date(),
        address,
      },
    })
  }
  await mkUser('t81admin@woosh.dpdns.org', 'T81 Admin', 'ADMIN', 'T81Admin!2026', 'HQ')
  await mkUser('t81pend@woosh.dpdns.org', 'Testerman Membership', 'B2C', 'T81Pend!2026', '5 Glover Road, Ikoyi, Lagos')
  await mkUser('t81clubpend@woosh.dpdns.org', 'Ada Eze', 'B2C', 'T81Club!2026', '3 Bourdillon Road, Ikoyi, Lagos')
  await mkUser('t81active@woosh.dpdns.org', 'Bola Adesanya', 'B2C', 'T81Active!2026', '7 Akin Adesola St, VI, Lagos')
  await mkUser('t81expiring@woosh.dpdns.org', 'Chuka Nwosu', 'B2C', 'T81Expiring!2026', '18 Ahmadu Bello Way, VI, Lagos')

  // Clean slate for these people's subscriptions (idempotent re-runs).
  const people = await db.user.findMany({
    where: { email: { startsWith: 't81' } },
    select: { id: true },
  })
  const ids = people.map((p) => p.id)
  if (ids.length) {
    const oldSubs = await db.subscription.findMany({ where: { userId: { in: ids } }, select: { id: true } })
    for (const s of oldSubs) {
      await db.subscriptionEvent.deleteMany({ where: { subscriptionId: s.id } })
      await db.subscription.delete({ where: { id: s.id } })
    }
  }

  const pend = await db.user.findUniqueOrThrow({ where: { email: 't81pend@woosh.dpdns.org' } })
  const clubpend = await db.user.findUniqueOrThrow({ where: { email: 't81clubpend@woosh.dpdns.org' } })
  const active = await db.user.findUniqueOrThrow({ where: { email: 't81active@woosh.dpdns.org' } })
  const expiring = await db.user.findUniqueOrThrow({ where: { email: 't81expiring@woosh.dpdns.org' } })

  const now = Date.now()
  const pendSub = await db.subscription.create({
    data: {
      userId: pend.id,
      planId: household.id,
      status: 'PENDING_ACTIVATION',
      pricePaid: 0,
      paymentMethod: 'BANK_TRANSFER',
    },
  })
  await db.subscription.update({
    where: { id: pendSub.id },
    data: { paystackRef: `SUB-${pendSub.id}` },
  })

  const clubSub = await db.subscription.create({
    data: {
      userId: clubpend.id,
      planId: shoes2.id,
      status: 'PENDING_ACTIVATION',
      pricePaid: 0,
      paymentMethod: 'BANK_TRANSFER',
      paystackRef: 'SUB-SEED-T81-CLUB',
    },
  })

  await db.subscription.create({
    data: {
      userId: active.id,
      planId: household.id,
      status: 'ACTIVE',
      pricePaid: 50000,
      paymentMethod: 'BANK_TRANSFER',
      periodStart: new Date(now - 5 * DAY),
      periodEnd: new Date(now + 25 * DAY),
      paystackRef: 'SUB-SEED-T81-ACTIVE',
    },
  })

  await db.subscription.create({
    data: {
      userId: expiring.id,
      planId: household.id,
      status: 'ACTIVE',
      pricePaid: 50000,
      paymentMethod: 'BANK_TRANSFER',
      periodStart: new Date(now - 26 * DAY),
      periodEnd: new Date(now + 4 * DAY),
      paystackRef: 'SUB-SEED-T81-EXPIRING',
    },
  })

  console.log(`seeded: pend=${pendSub.id} club=${clubSub.id} (4 subs, 5 users)`)
}

main()
  .catch((e) => {
    console.error('SEED FAILED:', e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
