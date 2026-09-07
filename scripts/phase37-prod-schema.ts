// Phase 37 post-deploy check: confirm the testSentAt column reached prod.
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  const cols = await db.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'NewsletterCampaign' ORDER BY ordinal_position`
  )
  console.log('NewsletterCampaign columns:', (cols as { column_name: string }[]).map((c) => c.column_name).join(', '))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .then(() => db.$disconnect())
