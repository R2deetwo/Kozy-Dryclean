// Phase-32 E2E cleanup: remove every test entity created by this
// verification run. The REAL staff account (chigozieubahesq@gmail.com /
// "Testerman Staff") and all real business data are never touched.
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const TEST_EMAILS = [
  'e2e-admin-phase32@kozy-test.example',
  'e2e-staff-phase32@kozy-test.example',
  'e2e-cust-phase32@kozy-test.example',
]

async function main() {
  const testUsers = await db.user.findMany({
    where: { email: { in: TEST_EMAILS } },
    select: { id: true, email: true },
  })
  console.log('test users found:', testUsers.map((u) => u.email).join(', ') || 'none')

  const testOrders = await db.order.findMany({
    where: { orderNumber: { startsWith: 'KZ-E2E32-' } },
    select: { id: true, orderNumber: true },
  })
  console.log('test orders found:', testOrders.map((o) => o.orderNumber).join(', ') || 'none')

  // Notification events for the test staff (invite + reset audits)
  const delEvents = await db.notificationEvent.deleteMany({
    where: { recipients: { contains: 'e2e-staff-phase32@kozy-test.example' } },
  })
  console.log('STAFF_INVITE events deleted:', delEvents.count)

  // Orders first (payments/statusEvents/anomalies cascade on order delete)
  const delOrders = await db.order.deleteMany({
    where: { id: { in: testOrders.map((o) => o.id) } },
  })
  console.log('orders deleted:', delOrders.count)

  // Users last (admin + staff + customer)
  const delUsers = await db.user.deleteMany({
    where: { id: { in: testUsers.map((u) => u.id) } },
  })
  console.log('users deleted:', delUsers.count)

  // ---- Final assertions: production is clean ----
  const remainingTestUsers = await db.user.count({
    where: { email: { endsWith: '@kozy-test.example' } },
  })
  const remainingAnomalies = await db.orderAnomaly.count({
    where: { order: { orderNumber: { startsWith: 'KZ-E2E32-' } } },
  })
  const remainingTestOrders = await db.order.count({
    where: { orderNumber: { startsWith: 'KZ-E2E32-' } },
  })
  const realStaff = await db.user.findMany({
    where: { role: 'STAFF' },
    select: { email: true, name: true, accessStatus: true },
  })
  console.log('FINAL CHECK — kozy-test users:', remainingTestUsers, '| test orders:', remainingTestOrders, '| test anomalies:', remainingAnomalies)
  console.log('REAL staff untouched:', realStaff.map((s) => `${s.name} (${s.email}, ${s.accessStatus})`).join(' | '))
}

main()
  .catch((e) => {
    console.error('CLEANUP FAILED:', e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
