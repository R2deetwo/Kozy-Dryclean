// Phase 10 — add Women's Wear items (+ women's underwear) to PriceCatalog
// Same pattern as seed-new-items.ts: idempotent, skips rows that already exist.
import { db } from '../src/lib/db'

const NEW_ITEMS = [
  { itemKey: 'blouse', label: 'Blouse', unitPrice: 1800, category: "Women's Wear" },
  { itemKey: 'skirt', label: 'Skirt', unitPrice: 1800, category: "Women's Wear" },
  { itemKey: 'womens-dress', label: 'Dress', unitPrice: 2500, category: "Women's Wear" },
  { itemKey: 'lace-gown', label: 'Lace / Aso-Ebi Gown', unitPrice: 5000, category: "Women's Wear" },
  { itemKey: 'jumpsuit', label: 'Jumpsuit', unitPrice: 2200, category: "Women's Wear" },
  { itemKey: 'gele', label: 'Gele (Headwrap)', unitPrice: 1500, category: "Women's Wear" },
  { itemKey: 'womens-underwear', label: 'Women\u2019s Underwear', unitPrice: 500, category: 'Extras' },
]

async function main() {
  console.log('Adding Women\u2019s Wear items to PriceCatalog...\n')
  for (const item of NEW_ITEMS) {
    const existing = await db.priceCatalog.findUnique({ where: { itemKey: item.itemKey } })
    if (!existing) {
      await db.priceCatalog.create({ data: { ...item, active: true } })
      console.log(`  \u2713 ${item.itemKey}: ${item.label} = \u20A6${item.unitPrice} [${item.category}]`)
    } else {
      console.log(`  - ${item.itemKey} already exists`)
    }
  }
  console.log('\n\u2705 Done')
}

main().catch(console.error).finally(() => db.$disconnect())
