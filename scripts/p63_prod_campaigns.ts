// Phase 63 — read-only check of campaigns in PRODUCTION
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } })

async function main() {
  const rows = await db.newsletterCampaign.findMany({ select: { status: true, name: true, id: true } })
  const byStatus: Record<string, number> = {}
  rows.forEach((r) => {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1
  })
  console.log('prod campaigns:', rows.length, JSON.stringify(byStatus))
  console.log('sample:', rows.slice(0, 5).map((r) => `${r.name} [${r.status}] ${r.id}`).join(' | '))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
