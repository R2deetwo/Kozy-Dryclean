// Verify the Women's Wear rows in PriceCatalog
import { db } from '../src/lib/db'

const KEYS = [
  'blouse',
  'skirt',
  'womens-dress',
  'lace-gown',
  'jumpsuit',
  'gele',
  'womens-underwear',
]

async function main() {
  const rows = await db.priceCatalog.findMany({ where: { itemKey: { in: KEYS } } })
  const map = new Map(rows.map((r) => [r.itemKey, r]))
  let ok = true
  for (const k of KEYS) {
    const r = map.get(k)
    if (!r) {
      console.log(`  MISSING ${k}`)
      ok = false
      continue
    }
    console.log(`  ${r.active ? '[active]' : '[INACTIVE]'} ${r.itemKey.padEnd(18)} ${r.label.padEnd(22)} ₦${r.unitPrice} [${r.category}]`)
  }
  const total = await db.priceCatalog.count({ where: { active: true } })
  console.log(`\nTotal active PriceCatalog rows: ${total}`)
  console.log(ok ? 'ALL 7 ROWS PRESENT' : 'INCOMPLETE — rows missing')
}

main().catch(console.error).finally(() => db.$disconnect())
