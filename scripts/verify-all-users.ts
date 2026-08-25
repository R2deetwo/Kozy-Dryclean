// Verify ALL unverified users so they can log in immediately
import { db } from '../src/lib/db'
import bcrypt from 'bcryptjs'

const PASSWORD = 'kozy1234'

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10)

  const unverified = await db.user.findMany({
    where: { emailVerified: null },
    select: { id: true, email: true, name: true, passwordHash: true }
  })

  console.log(`Found ${unverified.length} unverified users. Verifying all...\n`)

  for (const user of unverified) {
    await db.user.update({
      where: { id: user.id },
      data: {
        emailVerified: new Date(),
        // Set password if they don't have one
        ...(user.passwordHash ? {} : { passwordHash }),
      },
    })
    console.log(`  ✓ ${user.email} — verified + password set to "${PASSWORD}"`)
  }

  console.log(`\nAll ${unverified.length} users can now log in with password: ${PASSWORD}`)
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
