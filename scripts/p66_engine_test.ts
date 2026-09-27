// Phase 66 — functional test of the calendar-sync engine + helpers (local DB).
// 1. Pure helper checks: isoWeekLagos / getNewsletterEntryForDate.
// 2. Live engine check: ensureNextAutoDraft(force) must draft the entry that
//    matches the SLOT's calendar week (not the stored pointer).
import { PrismaClient } from '@prisma/client'
import {
  isoWeekLagos,
  getNewsletterEntryForDate,
} from '../src/lib/newsletter-content'

const db = new PrismaClient()

function lagosDate(y: number, m: number, d: number, h = 9): Date {
  return new Date(Date.UTC(y, m - 1, d, h, 0, 0) - 60 * 60_000)
}

let failures = 0
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}: ${JSON.stringify(actual)}${ok ? '' : ` (expected ${JSON.stringify(expected)})`}`)
  if (!ok) failures++
}

async function main() {
  // ---- pure helpers --------------------------------------------------------
  check('isoWeek 2026-09-27', isoWeekLagos(lagosDate(2026, 9, 27)), 39)
  check('isoWeek 2026-10-01', isoWeekLagos(lagosDate(2026, 10, 1)), 40)
  check('isoWeek 2026-10-08', isoWeekLagos(lagosDate(2026, 10, 8)), 41)
  check('isoWeek 2026-12-20', isoWeekLagos(lagosDate(2026, 12, 20)), 51)
  check('isoWeek 2026-12-31', isoWeekLagos(lagosDate(2026, 12, 31)), 53) // 2026 is a 53-week year
  check('isoWeek 2027-01-04', isoWeekLagos(lagosDate(2027, 1, 4)), 1)
  check('entry for Sep 27 is Independence prep', getNewsletterEntryForDate(lagosDate(2026, 9, 27)).week, 39)
  check('Independence subject is PRE-event', /almost here/.test(getNewsletterEntryForDate(lagosDate(2026, 9, 27)).subject), true)
  check('entry for Oct 8 (agbada/owambe)', getNewsletterEntryForDate(lagosDate(2026, 10, 8)).week, 41)
  check('entry for Dec 7 is Detty playbook (pre-open)', getNewsletterEntryForDate(lagosDate(2026, 12, 7)).week, 50)
  check('Dec 7 playbook never says officially open', /officially open/.test(getNewsletterEntryForDate(lagosDate(2026, 12, 7)).bodyText), false)
  check('entry for Dec 20 is Christmas+Detty open', getNewsletterEntryForDate(lagosDate(2026, 12, 20)).week, 51)
  check('Dec 20 entry says officially open', /officially open/.test(getNewsletterEntryForDate(lagosDate(2026, 12, 20)).bodyText), true)
  check('week 53 falls back to 52', getNewsletterEntryForDate(lagosDate(2026, 12, 31)).week, 52)
  check('week 39 = pre-Oct-1 (title)', getNewsletterEntryForDate(lagosDate(2026, 9, 27)).title, 'Independence Day — green & white, ready early')

  // ---- live engine ---------------------------------------------------------
  // Reset the schedule so the engine resolves a fresh slot from defaults
  // (Thursday 09:00, every 2 weeks, pointer parked at index 0 = "New Year" —
  // exactly the drifted-state trap the calendar sync must defeat).
  await db.marketingSchedule.upsert({
    where: { id: 'main' },
    update: { currentWeekIndex: 0, nextSlotDate: null, slotPinned: false, enabled: true },
    create: { id: 'main', currentWeekIndex: 0, enabled: true },
  })
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { ensureNextAutoDraft } = await import('../src/lib/marketing')
  const campaign = await ensureNextAutoDraft(true)
  if (!campaign) {
    console.log('FAIL  engine returned no campaign')
    failures++
  } else {
    const slot = campaign.slotDate ?? campaign.scheduledAt
    const week = isoWeekLagos(new Date(slot))
    check('engine drafted calendar-matched week', (campaign as any).name.startsWith(`Week ${week}`), true)
    check('engine did NOT draft the stale pointer (New Year)', /New Year/.test((campaign as any).name), false)
    const sched = await db.marketingSchedule.findUnique({ where: { id: 'main' } })
    check('pointer re-synced to next slot calendar entry', sched!.currentWeekIndex >= 0, true)
    console.log(`INFO  slot=${slot?.toISOString()}  campaign="${(campaign as any).name}"  pointer=${sched!.currentWeekIndex}`)
    // cleanup so QA/dev state stays clean
    await db.newsletterCampaign.delete({ where: { id: campaign.id } })
    await db.marketingSchedule.update({ where: { id: 'main' }, data: { currentWeekIndex: 0, nextSlotDate: null, slotPinned: false } })
  }

  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} FAILURES`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => db.$disconnect())
