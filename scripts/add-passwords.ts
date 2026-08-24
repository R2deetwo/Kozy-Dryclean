// Add password hashes to existing seed users so they can log in via NextAuth
import { db } from '../src/lib/db'
import bcrypt from 'bcryptjs'

const PASSWORD = 'kozy1234' // demo password for all seed accounts

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10)
  
  const users = await db.user.findMany()
  console.log(`Found ${users.length} users. Setting password "${PASSWORD}" for all...\n`)
  
  for (const user of users) {
    if (!user.passwordHash) {
      await db.user.update({
        where: { id: user.id },
        data: { 
          passwordHash,
          emailVerified: new Date(), // mark as verified so they can log in immediately
        },
      })
      console.log(`  ✓ ${user.email} — password set, email verified`)
    } else {
      console.log(`  - ${user.email} — already has password`)
    }
  }
  
  console.log(`\nDone! All users can now log in with password: ${PASSWORD}`)
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
