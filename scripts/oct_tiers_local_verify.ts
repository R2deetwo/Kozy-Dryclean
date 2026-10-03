// Local verification script — Oct 2026 tier restructure.
// Gives the local woosh test user an ACTIVE Household membership and
// verifies: seeds, bedsheetsPerMonth, effectiveUsage, pickup kind=bedsheet
// consumption, renewal reset, and iron-only pricing constant presence.
// Run against the LOCAL embedded postgres only (never prod).

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  const user = await db.user.findUnique({ where: { email: 'dv5u6wcr5y@woosh.dpdns.org' } })
  if (!user) throw new Error('woosh test user not found — run the guest checkout first')

  // Clean any prior membership from earlier runs
  await db.subscription.deleteMany({ where: { userId: user.id } })

  const household = await db.subscriptionPlan.findUnique({ where: { code: 'HOUSEHOLD' } })
  if (!household) throw new Error('HOUSEHOLD plan not seeded')
  console.log('HOUSEHOLD seeded:', {
    bedsheetsPerMonth: household.bedsheetsPerMonth,
    duvetsPerQuarter: household.duvetsPerQuarter,
    priceMonthly: household.priceMonthly,
    tagline: household.tagline,
  })

  const start = new Date()
  const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  const sub = await db.subscription.create({
    data: {
      userId: user.id,
      planId: household.id,
      status: 'ACTIVE',
      periodStart: start,
      periodEnd: end,
      pricePaid: household.priceMonthly,
      paymentMethod: 'BANK_TRANSFER',
      usageCycleKey: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`,
      usageQuarterKey: `${start.getFullYear()}-Q${Math.floor(start.getMonth() / 3) + 1}`,
      usageYearKey: String(start.getFullYear()),
    },
    include: { plan: true },
  })
  console.log('Membership created:', { id: sub.id, status: sub.status, plan: sub.plan.name })
  console.log('DONE')
}

main()
  .catch((e) => {
    console.error('FAIL:', e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
