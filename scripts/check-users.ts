// Verify all users have password hashes + emailVerified set
import { db } from '../src/lib/db'

async function main() {
  const users = await db.user.findMany({
    select: { id: true, email: true, name: true, role: true, passwordHash: true, emailVerified: true },
    orderBy: { role: 'asc' },
  })

  console.log(`Users in Supabase (${users.length}):\n`)
  for (const u of users) {
    const hasPassword = !!u.passwordHash
    const isVerified = !!u.emailVerified
    const status = hasPassword && isVerified ? '✅ ready' : hasPassword ? '⚠️  not verified' : '❌ no password'
    console.log(`  ${u.role.padEnd(8)} ${u.email.padEnd(40)} ${status}`)
  }
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
