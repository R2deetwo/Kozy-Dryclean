// Verify the seeded credentials directly.
import { db } from '../src/lib/db'
import bcrypt from 'bcryptjs'

async function main() {
  const admin = await db.user.findUnique({ where: { email: 't70admin@kozy.test' } })
  console.log('admin found:', Boolean(admin), admin ? { role: admin.role, verified: admin.emailVerified, access: admin.accessStatus } : '')
  if (admin) {
    console.log('bcrypt compare:', await bcrypt.compare('T70Admin!2026', admin.passwordHash))
  }
  const cust = await db.user.findUnique({ where: { email: 't70cust@kozy.test' } })
  console.log('cust found:', Boolean(cust), cust ? { role: cust.role, verified: cust.emailVerified } : '')
  if (cust) {
    console.log('cust bcrypt compare:', await bcrypt.compare('T70Cust!2026', cust.passwordHash))
  }
  const count = await db.user.count()
  console.log('total users:', count)
}
main().catch((e) => { console.error(e); process.exit(1) }).then(() => process.exit(0))
