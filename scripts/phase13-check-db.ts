// Phase 13 pre-deploy DB check:
//   1. PriceCatalog has the 4 changed/new rows at the right prices
//   2. No leftover phase13 test order / guest user in production
import { db } from '../src/lib/db'

async function main() {
  const keys = ['sneakers-white', 'sneakers-coloured', 'sneaker-restoration', 'other-couture']
  const rows = await db.priceCatalog.findMany({ where: { itemKey: { in: keys } } })
  console.log('PriceCatalog rows:')
  const expected: Record<string, number> = {
    'sneakers-white': 1500,
    'sneakers-coloured': 1000,
    'sneaker-restoration': 5000,
    'other-couture': 0,
  }
  let ok = true
  for (const k of keys) {
    const row = rows.find((r) => r.itemKey === k)
    const good = row && row.unitPrice === expected[k] && row.active
    if (!good) ok = false
    console.log(
      `  ${good ? '✓' : '✗'} ${k.padEnd(22)} ${row ? `₦${row.unitPrice} active=${row.active}` : 'MISSING'}  (expected ₦${expected[k]})`
    )
  }
  const total = await db.priceCatalog.count({ where: { active: true } })
  console.log(`\nActive PriceCatalog rows total: ${total}`)

  const leftovers = await db.order.findMany({
    where: {
      OR: [
        { orderNumber: 'KZ-74703386' },
        { user: { email: 'phase13-quote-test@example.com' } },
      ],
    },
    select: { orderNumber: true },
  })
  console.log(
    leftovers.length === 0
      ? '✓ no leftover phase13 test orders'
      : `✗ LEFTOVER ORDERS: ${leftovers.map((o) => o.orderNumber).join(', ')}`
  )
  const guest = await db.user.findUnique({ where: { email: 'phase13-quote-test@example.com' } })
  console.log(guest ? `✗ guest user still exists (id ${guest.id})` : '✓ test guest user deleted')

  if (!ok || leftovers.length > 0 || guest) process.exit(1)
}

main()
  .catch((e) => {
    console.error('FAILED:', e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
