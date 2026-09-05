// Phase-32 E2E setup: create a temporary TEST ADMIN in the production DB
// (same pattern as phase-31). The staff account itself is invited through
// the REAL UI flow (Staff tab → /api/staff POST → Brevo email) — the admin
// here is only the driver of that flow. Everything is deleted by
// phase32-e2e-cleanup.ts at the end.
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

const ADMIN_EMAIL = 'e2e-admin-phase32@kozy-test.example'
const ADMIN_PASSWORD = 'E2eAdmin-Phase32!x'

async function main() {
  await db.user.deleteMany({ where: { email: ADMIN_EMAIL } })

  const admin = await db.user.create({
    data: {
      email: ADMIN_EMAIL,
      name: 'E2E Test Manager',
      phone: '+2348000000032',
      role: 'ADMIN',
      passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10),
      emailVerified: new Date(),
      accessStatus: 'ACTIVE',
    },
  })
  console.log('TEST ADMIN CREATED | id:', admin.id, '| email:', admin.email)

  // Sanity probe: the phase-32 schema is really live on prod.
  const staffProbe = await db.user.findFirst({
    where: { role: 'STAFF' },
    select: { id: true, email: true, mustChangePassword: true },
  })
  console.log('existing STAFF rows:', staffProbe ? `${staffProbe.email} (mustChangePassword=${staffProbe.mustChangePassword})` : 'none')
}

main()
  .catch((e) => {
    console.error('SETUP FAILED:', e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
