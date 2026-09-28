// =============================================================================
// Task 72 helper — set a KNOWN password on the PARTNER account that admin
// approval just created (in production the generated password is emailed to
// the partner; in the battery we play the email's role).
// =============================================================================
import { db } from '../src/lib/db'
import bcrypt from 'bcryptjs'

async function main() {
  const pwHash = await bcrypt.hash('T72Partner!2026', 10)
  const users = await db.user.findMany({ where: { role: 'PARTNER' } })
  if (users.length === 0) {
    console.error('no PARTNER user found — run the approve step first')
    process.exit(1)
  }
  // The battery only ever has one partner account.
  const u = users[0]
  await db.user.update({
    where: { id: u.id },
    data: { passwordHash: pwHash, mustChangePassword: false },
  })
  console.log(JSON.stringify({ partnerUserId: u.id, email: u.email }))
  process.exit(0)
}

main().catch((e) => {
  console.error('pw-set failed:', e)
  process.exit(1)
})
