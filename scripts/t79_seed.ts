// =============================================================================
// Task 79 seed — the payment-trap battery's people.
//
//   t79admin@woosh.dpdns.org    the office (ADMIN)
//   t79pending@woosh.dpdns.org  ESSENTIALS · PENDING_ACTIVATION · PAYSTACK
//                               (replicates the REAL stuck production member:
//                                joined, chose card, checkout never opened,
//                                no payment surface while pending)
//   t79clubpend@woosh.dpdns.org SHOES2 · PENDING_ACTIVATION (shoes-only trap)
//   t79active@woosh.dpdns.org   ESSENTIALS · transfer · ends in 3d
//                               (ladder regression + navy portal assertions +
//                                the NEEDS_PAYMENT summary capture)
//   t79past@woosh.dpdns.org     ESSENTIALS · transfer · ended 12h ago
//                               (PAST_DUE → the paused email capture)
//   t79fresh@woosh.dpdns.org    B2C, NO membership (the JoinDialog honesty
//                                gate — card option disabled without a key)
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
  await upsertPlan('SHOES2', {
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
  await mkUser('t79admin@woosh.dpdns.org', 'T79 Admin', 'ADMIN', 'T79Admin!2026', 'HQ')
  await mkUser('t79pending@woosh.dpdns.org', 'Kofi Mensah', 'B2C', 'T79Pending!2026', '12 Kingsway Road, Ikoyi, Lagos')
  await mkUser('t79clubpend@woosh.dpdns.org', 'Ada Eze', 'B2C', 'T79Clubpend!2026', '3 Bourdillon Road, Ikoyi, Lagos')
  await mkUser('t79active@woosh.dpdns.org', 'Bola Adesanya', 'B2C', 'T79Active!2026', '7 Akin Adesola St, VI, Lagos')
  await mkUser('t79past@woosh.dpdns.org', 'Chuka Nwosu', 'B2C', 'T79Past!2026', '18 Ahmadu Bello Way, VI, Lagos')
  await mkUser('t79fresh@woosh.dpdns.org', 'Emeka Obi', 'B2C', 'T79Fresh!2026', '9 Kingsway Road, Ikoyi, Lagos')

  // Clean slate for these people's subscriptions (idempotent re-runs).
  const people = await db.user.findMany({
    where: { email: { startsWith: 't79' } },
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

  const pending = await db.user.findUniqueOrThrow({ where: { email: 't79pending@woosh.dpdns.org' } })
  const clubpend = await db.user.findUniqueOrThrow({ where: { email: 't79clubpend@woosh.dpdns.org' } })
  const active = await db.user.findUniqueOrThrow({ where: { email: 't79active@woosh.dpdns.org' } })
  const past = await db.user.findUniqueOrThrow({ where: { email: 't79past@woosh.dpdns.org' } })

  // THE STUCK MEMBER — exactly like production's bosskhali4eva:
  // PENDING_ACTIVATION, method PAYSTACK, ref SUB-{id}, no period.
  const pendingSub = await db.subscription.create({
    data: {
      userId: pending.id,
      planId: essentials.id,
      status: 'PENDING_ACTIVATION',
      pricePaid: 0,
      paymentMethod: 'PAYSTACK',
    },
  })
  await db.subscription.update({
    where: { id: pendingSub.id },
    data: { paystackRef: `SUB-${pendingSub.id}` },
  })

  // The shoes-only trap.
  const shoesPlan = await db.subscriptionPlan.findUniqueOrThrow({ where: { code: 'SHOES2' } })
  const clubSub = await db.subscription.create({
    data: {
      userId: clubpend.id,
      planId: shoesPlan.id,
      status: 'PENDING_ACTIVATION',
      pricePaid: 0,
      paymentMethod: 'PAYSTACK',
      paystackRef: 'SUB-SEED-CLUB-PENDING',
    },
  })

  // The live member (3 days to renewal → summary email with the two buttons).
  const now = Date.now()
  await db.subscription.create({
    data: {
      userId: active.id,
      planId: essentials.id,
      status: 'ACTIVE',
      pricePaid: 30000,
      paymentMethod: 'BANK_TRANSFER',
      periodStart: new Date(now - 27 * DAY),
      periodEnd: new Date(now + 3 * DAY),
      paystackRef: 'SUB-SEED-ACTIVE-T79',
    },
  })

  // The paused member (ended 12h ago → PAST_DUE → the paused email).
  await db.subscription.create({
    data: {
      userId: past.id,
      planId: essentials.id,
      status: 'ACTIVE',
      pricePaid: 30000,
      paymentMethod: 'BANK_TRANSFER',
      periodStart: new Date(now - 31 * DAY),
      periodEnd: new Date(now - 12 * 60 * 60 * 1000),
      paystackRef: 'SUB-SEED-PAST-T79',
    },
  })

  console.log(
    `seeded: pending=${pendingSub.id} club=${clubSub.id} (4 subs, 6 users)`
  )
}

main()
  .catch((e) => {
    console.error('SEED FAILED:', e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
