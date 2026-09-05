// Phase-31 E2E cleanup: remove every trace of the staff-access verification
// from production (staff member, test admin, STAFF_INVITE notification
// events, and the no-op statusEvent the permission probe wrote).
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const STAFF_EMAIL = 'e2e-staff-phase31@kozy-test.example'
const ADMIN_EMAIL = 'e2e-admin-phase31@kozy-test.example'
const STAFF_ID = 'cmtnvxv3j0000jo04ugk4syew'

async function main() {
  // 1. StatusEvent written by the staff no-op PATCH probe (actor = test staff)
  const events = await db.statusEvent.deleteMany({ where: { actorId: STAFF_ID } })
  console.log('statusEvents removed:', events.count)

  // 2. NotificationEvents for the invite + reset (staff lifecycle audit rows)
  const notifs = await db.notificationEvent.deleteMany({
    where: { data: { contains: STAFF_EMAIL } },
  })
  console.log('notificationEvents removed:', notifs.count)

  // 3. The staff member (no orders/payments ever created by this account —
  //    staff cannot place orders, which the E2E also proved).
  const staffOrders = await db.order.count({ where: { userId: STAFF_ID } })
  const staffPayments = await db.payment.count({
    where: { verifiedById: STAFF_ID },
  })
  console.log('staff-owned orders:', staffOrders, '| payments verified by staff:', staffPayments)
  const staff = await db.user.delete({ where: { id: STAFF_ID } })
  console.log('staff deleted:', staff.email, '| role was', staff.role, '| status was', staff.accessStatus)

  // 4. The temporary test admin
  const adminOrders = await db.order.count({ where: { userId: 'cmtnvvj6a0000p5xsz3ztpqe7' } })
  console.log('test-admin-owned orders:', adminOrders)
  const admin = await db.user.delete({ where: { id: 'cmtnvvj6a0000p5xsz3ztpqe7' } })
  console.log('test admin deleted:', admin.email, '| role was', admin.role)

  // 5. Final sanity: no STAFF rows remain, no e2e users remain
  const staffLeft = await db.user.count({ where: { role: 'STAFF' } })
  const e2eLeft = await db.user.count({
    where: { email: { contains: 'kozy-test.example' } },
  })
  console.log('FINAL CHECK — STAFF rows on prod:', staffLeft, '| kozy-test users left:', e2eLeft)
}

main()
  .catch((e) => {
    console.error('CLEANUP FAILED:', e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
