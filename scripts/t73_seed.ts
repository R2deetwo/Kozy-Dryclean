// =============================================================================
// Task 73 local seed — distance-aware rider pay battery data.
// =============================================================================
// Five orders on one rider, engineered so every pricing branch is covered:
//   NEAR   Lekki stop,    Chevron branch  → 0.0 km  → base only  (₦1,500)
//   MID    VI stop,       Chevron branch  → 7.3 km  → ₦600 top-up (₦2,100)
//   CAP    Yaba stop,     Ogombo branch   → 28.8 km → capped ₦1,800 (₦3,300)
//   NOBR   Lekki stop,    NO branch link  → null km → base only  (₦1,500)
//   NOZONE Ogombo address (no zone match) → null km → base only  (₦1,500)
// NEAR also carries a DELIVERED leg (₦1,500) → earned ₦11,400 at the
// published rate card; one recorded payout of ₦2,000 → pending ₦9,400.
// =============================================================================
import { db } from '../src/lib/db'
import bcrypt from 'bcryptjs'

async function main() {
  // ----- Admin / rider / customer -----
  const adminHash = await bcrypt.hash('T73Admin!2026', 10)
  const admin = await db.user.upsert({
    where: { email: 't73admin@kozy.test' },
    update: { passwordHash: adminHash, role: 'ADMIN', accessStatus: 'ACTIVE', mustChangePassword: false },
    create: {
      email: 't73admin@kozy.test',
      name: 'T73 Admin',
      phone: '+2347000000071',
      role: 'ADMIN',
      passwordHash: adminHash,
      emailVerified: new Date(),
    },
  })

  const riderHash = await bcrypt.hash('T73Rider!2026', 10)
  const rider = await db.user.upsert({
    where: { email: 't73rider@kozy.test' },
    update: {
      passwordHash: riderHash,
      role: 'DRIVER',
      accessStatus: 'ACTIVE',
      mustChangePassword: false,
      bankName: 'GTBank',
      bankAccountNumber: '0123456789',
      bankAccountName: 'T73 Rider',
    },
    create: {
      email: 't73rider@kozy.test',
      name: 'T73 Rider',
      phone: '+2347000000072',
      role: 'DRIVER',
      passwordHash: riderHash,
      emailVerified: new Date(),
      bankName: 'GTBank',
      bankAccountNumber: '0123456789',
      bankAccountName: 'T73 Rider',
    },
  })

  const custHash = await bcrypt.hash('T73Cust!2026', 10)
  const cust = await db.user.upsert({
    where: { email: 't73cust@kozy.test' },
    update: { passwordHash: custHash, role: 'B2C' },
    create: {
      email: 't73cust@kozy.test',
      name: 'T73 Customer',
      phone: '+2347000000073',
      role: 'B2C',
      passwordHash: custHash,
      emailVerified: new Date(),
    },
  })

  // ----- Branches (Chevron island hub + Ogombo mainland hub) -----
  const chevron = await db.branch.upsert({
    where: { slug: 'chevron' },
    update: {},
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
      ownershipType: 'COMPANY',
      isDefault: true,
      sortOrder: 1,
    },
  })

  // ----- Clean slate for this battery -----
  const oldOrders = await db.order.findMany({
    where: { orderNumber: { startsWith: 'KZ-T73' } },
    select: { id: true },
  })
  if (oldOrders.length > 0) {
    await db.statusEvent.deleteMany({ where: { orderId: { in: oldOrders.map((o) => o.id) } } })
    await db.order.deleteMany({ where: { id: { in: oldOrders.map((o) => o.id) } } })
  }
  await db.riderPayout.deleteMany({ where: { riderId: rider.id } })

  const manifest = JSON.stringify([
    { id: 'shirts', name: 'Shirt (cotton)', quantity: 3, unitPrice: 1500 },
  ])

  const mkOrder = (number: string, status: any, extra: any = {}) => ({
    orderNumber: number,
    userId: cust.id,
    driverId: rider.id,
    status,
    type: 'ITEM' as const,
    pickupAddress: '12 Admiralty Way, Lekki Phase 1, Lagos',
    pickupDate: new Date(Date.now() - 2 * 86400000),
    pickupTimeSlot: '08:00 – 10:00',
    itemsManifest: manifest,
    serviceSpeed: 'STANDARD' as const,
    totalPrice: 10000,
    ...extra,
  })

  // NEAR — Lekki via Chevron: 0.0 km, base only; BOTH legs (pickup + delivery).
  const near = await db.order.create({
    data: mkOrder('KZ-T73NEAR', 'DELIVERED', {
      branchId: chevron.id,
      pickedUpAt: new Date(Date.now() - 3 * 86400000),
      deliveredAt: new Date(Date.now() - 86400000),
      deliveryAddress: '12 Admiralty Way, Lekki Phase 1, Lagos',
    }),
  })
  await db.statusEvent.createMany({
    data: [
      { orderId: near.id, actorId: rider.id, status: 'PICKED_UP', note: 'seed' },
      { orderId: near.id, actorId: rider.id, status: 'DELIVERED', note: 'seed' },
    ],
  })

  // MID — Victoria Island via Chevron: 7.3 km → ₦600 top-up.
  const mid = await db.order.create({
    data: mkOrder('KZ-T73MID', 'PICKED_UP', {
      branchId: chevron.id,
      pickupAddress: '14 Ahmadu Bello Way, Victoria Island, Lagos',
      pickedUpAt: new Date(Date.now() - 86400000),
    }),
  })
  await db.statusEvent.create({
    data: { orderId: mid.id, actorId: rider.id, status: 'PICKED_UP', note: 'seed' },
  })

  // CAP — Yaba via Ogombo: 28.8 km → distance pay capped at ₦1,800.
  const cap = await db.order.create({
    data: mkOrder('KZ-T73CAP', 'PICKED_UP', {
      branchId: ogombo.id,
      pickupAddress: '5 Herbert Macaulay Way, Yaba, Lagos',
      pickedUpAt: new Date(Date.now() - 86400000),
    }),
  })
  await db.statusEvent.create({
    data: { orderId: cap.id, actorId: rider.id, status: 'PICKED_UP', note: 'seed' },
  })

  // NOBR — Lekki stop with NO branch link: null distance → base only.
  const nobr = await db.order.create({
    data: mkOrder('KZ-T73NOBR', 'PICKED_UP', {
      pickedUpAt: new Date(Date.now() - 86400000),
    }),
  })
  await db.statusEvent.create({
    data: { orderId: nobr.id, actorId: rider.id, status: 'PICKED_UP', note: 'seed' },
  })

  // NOZONE — an address no SERVICE_ZONES keyword matches (Ogombo itself —
  // 'ogombo' is not a zone keyword): zone null → distance null → base only,
  // even with a branch linked.
  const nozone = await db.order.create({
    data: mkOrder('KZ-T73NOZONE', 'PICKED_UP', {
      branchId: ogombo.id,
      pickupAddress: 'Westsyde Drive, Ogombo, Lagos',
      pickedUpAt: new Date(Date.now() - 86400000),
    }),
  })
  await db.statusEvent.create({
    data: { orderId: nozone.id, actorId: rider.id, status: 'PICKED_UP', note: 'seed' },
  })

  // One settled payout so the pending-balance math is exercised:
  // earned 11,400 − paid 2,000 → pending 9,400.
  await db.riderPayout.create({
    data: {
      riderId: rider.id,
      amount: 2000,
      method: 'BANK_TRANSFER',
      reference: 'TRF-73-001',
      note: 'Seed payout',
    },
  })

  console.log(
    JSON.stringify({
      admin: admin.email,
      rider: rider.id,
      riderEmail: rider.email,
      customerId: cust.id,
      chevronId: chevron.id,
      ogomboId: ogombo.id,
    })
  )
  process.exit(0)
}

main().catch((e) => {
  console.error('seed failed:', e)
  process.exit(1)
})
