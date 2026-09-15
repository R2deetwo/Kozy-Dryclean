// Phase 36 — production test-data cleanup
// Removes every artifact of the phase-36 verification: test admin, test
// subscriber, test coupon, test campaign + its recipient rows, the e2e
// receipt-order reproduction, and their notification events.
import { db } from '../src/lib/db'

async function main() {
  // 1) Test campaign (+ recipients cascade)
  await db.newsletterCampaign.deleteMany({
    where: { name: { in: ['Prod Verify Campaign'] } },
  })

  // 2) Test subscriber
  await db.newsletterSubscriber.deleteMany({
    where: { email: { in: ['prod-verify@kozy-test.example'] } },
  })

  // 3) Test coupon (+ usages cascade with order delete below)
  await db.discount.deleteMany({
    where: { name: 'Prod Verify 10%' },
  })

  // 4) The e2e receipt-order reproduction (order + payment + events + user)
  const e2eUser = await db.user.findUnique({ where: { email: 'e2e-receipt@kozy-test.example' } })
  if (e2eUser) {
    const orders = await db.order.findMany({
      where: { userId: e2eUser.id },
      select: { id: true, orderNumber: true },
    })
    for (const o of orders) {
      await db.statusEvent.deleteMany({ where: { orderId: o.id } })
      await db.orderAnomaly.deleteMany({ where: { orderId: o.id } })
    }
    await db.order.deleteMany({ where: { userId: e2eUser.id } }) // cascades payments, media, review
    await db.user.delete({ where: { id: e2eUser.id } })
    console.log('removed e2e user + orders:', orders.map((o) => o.orderNumber).join(', '))
  }

  // 5) Temp admin
  await db.user.deleteMany({ where: { email: 'phase36-e2e@kozy-test.example' } })

  // 6) Test notification events (from the e2e order + the campaign send)
  await db.notificationEvent.deleteMany({
    where: {
      OR: [
        { type: 'CAMPAIGN_SENT', data: { contains: 'Prod Verify' } },
        { type: 'CAMPAIGN_SENT', title: { contains: 'Prod Verify' } },
      ],
    },
  })
  // TRANSFER_PENDING / NEW_ORDER events referencing the deleted test order
  const remaining = await db.notificationEvent.findMany({
    where: { type: { in: ['TRANSFER_PENDING', 'NEW_ORDER'] } },
    select: { id: true, data: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })
  for (const ev of remaining) {
    try {
      const data = ev.data ? JSON.parse(ev.data) : {}
      if (data.userEmail === 'e2e-receipt@kozy-test.example' || data.orderNumber === 'KZ-99694427') {
        await db.notificationEvent.delete({ where: { id: ev.id } })
      }
    } catch {
      /* not JSON */
    }
  }

  // Report final state
  const [campaigns, subscribers, coupons, testUsers, admins] = await Promise.all([
    db.newsletterCampaign.count(),
    db.newsletterSubscriber.count(),
    db.discount.count({ where: { name: 'Prod Verify 10%' } }),
    db.user.count({ where: { email: { endsWith: '@kozy-test.example' } } }),
    db.user.findMany({ where: { role: 'ADMIN' }, select: { email: true } }),
  ])
  console.log('FINAL: campaigns =', campaigns, '| subscribers =', subscribers, '| test coupons =', coupons, '| kozy-test users =', testUsers)
  console.log('ADMINS:', admins.map((a) => a.email).join(', '))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .then(() => process.exit(0))
