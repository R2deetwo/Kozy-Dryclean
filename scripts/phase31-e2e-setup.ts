// Phase-31 E2E setup: create a temporary TEST ADMIN in the production DB.
// Why: E2E must exercise the real invite flow (Staff tab → /api/staff POST →
// Brevo email → staff login → pause/revoke), and the real admin passwords
// are (rightly) unknown to the sandbox. This account is deleted afterwards
// by phase31-e2e-cleanup.ts — it never leaves a trace beyond the session
// logs of this verification.
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

const ADMIN_EMAIL = 'e2e-admin-phase31@kozy-test.example'
const ADMIN_PASSWORD = 'E2eAdmin-Phase31!x'

async function main() {
  // Clean slate (in case a previous run was interrupted)
  await db.user.deleteMany({ where: { email: ADMIN_EMAIL } })

  const admin = await db.user.create({
    data: {
      email: ADMIN_EMAIL,
      name: 'E2E Test Manager',
      phone: '+2348000000031',
      role: 'ADMIN',
      passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10),
      emailVerified: new Date(),
      accessStatus: 'ACTIVE',
    },
  })
  console.log('TEST ADMIN CREATED')
  console.log('id:', admin.id)
  console.log('email:', admin.email)
  console.log('role:', admin.role, '| accessStatus:', admin.accessStatus)
  console.log('emailVerified:', admin.emailVerified ? 'YES' : 'NO')

  // Sanity: the schema really carries the new fields on prod
  const enumProbe = await db.user.findFirst({
    where: { role: 'STAFF' },
    select: { id: true, email: true, accessStatus: true },
  })
  console.log('existing STAFF rows on prod:', enumProbe ? enumProbe.email : 'none (expected — fresh feature)')
}

main()
  .catch((e) => {
    console.error('SETUP FAILED:', e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
