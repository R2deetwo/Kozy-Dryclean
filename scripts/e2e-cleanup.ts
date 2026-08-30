// One-off cleanup: remove E2E test artifacts from the production DB.
// Usage: bun run scripts/e2e-cleanup.ts [orderNumber]
// Without an orderNumber, removes ALL orders owned by the two test users and
// the test users themselves (e2e guest + e2e admin). Safe: those emails are
// reserved .example domains that can never receive mail or be registered by
// a real person.
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const TEST_EMAILS = ['e2e-transfer-test@kozy-test.example', 'e2e-receipt-test@kozy-test.example', 'e2e-admin@kozy-test.example']

async function main() {
  const orderNumber = process.argv[2]
  if (orderNumber) {
    const order = await db.order.findUnique({ where: { orderNumber }, include: { payments: true, media: true } })
    if (!order) {
      console.log(`Order ${orderNumber} not found (already clean)`)
      return
    }
    await db.payment.deleteMany({ where: { orderId: order.id } })
    await db.garmentMedia.deleteMany({ where: { orderId: order.id } })
    await db.statusEvent.deleteMany({ where: { orderId: order.id } }).catch(() => {})
    await db.order.delete({ where: { id: order.id } })
    console.log(`Deleted order ${orderNumber} (+${order.payments.length} payments)`)
    return
  }

  for (const email of TEST_EMAILS) {
    const user = await db.user.findUnique({ where: { email } })
    if (!user) {
      console.log(`${email}: not present`)
      continue
    }
    const orders = await db.order.findMany({ where: { userId: user.id }, select: { id: true } })
    const orderIds = orders.map((o) => o.id)
    await db.payment.deleteMany({ where: { orderId: { in: orderIds } } })
    await db.garmentMedia.deleteMany({ where: { orderId: { in: orderIds } } })
    await db.statusEvent.deleteMany({ where: { orderId: { in: orderIds } } }).catch(() => {})
    await db.order.deleteMany({ where: { userId: user.id } })
    await db.review.deleteMany({ where: { userId: user.id } }).catch(() => {})
    await db.feedback.deleteMany({ where: { email } }).catch(() => {})
    
    await db.user.delete({ where: { id: user.id } })
    console.log(`${email}: deleted user + ${orderIds.length} order(s)`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
// (test users list covers both e2e guests + e2e admin)
