// Phase 71 — Shoe Club REPRICING migration (idempotent, local + prod).
//
// What changed (owner directive):
//   counts  1/3/5 → 2/4/6  (rotation rhythm: fortnightly / weekly / twice-weekly;
//                           never mirror the laundry tiers)
//   prices  ₦1,000/₦2,500/₦4,000 → ₦3,000/₦5,000/₦7,200
//           (per-pair ₦1,500/₦1,250/₦1,200 — at or above Kozy's own ₦1,000
//            a-la-carte floor, still ~70-85% under the ₦7,000-8,000 specialists;
//            the old ₦800/pair tag undercut our own card and could not even
//            cover a dedicated monthly pickup trip)
//
// Safety:
//   - If any subscriber sits on an OLD club row (SHOES1/3/5) the script does
//     NOT deactivate that row — existing members keep their paid-for allowance
//     until their period ends; only new rows go live. With 0 subscribers (the
//     expected case — the club launched yesterday) old rows are hidden.
//   - paystackPlanCode is cleared on every touched row so the next payment
//     attempt creates a fresh Paystack plan at the NEW price (no recycled
//     recurring plan at the old amount).
//   - Tiers (ESSENTIALS/HOUSEHOLD/WHOLEHOME, 1/3/5 shoe perks) are untouched.
//
// Usage:
//   DATABASE_URL=<postgres url> npx tsx scripts/t71_club_repricing.ts
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } })

const NEW_CLUB = [
  {
    code: 'SHOES2',
    name: 'Shoe Club · 2 pairs',
    tagline: 'The fortnightly freshen — one pair out, one pair back, every two weeks.',
    priceMonthly: 3000,
    sortOrder: 11,
    shoesPerMonth: 2,
    memberDiscountPct: 5,
  },
  {
    code: 'SHOES4',
    name: 'Shoe Club · 4 pairs',
    tagline: 'The weekly rotation — a fresh pair ready every week of the month.',
    priceMonthly: 5000,
    sortOrder: 12,
    shoesPerMonth: 4,
    memberDiscountPct: 10,
  },
  {
    code: 'SHOES6',
    name: 'Shoe Club · 6 pairs',
    tagline: 'The sneakerhead rotation — twice a week, always something fresh.',
    priceMonthly: 7200,
    sortOrder: 13,
    shoesPerMonth: 6,
    memberDiscountPct: 15,
  },
]

const OLD_CODES = ['SHOES1', 'SHOES3', 'SHOES5']

async function main() {
  // 1. How many live subscribers sit on OLD club rows? (expect 0 — just launched)
  const oldRows = await db.subscriptionPlan.findMany({ where: { code: { in: OLD_CODES } } })
  const oldIds = oldRows.map((r) => r.id)
  const oldSubs =
    oldIds.length > 0
      ? await db.subscription.count({
          where: { planId: { in: oldIds }, status: { in: ['ACTIVE', 'PENDING_ACTIVATION'] } },
        })
      : 0
  console.log(`Old club rows found: ${oldRows.length}; live subscribers on them: ${oldSubs}`)

  // 2. Upsert the new ladder (create-or-correct: re-runnable after admin edits)
  for (const c of NEW_CLUB) {
    const existing = await db.subscriptionPlan.findUnique({ where: { code: c.code } })
    if (existing) {
      await db.subscriptionPlan.update({
        where: { id: existing.id },
        data: { ...c, paystackPlanCode: null },
      })
      console.log(
        `UPDATED ${c.code} → ₦${c.priceMonthly}/mo, ${c.shoesPerMonth} pairs (was ₦${existing.priceMonthly}, ${existing.shoesPerMonth})`
      )
    } else {
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
      console.log(`CREATED ${c.code} (${c.name}, ₦${c.priceMonthly}/mo, ${c.shoesPerMonth} pairs)`)
    }
  }

  // 3. Retire the old rows — hidden if nobody subscribes, untouched if anyone does
  for (const row of oldRows) {
    if (oldSubs === 0) {
      if (row.isActive) {
        await db.subscriptionPlan.update({ where: { id: row.id }, data: { isActive: false } })
        console.log(`HID    ${row.code} (0 subscribers — hidden, never deleted)`)
      } else {
        console.log(`SKIP   ${row.code} already hidden`)
      }
    } else {
      console.log(
        `KEPT   ${row.code} ACTIVE — ${oldSubs} member(s) still on it; hide it manually after their period ends.`
      )
    }
  }

  // 4. Sanity: print the final ladder
  const all = await db.subscriptionPlan.findMany({ orderBy: { sortOrder: 'asc' } })
  console.log('\nFinal plan table:')
  for (const p of all) {
    console.log(
      `  ${p.code.padEnd(10)} ${p.name.padEnd(24)} fam=${p.family ?? 'KIT'} ₦${p.priceMonthly} shoes=${p.shoesPerMonth} active=${p.isActive}`
    )
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
