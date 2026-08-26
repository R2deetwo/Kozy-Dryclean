// Seed PriceCatalog from the hardcoded GARMENT_CATALOG
import { db } from '../src/lib/db'
import { GARMENT_CATALOG } from '../src/lib/types'

async function main() {
  console.log('Seeding PriceCatalog...\n')

  for (const g of GARMENT_CATALOG) {
    const existing = await db.priceCatalog.findUnique({ where: { itemKey: g.id } })
    if (!existing) {
      await db.priceCatalog.create({
        data: {
          itemKey: g.id,
          label: g.name,
          unitPrice: g.price,
          category: g.category,
          active: true,
        }
      })
      console.log(`  ✓ ${g.id}: ${g.name} = ₦${g.price}`)
    } else {
      console.log(`  - ${g.id} already exists`)
    }
  }

  console.log('\n✅ PriceCatalog seeded')
}

main().catch(console.error).finally(() => db.$disconnect())
