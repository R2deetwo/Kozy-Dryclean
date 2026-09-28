// =============================================================================
// Task 72 local seed — the rider-pay + partner-pipeline battery's data.
// =============================================================================
// Riders, orders with completed legs (the earnings ledger's raw material),
// a pending partner application, and one order already routed to that
// partner (fulfilledByPartnerId) so the portal has a wash to work.
// Legs seeded: A:PICKED_UP, B:PICKED_UP+DELIVERED, C:PICKED_UP → 4 legs.
// At the new default rates (500/500) the rider's computed earnings = ₦2,000.
// =============================================================================
import { db } from '../src/lib/db'
import bcrypt from 'bcryptjs'

async function main() {
  // ----- Admin -----
  const adminEmail = 't72admin@kozy.test'
  const adminHash = await bcrypt.hash('T72Admin!2026', 10)
  const admin = await db.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash: adminHash, role: 'ADMIN', emailVerified: new Date(), accessStatus: 'ACTIVE', mustChangePassword: false },
    create: {
      email: adminEmail,
      name: 'T72 Admin',
      phone: '+2347000000001',
      role: 'ADMIN',
      passwordHash: adminHash,
      emailVerified: new Date(),
    },
  })

  // ----- Rider -----
  const riderEmail = 't72rider@kozy.test'
  const riderHash = await bcrypt.hash('T72Rider!2026', 10)
  const rider = await db.user.upsert({
    where: { email: riderEmail },
    update: { passwordHash: riderHash, role: 'DRIVER', emailVerified: new Date(), accessStatus: 'ACTIVE', mustChangePassword: false, bankName: null, bankAccountNumber: null, bankAccountName: null },
    create: {
      email: riderEmail,
      name: 'T72 Rider',
      phone: '+2347000000002',
      role: 'DRIVER',
      passwordHash: riderHash,
      emailVerified: new Date(),
    },
  })

  // ----- Customer -----
  const custEmail = 't72cust@kozy.test'
  const custHash = await bcrypt.hash('T72Cust!2026', 10)
  const cust = await db.user.upsert({
    where: { email: custEmail },
    update: { passwordHash: custHash, role: 'B2C', emailVerified: new Date() },
    create: {
      email: custEmail,
      name: 'T72 Customer',
      phone: '+2347000000003',
      role: 'B2C',
      passwordHash: custHash,
      emailVerified: new Date(),
    },
  })

  // ----- Branch (for the approve flow) -----
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

  // ----- Clean slate for this battery's orders/events/payouts -----
  const oldOrders = await db.order.findMany({
    where: { orderNumber: { in: ['KZ-T72A', 'KZ-T72B', 'KZ-T72C'] } },
    select: { id: true },
  })
  if (oldOrders.length > 0) {
    await db.statusEvent.deleteMany({ where: { orderId: { in: oldOrders.map((o) => o.id) } } })
    await db.order.deleteMany({ where: { id: { in: oldOrders.map((o) => o.id) } } })
  }
  await db.riderPayout.deleteMany({ where: { riderId: rider.id } })
  await db.partnerSettlement.deleteMany({})
  // Idempotency: the phase-A verify script applies with throwaway businesses;
  // wipe every partner EXCEPT the seeded one so the duplicate-email guard
  // never trips on a previous run.
  await db.partner.deleteMany({ where: { email: { not: 't72laundry@kozy.test' } } })

  const manifest = JSON.stringify([
    { id: 'shirts', name: 'Shirt (cotton)', quantity: 3, unitPrice: 1500 },
    { id: 'trousers', name: 'Trousers', quantity: 2, unitPrice: 2000 },
  ])

  const mkOrder = (number: string, status: any, extra: any = {}) => ({
    orderNumber: number,
    userId: cust.id,
    driverId: rider.id,
    status,
    type: 'ITEM',
    pickupAddress: '12 Admiralty Way, Lekki Phase 1, Lagos',
    pickupDate: new Date(Date.now() - 2 * 86400000),
    pickupTimeSlot: '08:00 – 10:00',
    itemsManifest: manifest,
    serviceSpeed: 'STANDARD',
    totalPrice: 10000,
    ...extra,
  })

  // Order A — picked up (1 leg)
  const a = await db.order.create({
    data: mkOrder('KZ-T72A', 'PICKED_UP', { pickedUpAt: new Date(Date.now() - 86400000) }),
  })
  await db.statusEvent.create({
    data: { orderId: a.id, actorId: rider.id, status: 'PICKED_UP', note: 'seed' },
  })

  // Order B — delivered (2 legs)
  const b = await db.order.create({
    data: mkOrder('KZ-T72B', 'DELIVERED', {
      pickedUpAt: new Date(Date.now() - 3 * 86400000),
      deliveredAt: new Date(Date.now() - 86400000),
    }),
  })
  await db.statusEvent.createMany({
    data: [
      { orderId: b.id, actorId: rider.id, status: 'PICKED_UP', note: 'seed' },
      { orderId: b.id, actorId: rider.id, status: 'DELIVERED', note: 'seed' },
    ],
  })

  // ----- Partner application (PENDING) -----
  const partner = await db.partner.upsert({
    where: { email: 't72laundry@kozy.test' },
    update: { status: 'PENDING', userId: null, refCode: 'KZP-TST1', lga: 'Lekki', servicesOffered: 'Wash & fold, Dry cleaning' },
    create: {
      businessName: 'T72 Sparkle Laundry',
      contactName: 'T72 Partner',
      email: 't72laundry@kozy.test',
      phone: '+2348030000001',
      address: '12 Admiralty Way, Lekki Phase 1, Lagos',
      lga: 'Lekki',
      servicesOffered: 'Wash & fold, Dry cleaning',
      capacityNotes: 'Two washers, one dryer, three staff.',
      refCode: 'KZP-TST1',
      status: 'PENDING',
    },
  })

  // Order C — picked up and routed to the partner (1 leg + the partner's
  // first wash to work). Stays in PICKED_UP so the portal's first action
  // ("We've received it") is live.
  const c = await db.order.create({
    data: {
      ...mkOrder('KZ-T72C', 'PICKED_UP', { pickedUpAt: new Date(Date.now() - 4 * 3600000) }),
      fulfilledByPartnerId: partner.id,
    },
  })
  await db.statusEvent.create({
    data: { orderId: c.id, actorId: rider.id, status: 'PICKED_UP', note: 'seed' },
  })

  // Remove any partner login created by a previous run (approve test re-runs).
  const oldPartnerUsers = await db.user.findMany({ where: { role: 'PARTNER' } })
  if (oldPartnerUsers.length > 0) {
    await db.user.deleteMany({ where: { id: { in: oldPartnerUsers.map((u) => u.id) } } })
  }

  console.log(
    JSON.stringify({
      admin: admin.email,
      rider: rider.id,
      riderEmail: riderEmail,
      partnerId: partner.id,
      partnerEmail: partner.email,
      orderC: c.id,
      branchId: chevron.id,
    })
  )
  process.exit(0)
}

main().catch((e) => {
  console.error('seed failed:', e)
  process.exit(1)
})
