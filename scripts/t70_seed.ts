// =============================================================================
// Task 70 local seed — test admin + customer with a live Shoe Club membership
// and a little branch-history so the numbers-reset has something to reset.
// =============================================================================
import { db } from '../src/lib/db'
import bcrypt from 'bcryptjs'
import { DEFAULT_PLANS, DEFAULT_SHOE_CLUB } from '../src/lib/subscriptions'

async function main() {
  const adminEmail = 't70admin@kozy.test'
  const custEmail = 't70cust@kozy.test'

  // ----- Admin -----
  const adminHash = await bcrypt.hash('T70Admin!2026', 10)
  const admin = await db.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash: adminHash, role: 'ADMIN', emailVerified: new Date() },
    create: {
      email: adminEmail,
      name: 'T70 Admin',
      phone: '+2347000000001',
      role: 'ADMIN',
      passwordHash: adminHash,
      emailVerified: new Date(),
    },
  })

  // ----- Customer (club member) -----
  const custHash = await bcrypt.hash('T70Cust!2026', 10)
  const cust = await db.user.upsert({
    where: { email: custEmail },
    update: { passwordHash: custHash, role: 'B2C', emailVerified: new Date() },
    create: {
      email: custEmail,
      name: 'T70 Customer',
      phone: '+2347000000002',
      role: 'B2C',
      passwordHash: custHash,
      emailVerified: new Date(),
    },
  })

  // ----- Branches (self-seeded by the app; create directly so the seed's
  // orders can be attributed on a brand-new database) -----
  const chevron = await db.branch.upsert({
    where: { slug: 'chevron' },
    // Clear any stats epoch from a previous test run so the reset flow
    // always starts from a clean "All-time" state.
    update: { statsResetAt: null },
    create: {
      name: 'Chevron Drive',
      slug: 'chevron',
      address: 'Paradise 3 Estate, Road 5/3, Chevron, Lagos State',
      phone: '+2348031755230',
      zoneNames: JSON.stringify(['Victoria Island', 'Ikoyi', 'Lekki']),
      lat: 6.4392,
      lng: 3.4712,
      ownershipType: 'COMPANY',
      sortOrder: 2,
    },
  })
  const ogombo = await db.branch.upsert({
    where: { slug: 'ogombo' },
    update: {},
    create: {
      name: 'Ogombo',
      slug: 'ogombo',
      address: 'No 20. Westsyde Drive, Ogombo, Lagos State',
      phone: '+2348031755230',
      zoneNames: JSON.stringify(['Ajah', 'Yaba', 'Surulere', 'Apapa', 'Festac', 'Gbagada', 'Maryland', 'Ikeja', 'Magodo']),
      lat: 6.4683,
      lng: 3.5673,
      isDefault: true,
      ownershipType: 'COMPANY',
      sortOrder: 1,
    },
  })

  // ----- Plans: upsert ALL six (3 tiers + 3 Shoe Club) — the app's
  // self-seeding only fires on a COMPLETELY empty table, so a partial table
  // (e.g. SHOES3 created by an earlier test) must be completed here. -----
  const allPlans = [...DEFAULT_PLANS, ...DEFAULT_SHOE_CLUB]
  for (const seed of allPlans) {
    await db.subscriptionPlan.upsert({
      where: { code: seed.code },
      update: { isActive: true },
      create: { ...seed },
    })
  }
  const shoes3 = await db.subscriptionPlan.findUniqueOrThrow({ where: { code: 'SHOES3' } })

  // ----- The customer's ACTIVE Shoe Club -----
  await db.subscription.deleteMany({ where: { userId: cust.id } })
  await db.subscription.create({
    data: {
      userId: cust.id,
      planId: shoes3.id,
      status: 'ACTIVE',
      periodStart: new Date(),
      periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      pricePaid: 2500,
      paymentMethod: 'BANK_TRANSFER',
      shoesUsed: 1,
      kitState: 'WITH_MEMBER',
      usageCycleKey: 'seed',
    },
  })

  // ----- A little branch history (Chevron) for the reset test -----
  await db.order.deleteMany({ where: { userId: cust.id } })
  for (let i = 0; i < 3; i++) {
    const o = await db.order.create({
      data: {
        orderNumber: `KZ-T70${i}`,
        userId: cust.id,
        status: 'DELIVERED',
        type: 'ITEM',
        serviceSpeed: 'STANDARD',
        modeOfWash: 'MACHINE',
        branchId: chevron?.id ?? null,
        itemsManifest: JSON.stringify([{ id: 'sneakers-white', name: 'Sneakers (White)', quantity: 2, unitPrice: 1500 }]),
        totalPrice: 3000,
        pickupAddress: '12 Admiralty Way, Lekki Phase 1',
        pickupDate: new Date(Date.now() - (i + 1) * 86400000),
        pickupTimeSlot: '09:00 - 10:00',
      },
    })
    await db.payment.create({
      data: { orderId: o.id, amount: 3000, method: 'BANK_TRANSFER', status: 'VERIFIED', verifiedAt: new Date() },
    })
  }

  console.log('SEEDED:')
  console.log('  admin   :', admin.email, '(T70Admin!2026)')
  console.log('  customer:', cust.email, '(T70Cust!2026) — ACTIVE Shoe Club · 3 pairs, 1 used')
  console.log('  history : 3 delivered orders + VERIFIED payments on', chevron?.name ?? '(chevron missing!)')
  console.log('  ogombo  :', ogombo?.name ?? '(missing)')
}

main()
  .catch((e) => {
    console.error('SEED FAILED', e)
    process.exit(1)
  })
  .then(() => process.exit(0))
