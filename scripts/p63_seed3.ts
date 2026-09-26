// Phase 63 QA — automation DRAFT row (drives the "Awaiting your approval ↑" chip)
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  await db.newsletterCampaign.deleteMany({ where: { name: 'p63qa — Next engine draft (auto)' } })
  const c = await db.newsletterCampaign.create({
    data: {
      name: 'p63qa — Next engine draft (auto)',
      subject: 'Wardrobe wisdom, fresh from the atelier',
      bodyText: 'Hello,\n\nFresh off the pressing table: three fabric habits that quietly ruin good clothes.\n\n**This week** — express 48-hour turnaround on everything.\n\nThe Kozy Care team',
      htmlContent:
        '<p style="margin: 0 0 16px 0;">Hello,</p><p style="margin: 0 0 16px 0;">Fresh off the pressing table: three fabric habits that quietly ruin good clothes.</p><p style="margin: 0 0 16px 0;"><strong>This week</strong> — express 48-hour turnaround on everything.</p><p style="margin: 0 0 16px 0;">The Kozy Care team</p>',
      segment: 'ALL',
      status: 'DRAFT',
      source: 'automation',
      bannerSlug: 'tips-fabric',
    },
  })
  console.log('automation draft:', c.id)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
