// =============================================================================
// Phase 63 — QA seed #2: cover every preview-relevant campaign state
// =============================================================================
// Adds to the local QA DB (idempotent — deletes p63 QA rows first):
//   • a manual DRAFT (hand-written, "Send now" is its legitimate primary)
//   • a SENT campaign (delivered record — preview must still show it)
// The p63 #1 campaign (automation, approved → SCHEDULED) is left as-is: it
// was produced through the REAL UI flow.
// Run: DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54329/kozy \
//        npx tsx scripts/p63_seed2.ts
// =============================================================================

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const MANUAL_BODY = `Lagos, we need to talk about your curtains.

They have been quietly collecting dust for a year, and they are ready to come down for a proper wash. This month: curtain cleaning at 15% off, pickup and delivery included.

**How it works** — we take them down, wash, press, and re-hang. You do nothing.

Book from your portal as usual — the discount applies automatically at checkout.`

const SENT_BODY = `Thank you for a wonderful first half of the year.

As a small token: your next order rides free delivery. Just book as usual — no code needed.

Keep pressing on,
The Kozy Care team`

function plainToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
  const bold = (s: string): string => s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
  return escaped
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin: 0 0 16px 0;">${bold(p).replace(/\n/g, '<br>')}</p>`)
    .join('\n')
}

async function main() {
  await db.newsletterCampaign.deleteMany({ where: { name: { startsWith: 'p63qa —' } } })

  const manualDraft = await db.newsletterCampaign.create({
    data: {
      name: 'p63qa — Curtain promo (manual draft)',
      subject: 'Your curtains need a holiday too — 15% off this month',
      bodyText: MANUAL_BODY,
      htmlContent: plainToHtml(MANUAL_BODY),
      segment: 'ALL',
      status: 'DRAFT',
      source: 'manual',
      bannerSlug: 'service-pickup',
    },
  })
  console.log('manual draft:', manualDraft.id)

  const sent = await db.newsletterCampaign.create({
    data: {
      name: 'p63qa — Mid-year thank you (SENT)',
      subject: 'A small thank you from Kozy Care',
      bodyText: SENT_BODY,
      htmlContent: plainToHtml(SENT_BODY),
      segment: 'ALL',
      status: 'SENT',
      source: 'manual',
      bannerSlug: 'hero-navy-gold',
      sentAt: new Date(Date.now() - 7 * 24 * 3600 * 1000),
      sentCount: 0,
      openCount: 0,
      clickCount: 0,
    },
  })
  console.log('sent campaign:', sent.id)

  const all = await db.newsletterCampaign.findMany({
    where: { name: { startsWith: 'p63' } },
    select: { id: true, name: true, status: true, source: true },
  })
  console.log('QA campaigns now:', JSON.stringify(all, null, 2))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
