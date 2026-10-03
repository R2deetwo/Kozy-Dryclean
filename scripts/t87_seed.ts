// =============================================================================
// Task 87 seed — the Google-reviews + anti-harassment battery's people.
//
//   t87admin@woosh.dpdns.org    the office (ADMIN)
//   t87happy@woosh.dpdns.org    customer, order A OUT_FOR_DELIVERY (the
//                               delivered-email ask fires when the office
//                               marks it DELIVERED) — then the click-through
//                               path stops all future asks
//   t87unhappy@woosh.dpdns.org  customer, DELIVERED order 5 days ago + a
//                               private 3★ review — Job 5 must NEVER ask
//   t87optout@woosh.dpdns.org   customer, DELIVERED order 5 days ago — gets
//                               the backfill ask, then opts out via the
//                               one-tap link, and is never asked again
//   t87buyer@woosh.dpdns.org    customer, ₦22,500 in 60-day spend, no
//                               membership — the conversion email candidate
//                               (tests the pause gate both ways)
//
// The upsell pause setting is left at its self-seeded value (now+30d); the
// battery flips it to test both paused and unpaused behaviour, then
// restores. No Paystack key — transfer is the production path.
// =============================================================================
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()
const DAY = 24 * 60 * 60 * 1000

async function mkUser(email: string, name: string, role: string, pw: string) {
  const hash = await bcrypt.hash(pw, 10)
  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    return db.user.update({
      where: { id: existing.id },
      data: { passwordHash: hash, role, accessStatus: 'ACTIVE', mustChangePassword: false, name, emailVerified: new Date() },
    })
  }
  return db.user.create({
    data: { email, name, phone: '0803 175 5230', role, passwordHash: hash, accessStatus: 'ACTIVE', mustChangePassword: false, emailVerified: new Date() },
  })
}

async function cleanOrders(userId: string) {
  const orders = await db.order.findMany({ where: { userId, orderNumber: { startsWith: 'T87-' } } })
  for (const o of orders) {
    await db.statusEvent.deleteMany({ where: { orderId: o.id } })
    await db.payment.deleteMany({ where: { orderId: o.id } })
    await db.review.deleteMany({ where: { orderId: o.id } })
    await db.order.delete({ where: { id: o.id } })
  }
}

async function main() {
  await mkUser('t87admin@woosh.dpdns.org', 'T87 Office', 'ADMIN', 'T87Admin!2026')
  const happy = await mkUser('t87happy@woosh.dpdns.org', 'Happiness Okoro', 'B2C', 'T87Happy!2026')
  const unhappy = await mkUser('t87unhappy@woosh.dpdns.org', 'Uche Sad', 'B2C', 'T87Unhappy!2026')
  const optout = await mkUser('t87optout@woosh.dpdns.org', 'Opt Out', 'B2C', 'T87Optout!2026')
  const buyer = await mkUser('t87buyer@woosh.dpdns.org', 'Bisi Buyer', 'B2C', 'T87Buyer!2026')

  for (const u of [happy.id, unhappy.id, optout.id, buyer.id]) {
    await cleanOrders(u)
    await db.reviewAskState.deleteMany({ where: { userId: u } })
    await db.membershipUpsellLog.deleteMany({ where: { userId: u } })
    const subs = await db.subscription.findMany({ where: { userId: u } })
    for (const s of subs) {
      await db.subscriptionEvent.deleteMany({ where: { subscriptionId: s.id } })
      await db.subscription.delete({ where: { id: s.id } })
    }
  }
  await db.googleReview.deleteMany({})
  await db.appSetting.deleteMany({ where: { key: { in: ['google_rating', 'google_review_count', 'google_review_synced_at'] } } })

  const mkOrder = (n: string, uid: string, status: string, daysAgo: number, extra: object = {}) =>
    db.order.create({
      data: {
        orderNumber: n,
        userId: uid,
        status,
        type: 'ITEM',
        serviceSpeed: 'STANDARD',
        modeOfWash: 'MACHINE',
        deliveryFee: 0,
        itemsManifest: JSON.stringify([{ id: 't87_item', name: 'Test basket', quantity: 2, unitPrice: 3000 }]),
        totalPrice: 6000,
        pickupAddress: '5 Redemption Close, Lekki Phase 1, Lagos',
        pickupDate: new Date(Date.now() - (daysAgo + 1) * DAY),
        pickupTimeSlot: '09:00 - 10:00',
        createdAt: new Date(Date.now() - daysAgo * DAY),
        ...extra,
      },
    })

  // happy: order A out for delivery (the battery marks it DELIVERED — the
  // ask fires there), order B still REQUESTED (the battery delivers it AFTER
  // the click-through — the ask must NOT fire; lastNotifiedStage means the
  // same order can never re-notify the same stage, so a second order is the
  // honest way to test the next delivery).
  await mkOrder('T87-0001', happy.id, 'OUT_FOR_DELIVERY', 1)
  await mkOrder('T87-0006', happy.id, 'REQUESTED', 1)
  // unhappy: delivered 5 days ago.
  const unOrder = await mkOrder('T87-0002', unhappy.id, 'DELIVERED', 5, { deliveredAt: new Date(Date.now() - 5 * DAY) })
  // optout: delivered 5 days ago.
  await mkOrder('T87-0003', optout.id, 'DELIVERED', 5, { deliveredAt: new Date(Date.now() - 5 * DAY) })
  // buyer: spend for the conversion job.
  await mkOrder('T87-0004', buyer.id, 'DELIVERED', 20, { deliveredAt: new Date(Date.now() - 20 * DAY), totalPrice: 12000 })
  await mkOrder('T87-0005', buyer.id, 'DELIVERED', 9, { deliveredAt: new Date(Date.now() - 9 * DAY), totalPrice: 10500 })

  // The unhappy customer's PRIVATE 3★ review (recent) — the ask must skip them.
  await db.review.create({
    data: {
      orderId: unOrder.id,
      userId: unhappy.id,
      rating: 3,
      comment: 'A button came back loose. Disappointed.',
    },
  })

  console.log('T87 seed done: admin, happy (order out for delivery), unhappy (private 3★), optout, buyer (₦22,500/60d) — clean ask-state everywhere.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
