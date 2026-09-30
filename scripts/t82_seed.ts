// =============================================================================
// Task 82 seed — the session/claims/cancellation battery's people.
//
//   t82admin@woosh.dpdns.org     the office (ADMIN)
//   t82both@woosh.dpdns.org      ACTIVE HOUSEHOLD + ACTIVE SHOES4 — the
//                                "laundry AND shoe care" dash edge case
//   t82claim@woosh.dpdns.org     ACTIVE ESSENTIALS + an OPEN 3-month transfer
//                                claim (the "nothing on the admin side" fix)
//   t82stale@woosh.dpdns.org     PENDING_ACTIVATION, joined 20 days ago, no
//                                claim — the stuck signup (nudge + banner
//                                claim persistence + withdraw guard)
//   t82withdraw@woosh.dpdns.org  PENDING_ACTIVATION, fresh, no claim — the
//                                withdraw-request escape hatch + re-join
//   t82cancel@woosh.dpdns.org    ACTIVE + cancelAtPeriodEnd + periodEnd
//                                yesterday — the sweep must apply CANCELLED
//   t82del@woosh.dpdns.org       PENDING member with ledger rows — the FK
//                                deletion fix (memberships die with the user)
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
  const shoes4 = await upsertPlan('SHOES4', {
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

  const mkUser = async (email: string, name: string, role: string, pw: string, address: string) => {
    const hash = await bcrypt.hash(pw, 10)
    return db.user.upsert({
      where: { email },
      update: { passwordHash: hash, role, accessStatus: 'ACTIVE', mustChangePassword: false },
      create: {
        email,
        name,
        phone: '+2347000000082',
        role,
        passwordHash: hash,
        emailVerified: new Date(),
        address,
      },
    })
  }
  await mkUser('t82admin@woosh.dpdns.org', 'T82 Admin', 'ADMIN', 'T82Admin!2026', 'HQ')
  await mkUser('t82both@woosh.dpdns.org', 'Fade Ogun', 'B2C', 'T82Both!2026', '12 Glover Road, Ikoyi, Lagos')
  await mkUser('t82claim@woosh.dpdns.org', 'Nnamdi Kalu', 'B2C', 'T82Claim!2026', '4 Bourdillon Road, Ikoyi, Lagos')
  await mkUser('t82stale@woosh.dpdns.org', 'Amaka Obi', 'B2C', 'T82Stale!2026', '9 Akin Adesola St, VI, Lagos')
  await mkUser('t82withdraw@woosh.dpdns.org', 'Tunde Bakare', 'B2C', 'T82With!2026', '22 Ahmadu Bello Way, VI, Lagos')
  await mkUser('t82cancel@woosh.dpdns.org', 'Chidi Okoro', 'B2C', 'T82Cancel!2026', '5 Ozumba Mbadiwe, VI, Lagos')
  await mkUser('t82del@woosh.dpdns.org', 'Zainab Musa', 'B2C', 'T82Del!2026', '1 Falomo Bridge Road, Ikoyi, Lagos')

  // Clean slate for these people's subscriptions (idempotent re-runs).
  const people = await db.user.findMany({
    where: { email: { startsWith: 't82' } },
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

  const both = await db.user.findUniqueOrThrow({ where: { email: 't82both@woosh.dpdns.org' } })
  const claim = await db.user.findUniqueOrThrow({ where: { email: 't82claim@woosh.dpdns.org' } })
  const stale = await db.user.findUniqueOrThrow({ where: { email: 't82stale@woosh.dpdns.org' } })
  const withdraw = await db.user.findUniqueOrThrow({ where: { email: 't82withdraw@woosh.dpdns.org' } })
  const cancel = await db.user.findUniqueOrThrow({ where: { email: 't82cancel@woosh.dpdns.org' } })
  const del = await db.user.findUniqueOrThrow({ where: { email: 't82del@woosh.dpdns.org' } })

  const now = Date.now()

  // t82both — both families live (plus a minted kit tag for the privacy
  // battery: the QR destination must show nothing personal to a stranger).
  await db.subscription.create({
    data: {
      userId: both.id,
      planId: household.id,
      status: 'ACTIVE',
      pricePaid: 50000,
      paymentMethod: 'BANK_TRANSFER',
      periodStart: new Date(now - 5 * DAY),
      periodEnd: new Date(now + 25 * DAY),
      unitsUsed: 1,
      shoesUsed: 1,
      kitTag: 'KZK-T82BTH',
      kitState: 'WITH_MEMBER',
      paystackRef: 'SUB-SEED-T82-BOTH',
    },
  })
  const bothClub = await db.subscription.create({
    data: {
      userId: both.id,
      planId: shoes4.id,
      status: 'ACTIVE',
      pricePaid: 5000,
      paymentMethod: 'BANK_TRANSFER',
      periodStart: new Date(now - 5 * DAY),
      periodEnd: new Date(now + 25 * DAY),
      shoesUsed: 1,
      paystackRef: 'SUB-SEED-T82-BOTH-CLUB',
    },
  })
  void bothClub

  // t82claim — live Essentials + an OPEN 3-month claim (₦85,000)
  const claimSub = await db.subscription.create({
    data: {
      userId: claim.id,
      planId: essentials.id,
      status: 'ACTIVE',
      pricePaid: 30000,
      paymentMethod: 'BANK_TRANSFER',
      periodStart: new Date(now - 10 * DAY),
      periodEnd: new Date(now + 20 * DAY),
      paystackRef: 'SUB-SEED-T82-CLAIM',
    },
  })
  await db.subscriptionEvent.create({
    data: {
      subscriptionId: claimSub.id,
      kind: 'RENEWAL_INTENT',
      delta: 0,
      count: 0,
      meta: JSON.stringify({
        months: 3,
        amount: 85000,
        isInitial: false,
        reference: 'KZY-RENEW-T82TEST1',
        receipt: 'none',
        planCode: 'ESSENTIALS',
      }),
      note: "Member said they've paid a 3-month renewal (KZY-RENEW-T82TEST1)",
      createdAt: new Date(now - 2 * DAY),
    },
  })

  // t82stale — joined 20 days ago, never paid (the stuck signup)
  const staleSub = await db.subscription.create({
    data: {
      userId: stale.id,
      planId: essentials.id,
      status: 'PENDING_ACTIVATION',
      pricePaid: 0,
      paymentMethod: 'BANK_TRANSFER',
      paystackRef: 'SUB-SEED-T82-STALE',
      createdAt: new Date(now - 20 * DAY),
    },
  })
  void staleSub

  // t82withdraw — fresh pending request, no claim
  await db.subscription.create({
    data: {
      userId: withdraw.id,
      planId: essentials.id,
      status: 'PENDING_ACTIVATION',
      pricePaid: 0,
      paymentMethod: 'BANK_TRANSFER',
      paystackRef: 'SUB-SEED-T82-WITHDRAW',
    },
  })

  // t82cancel — asked to rest; period ended yesterday
  const cancelSub = await db.subscription.create({
    data: {
      userId: cancel.id,
      planId: essentials.id,
      status: 'ACTIVE',
      pricePaid: 30000,
      paymentMethod: 'BANK_TRANSFER',
      periodStart: new Date(now - 31 * DAY),
      periodEnd: new Date(now - 1 * DAY),
      cancelAtPeriodEnd: true,
      cancelledAt: new Date(now - 3 * DAY),
      cancelledReason: 'Member chose not to renew — runs to period end',
      paystackRef: 'SUB-SEED-T82-CANCEL',
    },
  })
  await db.subscriptionEvent.create({
    data: {
      subscriptionId: cancelSub.id,
      kind: 'CANCELLATION_SCHEDULED',
      delta: 0,
      count: 0,
      note: 'Member asked for the membership to rest at period end.',
      createdAt: new Date(now - 3 * DAY),
    },
  })

  // t82del — pending member WITH ledger rows (the FK deletion blocker)
  const delSub = await db.subscription.create({
    data: {
      userId: del.id,
      planId: essentials.id,
      status: 'PENDING_ACTIVATION',
      pricePaid: 0,
      paymentMethod: 'BANK_TRANSFER',
      paystackRef: 'SUB-SEED-T82-DEL',
    },
  })
  await db.subscriptionEvent.create({
    data: {
      subscriptionId: delSub.id,
      kind: 'RENEWAL_INTENT',
      delta: 0,
      count: 0,
      meta: JSON.stringify({ months: 1, amount: 30000, isInitial: true, reference: 'KZY-RENEW-T82DEL1' }),
      note: 'Member is completing their FIRST month — activate when the transfer lands.',
    },
  })

  console.log('seeded: 7 users, 7 subscriptions (t82 battery ready)')
}

main()
  .catch((e) => {
    console.error('SEED FAILED:', e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
