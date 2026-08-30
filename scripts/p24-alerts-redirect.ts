// Point the admin alert inbox at the E2E test address for the duration of a
// local test run (so real owners never receive test alerts). p24-cleanup.ts
// restores the real recipients afterwards.
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()
const target = process.argv[2] || 'e2e-alerts@kozy-test.example'

async function main() {
  await db.appSetting.upsert({
    where: { key: 'admin_alerts_email' },
    update: { value: JSON.stringify(target) },
    create: { key: 'admin_alerts_email', value: JSON.stringify(target) },
  })
  console.log(`admin_alerts_email -> ${target}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
