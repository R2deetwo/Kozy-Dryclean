// Phase-33 E2E cleanup: remove the temporary test admin from the production DB.
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()
const ADMIN_EMAIL = 'e2e-admin-phase33@kozy-test.example'

async function main() {
  const res = await db.user.deleteMany({ where: { email: ADMIN_EMAIL } })
  console.log('deleted test admins:', res.count)
  const left = await db.user.count({ where: { email: { contains: 'kozy-test.example' } } })
  console.log('remaining kozy-test users:', left)
}

main()
  .catch((e) => {
    console.error('CLEANUP FAILED:', e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
