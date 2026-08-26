// Add new items to PriceCatalog
import { db } from '../src/lib/db'

const NEW_ITEMS = [
  { itemKey: 'towel', label: 'Towel', unitPrice: 400, category: 'Household' },
  { itemKey: 'singlet', label: 'Singlet', unitPrice: 300, category: 'Shirts' },
  { itemKey: 'mens-underwear', label: 'Men\u2019s Underwear', unitPrice: 250, category: 'Extras' },
  { itemKey: 'socks', label: 'Socks (per pair)', unitPrice: 200, category: 'Extras' },
  { itemKey: 'hats', label: 'Hat', unitPrice: 500, category: 'Extras' },
]

async function main() {
  console.log('Adding new items to PriceCatalog...\n')
  for (const item of NEW_ITEMS) {
    const existing = await db.priceCatalog.findUnique({ where: { itemKey: item.itemKey } })
    if (!existing) {
      await db.priceCatalog.create({ data: { ...item, active: true } })
      console.log(`  ✓ ${item.itemKey}: ${item.label} = ₦${item.unitPrice}`)
    } else {
      console.log(`  - ${item.itemKey} already exists`)
    }
  }
  console.log('\n✅ Done')
}

main().catch(console.error).finally(() => db.$disconnect())
