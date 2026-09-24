// Phase 56 — set the final admin-alert recipient list in production.
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } })

async function main() {
  const FINAL = 'kozygarmentcare@gmail.com,practiceprosystems@gmail.com,vk5m2w8t4a@woosh.dpdns.org'
  const row = await db.appSetting.upsert({
    where: { key: 'admin_alerts_email' },
    update: { value: JSON.stringify(FINAL) },
    create: { key: 'admin_alerts_email', value: JSON.stringify(FINAL) },
  })
  console.log('admin alert recipients set to:', row.value)
}

main()
  .catch((e) => {
    console.error('ERR', e.message)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
