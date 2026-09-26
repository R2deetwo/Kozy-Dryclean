// Phase 63 — read the owner's scheduled campaign details (read-only)
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } })

async function main() {
  const c = await db.newsletterCampaign.findUnique({
    where: { id: process.env.ID ?? 'cmuigwhiy0000l204c5xvnevo' },
    select: { name: true, status: true, scheduledAt: true, testSentAt: true, subject: true },
  })
  console.log(JSON.stringify(c, null, 2))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
