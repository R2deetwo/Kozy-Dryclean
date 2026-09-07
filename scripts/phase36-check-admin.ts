import { db } from '../src/lib/db'
import bcrypt from 'bcryptjs'

async function main() {
  const admins = await db.$queryRaw`SELECT id, email, name, "accessStatus" FROM "User" WHERE role = 'ADMIN'`
  console.log('ADMINS:', JSON.stringify(admins, null, 2))
  const testEmail = 'phase36-e2e@kozy-test.example'
  await db.$executeRaw`DELETE FROM "User" WHERE email = ${testEmail}`
  const hash = await bcrypt.hash('Phase36!Test2026', 10)
  await db.$executeRaw`INSERT INTO "User" (id, email, name, phone, role, "passwordHash", "emailVerified", "accessStatus", "signupDiscountUsed", "mustChangePassword", "createdAt", "updatedAt") VALUES (gen_random_uuid()::text, ${testEmail}, 'Phase36 E2E', '+234 800 000 0002', 'ADMIN', ${hash}, now(), 'ACTIVE', false, false, now(), now())`
  console.log('TEST ADMIN CREATED:', testEmail)
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
