// Phase-33 E2E setup: temp TEST ADMIN in the production DB (same pattern as
// phases 31/32) for the iPhone-viewport console navigation audit. Deleted by
// phase33-e2e-cleanup.ts at the end.
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

const ADMIN_EMAIL = 'e2e-admin-phase33@kozy-test.example'
const ADMIN_PASSWORD = 'E2eAdmin-Phase33!x'

async function main() {
  await db.user.deleteMany({ where: { email: ADMIN_EMAIL } })

  const admin = await db.user.create({
    data: {
      email: ADMIN_EMAIL,
      name: 'E2E Nav Audit',
      phone: '+2348000000033',
      role: 'ADMIN',
      passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10),
      emailVerified: new Date(),
      accessStatus: 'ACTIVE',
    },
  })
  console.log('TEST ADMIN CREATED | id:', admin.id, '| email:', admin.email)
}

main()
  .catch((e) => {
    console.error('SETUP FAILED:', e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
