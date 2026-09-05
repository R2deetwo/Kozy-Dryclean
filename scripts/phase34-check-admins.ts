// phase34-check-admins.ts — inspect current ADMIN accounts on production
// (read-only). Run with the production DATABASE_URL exported.
import { db } from '../src/lib/db'

async function main() {
  const admins = await db.user.findMany({
    where: { role: 'ADMIN' },
    select: { email: true, name: true, role: true, emailVerified: true,
              passwordHash: true, accessStatus: true, createdAt: true },
    orderBy: { email: 'asc' },
  })
  console.log(`ADMIN accounts on production: ${admins.length}`)
  for (const a of admins) {
    console.log(`  ${a.email} | name=${a.name} | pw=${a.passwordHash ? 'SET' : 'NONE'} | verified=${!!a.emailVerified} | access=${a.accessStatus}`)
  }
  const target = await db.user.findUnique({ where: { email: 'kozygarmentcare@gmail.com' },
    select: { email: true, name: true, role: true, passwordHash: true, emailVerified: true,
              _count: { select: { orders: true } } } })
  console.log('\nkozygarmentcare@gmail.com:', target ? JSON.stringify({ ...target, passwordHash: target.passwordHash ? 'SET' : 'NONE' }) : 'NOT FOUND')
  const fict = await db.user.findUnique({ where: { email: 'admin@kozy.ng' }, select: { email: true, role: true } })
  console.log('admin@kozy.ng (fictitious):', fict ? JSON.stringify(fict) : 'NOT FOUND')
  const staff = await db.user.count({ where: { role: 'STAFF' } })
  console.log(`\nSTAFF count: ${staff}, total users: ${await db.user.count()}`)
}
main().catch(e => { console.error(e); process.exit(1) }).finally(() => db.$disconnect())
