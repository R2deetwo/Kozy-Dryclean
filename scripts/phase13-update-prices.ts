// Phase 13 — update PriceCatalog on production Supabase:
//   • sneakers-white:      1000 → 1500 (white carries the premium — owner directive)
//   • sneakers-coloured:   1200 → 1000
//   • sneaker-restoration: NEW, 5000 (from-price; final quote after assessment)
//   • other-couture:       NEW, 0    (quoted item — no fixed price)
// Existing rows are UPDATED (not skipped) so the live site reflects the swap
// immediately; new rows are created if missing.
import { db } from '../src/lib/db'
import { GARMENT_CATALOG } from '../src/lib/types'

const CHANGES: Record<string, number> = {
  'sneakers-white': 1500,
  'sneakers-coloured': 1000,
  'sneaker-restoration': 5000,
  'other-couture': 0,
}

async function main() {
  console.log('Phase 13 PriceCatalog update — production DB\n')

  for (const [itemKey, unitPrice] of Object.entries(CHANGES)) {
    const catalogItem = GARMENT_CATALOG.find((g) => g.id === itemKey)
    if (!catalogItem) {
      console.log(`  ✗ ${itemKey}: NOT in GARMENT_CATALOG — aborting this row`)
      continue
    }
    const before = await db.priceCatalog.findUnique({ where: { itemKey } })
    await db.priceCatalog.upsert({
      where: { itemKey },
      create: {
        itemKey,
        label: catalogItem.name,
        unitPrice,
        category: catalogItem.category,
        active: true,
      },
      update: { unitPrice, label: catalogItem.name, category: catalogItem.category, active: true },
    })
    console.log(
      `  ✓ ${itemKey}: ${before ? `₦${before.unitPrice}` : '(new)'} → ₦${unitPrice}  [${catalogItem.name}]`
    )
  }

  // Sanity print of the full shoe + other rows after the update
  const after = await db.priceCatalog.findMany({
    where: { itemKey: { in: Object.keys(CHANGES) } },
  })
  console.log('\nRows after update:')
  for (const row of after.sort((a, b) => a.itemKey.localeCompare(b.itemKey))) {
    console.log(`  ${row.itemKey.padEnd(22)} ₦${row.unitPrice}  active=${row.active}`)
  }
  console.log('\n✅ Done')
}

main()
  .catch((e) => {
    console.error('FAILED:', e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
