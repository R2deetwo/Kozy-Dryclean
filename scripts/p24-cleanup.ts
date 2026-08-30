// Phase-24 cleanup: remove EVERY test artifact from the production DB and
// restore the real alert recipients (both owners).
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()
const REAL_ALERTS = 'kozygarmentcare@gmail.com,practiceprosystems@gmail.com'

async function removeUserCascade(email: string) {
  const user = await db.user.findUnique({ where: { email } })
  if (!user) return 0
  const orders = await db.order.findMany({ where: { userId: user.id }, select: { id: true } })
  const orderIds = orders.map((o) => o.id)
  await db.payment.deleteMany({ where: { orderId: { in: orderIds } } })
  await db.garmentMedia.deleteMany({ where: { orderId: { in: orderIds } } })
  await db.statusEvent.deleteMany({ where: { orderId: { in: orderIds } } })
  await db.review.updateMany({ where: { approvedById: user.id }, data: { approvedById: null } })
  await db.review.deleteMany({ where: { userId: user.id } })
  await db.order.deleteMany({ where: { userId: user.id } })
  await db.driverLocation.deleteMany({ where: { driverId: user.id } })
  await db.verificationToken.deleteMany({ where: { userId: user.id } })
  await db.user.delete({ where: { id: user.id } })
  return orderIds.length
}

async function removeOrderCascade(orderId: string) {
  await db.payment.deleteMany({ where: { orderId } })
  await db.garmentMedia.deleteMany({ where: { orderId } })
  await db.statusEvent.deleteMany({ where: { orderId } })
  await db.review.deleteMany({ where: { orderId } })
  await db.order.delete({ where: { id: orderId } })
}

async function main() {
  // 1. Every .example test user (covers e2e-admin22, e2e-kanban-user, the
  //    p24-* seeds, phase22/23 form users, transfer-flow guests)
  const testUsers = await db.user.findMany({
    where: { email: { contains: 'kozy-test.example' } },
    select: { email: true },
  })
  for (const u of testUsers) {
    const n = await removeUserCascade(u.email)
    console.log(`user removed: ${u.email} (+${n} orders)`)
  }

  // 2. Stray test orders whose owner is already gone
  const strays = await db.order.findMany({
    where: { orderNumber: { startsWith: 'KZ-' } },
    select: { id: true, orderNumber: true, userId: true },
  })
  for (const o of strays) {
    const owner = await db.user.findUnique({ where: { id: o.userId } })
    if (!owner) {
      await removeOrderCascade(o.id)
      console.log(`orphan order removed: ${o.orderNumber}`)
    } else if (/^(KZ-E2E|KZ-P24)/.test(o.orderNumber)) {
      await removeOrderCascade(o.id)
      console.log(`test order removed: ${o.orderNumber}`)
    }
  }

  // 3. Test feedback rows
  const fb = await db.feedback.deleteMany({
    where: { email: { contains: 'kozy-test.example' } },
  })
  if (fb.count > 0) console.log(`feedback rows removed: ${fb.count}`)

  // 4. E2E notification events (recipients/data/title referencing the test
  //    domain — real events that occurred during the window are KEPT)
  const ev = await db.notificationEvent.deleteMany({
    where: {
      OR: [
        { recipients: { contains: 'kozy-test.example' } },
        { data: { contains: 'kozy-test.example' } },
        { body: { contains: 'kozy-test.example' } },
        { title: { contains: 'KZ-P24' } },
      ],
    },
  })
  if (ev.count > 0) console.log(`notification events removed: ${ev.count}`)

  // 5. Restore the real alert recipients
  await db.appSetting.upsert({
    where: { key: 'admin_alerts_email' },
    update: { value: JSON.stringify(REAL_ALERTS) },
    create: { key: 'admin_alerts_email', value: JSON.stringify(REAL_ALERTS) },
  })
  console.log(`admin_alerts_email restored -> ${REAL_ALERTS}`)

  const remainingUsers = await db.user.count({
    where: { email: { contains: 'kozy-test.example' } },
  })
  const remainingEvents = await db.notificationEvent.count({
    where: { recipients: { contains: 'kozy-test.example' } },
  })
  const admins = await db.user.findMany({
    where: { role: 'ADMIN' },
    select: { email: true },
    orderBy: { email: 'asc' },
  })
  console.log(
    `FINAL CHECK — test users: ${remainingUsers}, test events: ${remainingEvents}`
  )
  console.log('ADMIN accounts:', admins.map((a) => a.email).join(', '))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
