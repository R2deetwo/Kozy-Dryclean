// Clean up the Phase 10 verification test order (+ guest user + payment rows)
import { db } from '../src/lib/db'

const TEST_EMAIL = 'phase10-verify@kozy.test'

async function main() {
  const user = await db.user.findUnique({ where: { email: TEST_EMAIL } })
  if (!user) {
    console.log('No test user found — nothing to clean.')
    return
  }
  const orders = await db.order.findMany({ where: { userId: user.id } })
  for (const o of orders) {
    await db.order.delete({ where: { id: o.id } }) // Payment/StatusEvent cascade
    console.log(`  deleted order ${o.orderNumber} (${o.id})`)
  }
  await db.user.delete({ where: { id: user.id } })
  console.log(`  deleted test user ${TEST_EMAIL}`)
  console.log('Cleanup done — production board is clean.')
}

main().catch(console.error).finally(() => db.$disconnect())
