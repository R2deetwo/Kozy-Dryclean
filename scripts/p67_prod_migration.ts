// Phase 67 — PROD migration (idempotent, safe to re-run).
// (1) Retire the ATELIER plan row: couture is no longer a tier — it is the
//     separate Couture Care specialist service on /services. If any member
//     still references the plan, DEACTIVATE it (row kept for history); if
//     zero subscribers, DELETE it outright. Either way the public page and
//     the join flow stop offering it.
// (2) Guard the admin-set newsletter cadence: the owner runs every ~2 weeks —
//     if the schedule row drifted to weekly, restore cadenceWeeks=2 (the
//     code default and the admin panel default). Never touches day/time.
// (3) Print the schedule + pending campaigns for verification.
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } })

async function main() {
  // ---------- 1. Retire ATELIER ----------
  const atelier = await db.subscriptionPlan.findUnique({ where: { code: 'ATELIER' } })
  if (!atelier) {
    console.log('SKIP    ATELIER already absent')
  } else {
    const subs = await db.subscription.count({ where: { planId: atelier.id } })
    if (subs === 0) {
      await db.subscriptionPlan.delete({ where: { id: atelier.id } })
      console.log('DELETED ATELIER (0 subscribers — clean removal)')
    } else {
      await db.subscriptionPlan.update({
        where: { id: atelier.id },
        data: { isActive: false, concierge: false },
      })
      console.log(`RETIRED ATELIER (${subs} subscriber(s) — deactivated, row kept for history)`)
    }
  }

  // ---------- 2. Guard the newsletter cadence ----------
  const sched = await db.marketingSchedule.findUnique({ where: { id: 'main' } })
  if (!sched) {
    console.log('NOTE    no marketingSchedule row (engine never used) — nothing to guard')
  } else {
    console.log(
      `SCHEDULE enabled=${sched.enabled} cadenceWeeks=${sched.cadenceWeeks} day=${sched.dayOfWeek} time=${sched.sendTime} nextSlot=${sched.nextSlotDate?.toISOString() ?? 'none'}`
    )
    if (sched.cadenceWeeks !== 2) {
      await db.marketingSchedule.update({
        where: { id: 'main' },
        data: { cadenceWeeks: 2 },
      })
      console.log(`FIXED   cadenceWeeks ${sched.cadenceWeeks} -> 2 (the owner's every-2-weeks rhythm)`)
    } else {
      console.log('OK      cadence already every 2 weeks (admin-set)')
    }
  }

  // ---------- 3. Report pending campaigns ----------
  const pending = await db.newsletterCampaign.findMany({
    where: { status: { in: ['DRAFT', 'SCHEDULED'] } },
    orderBy: { scheduledAt: 'asc' },
    select: { id: true, name: true, status: true, source: true, scheduledAt: true, slotDate: true },
  })
  if (pending.length === 0) {
    console.log('CAMPAIGNS none pending')
  } else {
    for (const c of pending) {
      console.log(
        `CAMPAIGN [${c.status}] ${c.name} (${c.source}) — scheduled ${c.scheduledAt?.toISOString() ?? 'n/a'}`
      )
    }
  }

  const plans = await db.subscriptionPlan.findMany({
    orderBy: { sortOrder: 'asc' },
    select: { code: true, name: true, priceMonthly: true, isActive: true },
  })
  console.log('PLANS   ' + plans.map((p) => `${p.code}(${p.isActive ? 'live' : 'hidden'})`).join(', '))
}

main()
  .catch((e) => {
    console.error('MIGRATION FAILED:', e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
