// Task 81 prod cleanup — remove the woosh E2E test members created while
// verifying the payment UX on kozycare.ng. Only @woosh.dpdns.org test
// addresses are ever touched. DATABASE_URL is passed via env (decrypted
// DIRECT_URL), never written to a file.
const { PrismaClient } = require('@prisma/client')
const db = new PrismaClient()

const EMAILS = [
  '98ym6zfuax@woosh.dpdns.org', // run 1 — activated by the office-verify step
  'gwtwdq57ug@woosh.dpdns.org', // run 2 — activated by the office-verify step
  'yw9bers2ab@woosh.dpdns.org', // run 0 — signup completed, never verified
]

async function main() {
  for (const email of EMAILS) {
    const user = await db.user.findUnique({ where: { email } })
    if (!user) {
      console.log(`  ${email}: not present (already clean)`)
      continue
    }
    const subs = await db.subscription.findMany({ where: { userId: user.id }, select: { id: true } })
    for (const s of subs) {
      await db.subscriptionEvent.deleteMany({ where: { subscriptionId: s.id } })
      await db.subscription.delete({ where: { id: s.id } })
    }
    // Any straggler rows referencing the user (orders, payments, etc.)
    await db.order.deleteMany({ where: { userId: user.id } })
    await db.user.delete({ where: { id: user.id } })
    console.log(`  ${email}: removed (${subs.length} subscription${subs.length === 1 ? '' : 's'})`)
  }
  const remaining = await db.user.count({ where: { email: { in: EMAILS } } })
  console.log(`final check — remaining t81 test users: ${remaining}`)
  if (remaining !== 0) process.exit(1)
}

main()
  .catch((e) => {
    console.error('CLEANUP FAILED:', e.message)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
