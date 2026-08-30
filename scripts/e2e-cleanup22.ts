// Cleanup for the phase-22 E2E run: removes every test artifact from the
// production DB (all .example emails that can never belong to a real person)
// and restores the admin-alerts email to the owner's inbox.
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const TEST_EMAILS = [
  'e2e-typo-user@kozy-test.example',
  'e2e-form-user@kozy-test.example',
  'e2e-fixed-user@kozy-test.example',
  'e2e-guest22@kozy-test.example',
  'e2e-alert-signup@kozy-test.example',
  'e2e-admin22@kozy-test.example',
  'e2e-kanban-user@kozy-test.example',
]

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

  // Belt & braces: any stray E2E orders whose owner was already removed
  const stray = await db.order.findMany({
    where: { orderNumber: { startsWith: 'KZ-E2E' } },
    select: { id: true, orderNumber: true },
  })
  for (const o of stray) {
    await db.payment.deleteMany({ where: { orderId: o.id } })
    await db.garmentMedia.deleteMany({ where: { orderId: o.id } })
    await db.statusEvent.deleteMany({ where: { orderId: o.id } })
    await db.order.delete({ where: { id: o.id } })
    console.log(`stray order removed: ${o.orderNumber}`)
  }

  // Restore the owner's alert inbox (the E2E pointed it at a test address)
  await db.appSetting.upsert({
    where: { key: 'admin_alerts_email' },
    update: { value: JSON.stringify('kozygarmentcare@gmail.com') },
    create: { key: 'admin_alerts_email', value: JSON.stringify('kozygarmentcare@gmail.com') },
  })
  console.log('admin_alerts_email restored to kozygarmentcare@gmail.com')

  const remaining = await db.user.count({ where: { email: { contains: 'kozy-test.example' } } })
  const remainingOrders = await db.order.count({ where: { orderNumber: { startsWith: 'KZ-E2E' } } })
  console.log(`FINAL CHECK — test users: ${remaining}, E2E orders: ${remainingOrders}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
