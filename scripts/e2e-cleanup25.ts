// Cleanup for the phase-25 E2E run: removes every test artifact from the
// production DB (all .example emails that can never belong to a real person).
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const TEST_EMAILS = ['e2e-admin25@kozy-test.example', 'e2e-p25-user@kozy-test.example']

async function main() {
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
    await db.statusEvent.deleteMany({ where: { orderId: { in: orderIds } } })
    await db.review.deleteMany({ where: { userId: user.id } })
    await db.order.deleteMany({ where: { userId: user.id } })
    await db.verificationToken.deleteMany({ where: { userId: user.id } })
    await db.user.delete({ where: { id: user.id } })
    console.log(`${email}: deleted user + ${orderIds.length} order(s)`)
  }

  // Belt & braces: any stray phase-25 E2E orders whose owner was already removed
  const stray = await db.order.findMany({
    where: { orderNumber: { startsWith: 'KZ-E2EP25' } },
    select: { id: true, orderNumber: true },
  })
  for (const o of stray) {
    await db.payment.deleteMany({ where: { orderId: o.id } })
    await db.garmentMedia.deleteMany({ where: { orderId: o.id } })
    await db.statusEvent.deleteMany({ where: { orderId: o.id } })
    await db.order.delete({ where: { id: o.id } })
    console.log(`stray order removed: ${o.orderNumber}`)
  }

  // Final verification: no .example users, no E2E orders/payments remain
  const remainingUsers = await db.user.count({ where: { email: { endsWith: '.example' } } })
  const remainingOrders = await db.order.count({
    where: { orderNumber: { startsWith: 'KZ-E2E' } },
  })
  const admins = await db.user.findMany({
    where: { role: 'ADMIN' },
    select: { email: true },
  })
  console.log(`remaining .example users: ${remainingUsers}`)
  console.log(`remaining E2E orders: ${remainingOrders}`)
  console.log(`admins: ${admins.map((a) => a.email).join(', ')}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
