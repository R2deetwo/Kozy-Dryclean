// Phase 66 — PROD plan-ladder migration (idempotent).
// Renames CONCIERGE -> WHOLEHOME (the size tier), inserts ATELIER (the
// couture care tier), refreshes the plain-language taglines. Safe to re-run.
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } })

async function main() {
  const existing = await db.subscriptionPlan.findMany()
  const byCode = new Map(existing.map((p) => [p.code, p]))

  // 1. CONCIERGE -> WHOLEHOME (rename in place; subscriptions reference planId)
  const concierge = byCode.get('CONCIERGE')
  if (concierge) {
    await db.subscriptionPlan.update({
      where: { id: concierge.id },
      data: {
        code: 'WHOLEHOME',
        name: 'The Whole Home',
        tagline: 'Everything in the house — the box, the duvets, the curtains, and one deep clean a year.',
        concierge: false, // the designer-care flag now belongs to The Atelier only
        sortOrder: 3,
      },
    })
    console.log('RENAMED  CONCIERGE -> WHOLEHOME (The Whole Home, concierge=false)')
  } else if (byCode.get('WHOLEHOME')) {
    console.log('SKIP    WHOLEHOME already present')
  }

  // 2. Ensure ATELIER exists
  if (!byCode.get('ATELIER')) {
    await db.subscriptionPlan.create({
      data: {
        code: 'ATELIER',
        name: 'The Atelier',
        tagline: 'Your designer, couture and premium traditional wear — cleaned by hand, only when it needs it.',
        priceMonthly: 100000,
        sortOrder: 4,
        isActive: true,
        includedUnits: 2,
        unitKind: 'bag',
        unitName: 'Atelier Garment Bag',
        extraUnitPrice: 25000,
        maxExtraUnits: 2,
        replacementFee: 15000,
        duvetsPerQuarter: 0,
        curtainsPerQuarter: 0,
        springCleanPerYear: 0,
        concierge: true,
        memberDiscountPct: 20,
        prioritySlots: true,
      },
    })
    console.log('CREATED ATELIER (The Atelier, 100k, concierge=true)')
  } else {
    console.log('SKIP    ATELIER already present')
  }

  // 3. Refresh the plain taglines on the size tiers if they still carry the
  //    old copy (only when the admin has NOT customised them since).
  const taglines: Record<string, string> = {
    ESSENTIALS: 'One person’s clothes, every week. Bag goes out, clean clothes come back.',
    HOUSEHOLD: 'The whole family’s weekly load in one big box — plus the beds.',
    WHOLEHOME: 'Everything in the house — the box, the duvets, the curtains, and one deep clean a year.',
    ATELIER: 'Your designer, couture and premium traditional wear — cleaned by hand, only when it needs it.',
  }
  const oldTaglines = [
    'The weekly rhythm — one bag, every week, never think about it again.',
    'The whole home on a rhythm — the box, the duvets, the lot.',
    'Designer pieces, assessments, and the once-a-year deep clean — handled.',
  ]
  for (const p of await db.subscriptionPlan.findMany()) {
    if (oldTaglines.includes(p.tagline ?? '') && taglines[p.code]) {
      await db.subscriptionPlan.update({ where: { id: p.id }, data: { tagline: taglines[p.code] } })
      console.log(`REFRESH tagline for ${p.code}`)
    }
  }

  // 4. Report the final ladder
  const final = await db.subscriptionPlan.findMany({ orderBy: { sortOrder: 'asc' } })
  console.log('\nFINAL LADDER:')
  for (const p of final) {
    console.log(
      `  ${p.sortOrder}. ${p.code.padEnd(10)} ${p.name.padEnd(16)} ₦${p.priceMonthly.toLocaleString()}  units=${p.includedUnits}  ${p.unitName}  concierge=${p.concierge}  active=${p.isActive}`
    )
  }
  const subs = await db.subscription.count()
  console.log(`\nSubscribers attached (unchanged): ${subs}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
