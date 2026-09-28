// Phase 70 — PROD Shoe Club migration (idempotent).
// Creates the three SHOES-family plan rows (the prod plan table is not empty,
// so the app's self-seeding will not fire there). Safe to re-run.
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } })

const CLUB = [
  {
    code: 'SHOES1',
    name: 'Shoe Club · 1 pair',
    tagline: 'A fresh pair every month — picked up, cleaned, returned. No plan needed.',
    priceMonthly: 1000,
    sortOrder: 11,
    shoesPerMonth: 1,
    memberDiscountPct: 5,
  },
  {
    code: 'SHOES3',
    name: 'Shoe Club · 3 pairs',
    tagline: 'The rotation — three pairs a month, so something fresh is always ready.',
    priceMonthly: 2500,
    sortOrder: 12,
    shoesPerMonth: 3,
    memberDiscountPct: 10,
  },
  {
    code: 'SHOES5',
    name: 'Shoe Club · 5 pairs',
    tagline: 'The full rotation for sneakerheads — five pairs a month, ₦800 a pair.',
    priceMonthly: 4000,
    sortOrder: 13,
    shoesPerMonth: 5,
    memberDiscountPct: 15,
  },
]

async function main() {
  const existing = await db.subscriptionPlan.findMany()
  const byCode = new Map(existing.map((p) => [p.code, p]))

  for (const c of CLUB) {
    if (byCode.has(c.code)) {
      console.log(`SKIP    ${c.code} already present (isActive=${byCode.get(c.code)!.isActive})`)
      continue
    }
    await db.subscriptionPlan.create({
      data: {
        ...c,
        family: 'SHOES',
        isActive: true,
        includedUnits: 0,
        unitKind: 'pair',
        unitName: 'pair',
        extraUnitPrice: 0,
        maxExtraUnits: 0,
        replacementFee: 0,
        duvetsPerQuarter: 0,
        curtainsPerQuarter: 0,
        springCleanPerYear: 0,
        concierge: false,
        prioritySlots: false,
      },
    })
    console.log(`CREATED ${c.code} (${c.name}, ₦${c.priceMonthly}/mo, ${c.shoesPerMonth} pair${c.shoesPerMonth === 1 ? '' : 's'})`)
  }

  // Sanity: print the final ladder
  const all = await db.subscriptionPlan.findMany({ orderBy: { sortOrder: 'asc' } })
  console.log('\nFinal plan table:')
  for (const p of all) {
    console.log(`  ${p.code.padEnd(10)} ${p.name.padEnd(24)} fam=${p.family ?? 'KIT'} ₦${p.priceMonthly} active=${p.isActive}`)
  }
}

main()
  .catch((e) => {
    console.error('MIGRATION FAILED', e)
    process.exit(1)
  })
  .then(async () => {
    await db.$disconnect()
    process.exit(0)
  })
