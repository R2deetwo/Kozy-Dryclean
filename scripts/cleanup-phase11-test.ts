// Cleanup Phase 11 API test users + orders
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

async function main() {
  const emails = ['block-test@kozy-test.ng', 'block-test2@kozy-test.ng']
  for (const email of emails) {
    const u = await db.user.findUnique({ where: { email }, include: { orders: true } })
    if (!u) { console.log(email, '— not found (already clean)'); continue }
    for (const o of u.orders) {
      await db.order.delete({ where: { id: o.id } })
      console.log('deleted order', o.orderNumber)
    }
    await db.user.delete({ where: { id: u.id } })
    console.log('deleted user', email)
  }
  console.log('orders remaining:', await db.order.count())
}

main().finally(() => db.$disconnect())
