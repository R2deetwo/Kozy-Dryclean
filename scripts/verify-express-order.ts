// Verify the express test order's server-side pricing, then clean it up
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  // Find the test order (guest email starts with express-test-)
  const user = await db.user.findFirst({
    where: { email: { startsWith: 'express-test-' } },
    orderBy: { createdAt: 'desc' },
    include: { orders: { orderBy: { createdAt: 'desc' } } },
  })
  if (!user) {
    console.log('NO TEST USER FOUND')
    return
  }
  const order = user.orders[0]
  if (!order) {
    console.log('NO ORDER FOUND for', user.email)
    return
  }
  const items = JSON.parse(order.itemsManifest || '[]')
  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
  console.log('=== EXPRESS TEST ORDER (server-side truth) ===')
  console.log('orderNumber:      ', order.orderNumber)
  console.log('serviceSpeed:     ', order.serviceSpeed)
  console.log('items:            ', items.map((i) => `${i.quantity}x ${i.name} @${i.unitPrice}`).join(', '))
  console.log('subtotal:         ', subtotal)
  console.log('totalPrice:       ', order.totalPrice)
  const surcharge = Math.round(subtotal * 0.5)
  const expectedNoDiscount = subtotal + surcharge
  const expectedSignup5 = Math.round(expectedNoDiscount * 0.95)
  console.log('expected (no discount):   ', expectedNoDiscount)
  console.log('expected (5% signup):     ', expectedSignup5)
  console.log('PASS:', order.totalPrice === expectedNoDiscount || order.totalPrice === expectedSignup5)

  // ---- Cleanup: delete test order + guest user (keep production board clean) ----
  await db.order.delete({ where: { id: order.id } })
  await db.user.delete({ where: { id: user.id } })
  console.log('CLEANED UP: order + guest user deleted')

  // ---- Also verify the EXPRESS_24 household block ----
  const remaining = await db.order.count()
  console.log('orders remaining in DB:', remaining)
}

main().finally(() => db.$disconnect())
