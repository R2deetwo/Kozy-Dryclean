// Phase-29 E2E verification + cleanup for test order KZ-61596122
// 1. Prove the order + payment + notification emails landed (the exact
//    pipeline the user reported as broken: transfer notice -> emails).
// 2. Remove every trace of the test booking afterwards.
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()
const ORDER_NUMBER = 'KZ-61596122'

async function main() {
  const order = await db.order.findUnique({
    where: { orderNumber: ORDER_NUMBER },
    include: {
      payments: true,
      user: { select: { id: true, email: true, name: true, role: true } },
      statusEvents: true,
      media: true,
    },
  })
  if (!order) {
    console.log('ORDER NOT FOUND (already cleaned up?)')
    return
  }
  console.log('--- ORDER ---')
  console.log('id:', order.id, '| number:', order.orderNumber, '| status:', order.status)
  console.log('total:', order.totalPrice, '| paymentMethod on order:', order.paymentMethod)
  console.log('guest user:', order.user.email, '(role', order.user.role + ')')
  console.log('payments:', order.payments.map(p => `${p.method}/${p.status}/₦${p.amount}`).join(', ') || 'NONE')
  console.log('timeline entries:', order.statusEvents.length, '| media:', order.media.length)

  const events = await db.notificationEvent.findMany({
    where: { OR: [{ data: { contains: ORDER_NUMBER } }, { title: { contains: ORDER_NUMBER } }] },
  })
  console.log('--- NOTIFICATION EVENTS (' + events.length + ') ---')
  for (const ev of events) {
    console.log('type:', ev.type, '| emailStatus:', ev.emailStatus)
    console.log('  title:', ev.title.slice(0, 90))
    console.log('  recipients:', (ev.recipients || '').slice(0, 160))
    const detail = (ev.errorDetail || '').slice(0, 300)
    if (detail) console.log('  detail:', detail)
  }

  // ----- cleanup (test data only) -----
  console.log('--- CLEANUP ---')
  const tl = await db.statusEvent.deleteMany({ where: { orderId: order.id } })
  console.log('timeline deleted:', tl.count)
  const pay = await db.payment.deleteMany({ where: { orderId: order.id } })
  console.log('payments deleted:', pay.count)
  const med = await db.garmentMedia.deleteMany({ where: { orderId: order.id } })
  console.log('media deleted:', med.count)
  const nev = await db.notificationEvent.deleteMany({ where: { id: { in: events.map(e => e.id) } } })
  console.log('notification events deleted:', nev.count)
  await db.order.delete({ where: { id: order.id } })
  console.log('order deleted')
  // The guest account created for the test email — remove it too
  if (order.user.role === 'B2C' && order.user.email.includes('e2e.test')) {
    await db.user.delete({ where: { id: order.user.id } })
    console.log('guest test user deleted:', order.user.email)
  }
  console.log('CLEANUP COMPLETE')
}

main()
  .catch((e) => { console.error('FAILED:', e); process.exit(1) })
  .finally(() => db.$disconnect())
