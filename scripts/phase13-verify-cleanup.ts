// Phase 13 — verify the E2E quote-only order in the DB, then clean it up.
// Reads the order number written by phase13_quotes.js.
import { db } from '../src/lib/db'
import * as fs from 'fs'

const ORDER_NUMBER = fs
  .readFileSync('/home/z/my-project/download/phase13-quotes/order-number.txt', 'utf-8')
  .trim()

async function main() {
  console.log(`Verifying quote-only order #${ORDER_NUMBER}\n`)
  const order = await db.order.findFirst({ where: { orderNumber: ORDER_NUMBER }, include: { payments: true, user: true } })
  if (!order) {
    console.log('  ✗ order not found — nothing to verify or clean')
    return
  }

  const manifest = JSON.parse(order.itemsManifest as string)
  console.log('  status:      ', order.status)
  console.log('  totalPrice:  ', order.totalPrice)
  console.log('  payments:    ', order.payments.length, order.payments.map((p) => `${p.method}:${p.amount}:${p.status}`).join(', '))
  console.log('  items:')
  for (const i of manifest) console.log('   ', `• ${i.name}  qty=${i.quantity}  unitPrice=${i.unitPrice}`)

  const quoteAnnotated = manifest.some((i: { name: string }) => i.name.includes('quote to follow'))
  console.log('\n  checks:')
  console.log(`  ${manifest.every((i: { unitPrice: number }) => i.unitPrice === 0) ? '✓' : '✗'} all items priced ₦0 (quote pending)`)
  console.log(`  ${quoteAnnotated ? '✓' : '✗'} quote item annotated "quote to follow" (admin visibility)`)
  console.log(`  ${order.status === 'REQUESTED' ? '✓' : '✗'} status REQUESTED (no ₦0 payment verification queue)`)

  // ----- Cleanup: delete the order, its payments, and the guest account -----
  console.log('\nCleanup:')
  await db.payment.deleteMany({ where: { orderId: order.id } })
  await db.order.delete({ where: { id: order.id } })
  console.log(`  ✓ deleted order ${order.orderNumber}`)
  const guestEmail = 'phase13-quote-test@example.com'
  const guest = await db.user.findUnique({ where: { email: guestEmail } })
  if (guest) {
    const remaining = await db.order.count({ where: { userId: guest.id } })
    if (remaining === 0) {
      await db.user.delete({ where: { id: guest.id } })
      console.log(`  ✓ deleted guest user ${guestEmail}`)
    } else {
      console.log(`  - guest has ${remaining} other orders — user kept`)
    }
  } else {
    console.log('  - no guest user found')
  }
  console.log('\n✅ Done')
}

main()
  .catch((e) => {
    console.error('FAILED:', e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
