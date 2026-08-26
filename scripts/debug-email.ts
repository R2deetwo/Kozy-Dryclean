// Check all unverified users + test email send
import { db } from '../src/lib/db'
import { sendVerificationEmail } from '../src/lib/email'

async function main() {
  // List all unverified users
  const users = await db.user.findMany({
    where: { emailVerified: null },
    select: { id: true, email: true, name: true, role: true, createdAt: true }
  })

  console.log(`\n=== UNVERIFIED USERS (${users.length}) ===`)
  for (const u of users) {
    console.log(`  ${u.email} (created ${u.createdAt.toISOString()})`)
  }

  // Try sending a test email to see if Brevo actually works
  console.log('\n=== TESTING BREVO EMAIL SEND ===')
  try {
    // Generate a fake token for testing
    await sendVerificationEmail('chigozieubahesq@gmail.com', 'Test User', 'test-token-123')
    console.log('Email sent successfully to chigozieubahesq@gmail.com')
  } catch (e: any) {
    console.log('EMAIL SEND FAILED:', e.message)
  }
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
