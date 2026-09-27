// Phase 66 — PROD newsletter timing fixes (idempotent):
//   1. Create the Independence PREP campaign, SCHEDULED for Tue Sep 29,
//      07:00 Lagos (06:00 UTC) so the daily 07:00 UTC marketing cron picks it
//      up that same morning — two full days before October 1. Content is the
//      rewritten week-39 library entry ("green & white, ready early").
//   2. Rename the owner-approved "Week 38 — September promo push" campaign
//      (which actually sends Oct 8) to an honest October name — content stays.
//   3. Re-sync the engine pointer to the calendar entry of its next slot, so
//      the admin panel reads truthfully from the first post-deploy render.
import { PrismaClient } from '@prisma/client'
import { NEWSLETTER_LIBRARY, getNewsletterEntryForDate, isoWeekLagos } from '../src/lib/newsletter-content'
import { plainTextToEmailHtml } from '../src/lib/marketing'

const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } })

const INDEPENDENCE_SEND_AT = new Date('2026-09-29T06:00:00.000Z') // 07:00 Lagos, before the 07:00 UTC cron
const INDEPENDENCE_NAME = 'Independence Day — green & white, ready early'

async function main() {
  const entry = NEWSLETTER_LIBRARY.find((e) => e.week === 39)!
  console.log(`Library week 39: "${entry.subject}" (${entry.season})`)

  // 1. Independence prep campaign (skip if it already exists)
  const dupe = await db.newsletterCampaign.findFirst({ where: { name: INDEPENDENCE_NAME } })
  if (dupe) {
    console.log(`SKIP    campaign "${dupe.name}" already exists (${dupe.status}, ${dupe.scheduledAt?.toISOString()})`)
  } else {
    const created = await db.newsletterCampaign.create({
      data: {
        name: INDEPENDENCE_NAME,
        subject: entry.subject,
        htmlContent: plainTextToEmailHtml(entry.bodyText),
        bodyText: entry.bodyText,
        segment: 'ALL',
        status: 'SCHEDULED',
        source: 'manual',
        scheduledAt: INDEPENDENCE_SEND_AT,
        slotDate: INDEPENDENCE_SEND_AT,
        bannerSlug: entry.banner,
      },
    })
    console.log(`CREATED "${created.name}" SCHEDULED ${created.scheduledAt?.toISOString()} (banner: ${entry.banner})`)
  }

  // 2. Rename the October-sending "September promo push"
  const sept = await db.newsletterCampaign.findFirst({
    where: { name: { contains: 'September promo push' }, status: 'SCHEDULED' },
  })
  if (sept) {
    await db.newsletterCampaign.update({
      where: { id: sept.id },
      data: { name: 'Week 41 — October circuit kickoff (approved)' },
    })
    console.log(`RENAMED "${sept.name}" -> "Week 41 — October circuit kickoff (approved)" (still sends ${sept.scheduledAt?.toISOString()}; subject/content unchanged)`)
  } else {
    console.log('SKIP    no scheduled "September promo push" campaign found (already renamed or deleted)')
  }

  // 3. Pointer re-sync to calendar
  const sched = await db.marketingSchedule.findUnique({ where: { id: 'main' } })
  if (sched?.nextSlotDate) {
    const next = new Date(sched.nextSlotDate)
    const entryForNext = getNewsletterEntryForDate(next)
    const idx = Math.max(0, NEWSLETTER_LIBRARY.indexOf(entryForNext))
    await db.marketingSchedule.update({ where: { id: 'main' }, data: { currentWeekIndex: idx } })
    console.log(`POINTER synced: next slot ${next.toISOString()} = ISO week ${isoWeekLagos(next)} -> "Week ${entryForNext.week} — ${entryForNext.title}" (index ${idx}, was ${sched.currentWeekIndex})`)
  } else {
    console.log('SKIP    no schedule row / nextSlotDate (engine will resolve on first run)')
  }

  // 4. Report the campaign board
  const campaigns = await db.newsletterCampaign.findMany({
    orderBy: { createdAt: 'desc' },
    take: 12,
    select: { name: true, status: true, scheduledAt: true, sentAt: true, source: true, segment: true },
  })
  console.log('\nCAMPAIGN BOARD (latest 12):')
  for (const c of campaigns) {
    console.log(`  [${c.status.padEnd(8)}] ${c.source.padEnd(10)} ${String(c.scheduledAt?.toISOString() ?? c.sentAt?.toISOString() ?? '—').padEnd(21)} ${c.name}`)
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
