// =============================================================================
// Task 86 seed — the checkout→membership conversion battery's people.
//
//   t86admin@woosh.dpdns.org   the office (ADMIN) — verifies the first
//                              payment, which must book the first Bag
//   t86buyer@woosh.dpdns.org   customer, NO membership, two delivered
//                              orders in the last 60 days (₦12,000 +
//                              ₦10,500 = ₦22,500) — the email-job candidate
//                              (band: ESSENTIALS)
//   t86new@woosh.dpdns.org     customer, NO membership, NO orders — the
//                              "new customer" who sees the checkout card
//                              on their first big basket
//   t86real@example.com        customer with spend but OUTSIDE the test
//                              allowlist — Job 4 must SUPPRESS (the owner's
//                              standing rule: test sends never leave the
//                              woosh world + practiceprosystems@gmail.com)
//
// No Paystack key — the exact production condition (transfer is the path).
// No existing subscriptions for either customer — the conversion engine's
// whole subject is people WITHOUT memberships.
// =============================================================================
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()
const DAY = 24 * 60 * 60 * 1000

async function mkUser(email: string, name: string, role: string, pw: string, phone = '0803 175 5230') {
  const hash = await bcrypt.hash(pw, 10)
  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    return db.user.update({
      where: { id: existing.id },
      data: { passwordHash: hash, role, accessStatus: 'ACTIVE', mustChangePassword: false, name, emailVerified: new Date() },
    })
  }
  return db.user.create({
    data: {
      email,
      name,
      phone,
      role,
      passwordHash: hash,
      accessStatus: 'ACTIVE',
      mustChangePassword: false,
      emailVerified: new Date(),
    },
  })
}

async function main() {
  await mkUser('t86admin@woosh.dpdns.org', 'T86 Office', 'ADMIN', 'T86Admin!2026')
  const buyer = await mkUser('t86buyer@woosh.dpdns.org', 'Tim Buyer', 'B2C', 'T86Buyer!2026')
  const fresh = await mkUser('t86new@woosh.dpdns.org', 'Fola New', 'B2C', 'T86New!2026')
  const realish = await mkUser('t86real@example.com', 'Rita Realish', 'B2C', 'T86Real!2026')

  // The buyer's trailing spend: two delivered orders inside the window
  // (₦12,000 + ₦10,500 = ₦22,500 → the ESSENTIALS band).
  // The outside-allowlist customer gets one ₦17,000 order — in a band, but
  // SUPPRESSED in test mode.
  for (const u of [buyer.id, realish.id]) {
    const oldOrders = await db.order.findMany({ where: { userId: u.id, orderNumber: { startsWith: 'T86-' } } })
    for (const o of oldOrders) {
      await db.statusEvent.deleteMany({ where: { orderId: o.id } })
      await db.payment.deleteMany({ where: { orderId: o.id } })
      await db.order.delete({ where: { id: o.id } })
    }
  }
  const seeds: Array<[string, string, number, number]> = [
    ['T86-0001', buyer.id, 12000, 20],
    ['T86-0002', buyer.id, 10500, 9],
    ['T86-0003', realish.id, 17000, 12],
  ]
  for (const [n, uid, total, daysAgo] of seeds) {
    await db.order.create({
      data: {
        orderNumber: n,
        userId: uid,
        status: 'DELIVERED',
        type: 'ITEM',
        serviceSpeed: 'STANDARD',
        modeOfWash: 'MACHINE',
        deliveryFee: 0,
        itemsManifest: JSON.stringify([
          { id: 't86_hist', name: 'Historical basket (seed)', quantity: 1, unitPrice: total },
        ]),
        totalPrice: total,
        pickupAddress: '12 Alexander Avenue, Ikoyi, Lagos',
        pickupDate: new Date(Date.now() - daysAgo * DAY - DAY),
        pickupTimeSlot: '09:00 - 10:00',
        createdAt: new Date(Date.now() - daysAgo * DAY),
      },
    })
  }

  // No memberships anywhere (wipe any leftovers from a previous battery run).
  for (const u of [buyer.id, fresh.id, realish.id]) {
    const subs = await db.subscription.findMany({ where: { userId: u } })
    for (const s of subs) {
      await db.subscriptionEvent.deleteMany({ where: { subscriptionId: s.id } })
      await db.subscription.delete({ where: { id: s.id } })
    }
    await db.membershipUpsellLog.deleteMany({ where: { userId: u } })
  }

  console.log('T86 seed done: admin, buyer (₦22,500 in 60d), fresh customer, outside-allowlist customer — no memberships.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
