// List all users in Supabase to find their actual IDs
import { db } from '../src/lib/db'

async function main() {
  const users = await db.user.findMany({
    select: { id: true, email: true, name: true, role: true },
    orderBy: { role: 'asc' },
  })
  
  console.log('Users in Supabase:\n')
  for (const u of users) {
    console.log(`  ${u.role.padEnd(8)} ${u.id}  ${u.email}`)
  }
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
