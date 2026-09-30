// =============================================================================
// Task 79 REAL email test — the NAVY prepay button, sent ONLY to the owner's
// test world (the standing directive):
//   ✓ @woosh.dpdns.org test accounts
//   ✓ practiceprosystems@gmail.com (the owner, review copy)
//   ✗ NO real members, NO admin/staff inboxes
//
// The owner's complaint: the 3-month upsell button was GREEN — not a brand
// colour. This test delivers the corrected render: gold "Pay next month" +
// NAVY "Pay 3 months — ₦85,000 · you save ₦5,000" (savings note in gold).
//
// Runs against the local seeded DB (t79 members) with:
//   NEXTAUTH_URL = https://kozycare.ng → every button points at the REAL
//   production portal; BREVO_API_KEY from .env.prod → real delivery.
// =============================================================================
import fs from 'fs'
import path from 'path'

process.env.NEXTAUTH_URL = 'https://kozycare.ng'

try {
  const raw = fs.readFileSync(path.join(__dirname, '..', '.env.prod'), 'utf8')
  const m = raw.match(/^BREVO_API_KEY="?([^"\n]+)"?/m)
  if (m) process.env.BREVO_API_KEY = m[1]
} catch {
  console.warn('[t79-email] .env.prod not found — no BREVO key, nothing sends')
}

async function main() {
  const { db } = await import('../src/lib/db')
  const { sendMonthlySummaryFor, sendPausedFor } = await import('../src/lib/member-emails')

  const subWithUser = async (email: string) => {
    const user = await db.user.findUnique({ where: { email } })
    if (!user) throw new Error(`no user ${email}`)
    const sub = await db.subscription.findFirst({
      where: { userId: user.id },
      include: { plan: true },
    })
    if (!sub) throw new Error(`no sub for ${email}`)
    return { ...sub, user: { id: user.id, name: user.name, email: user.email } } as any
  }

  const OWNER = 'practiceprosystems@gmail.com'

  // 1 — The corrected summary (the exact email the owner flagged): the two
  //     renewal buttons, gold + NAVY, savings spelled out.
  const activeSub = await subWithUser('t79active@woosh.dpdns.org')
  console.log('[t79-email] 1/3 → NEEDS_PAYMENT summary (gold + NAVY buttons) to t79active@woosh.dpdns.org')
  await sendMonthlySummaryFor(activeSub)

  // 2 — The paused/reactivation email: the same navy 3-month pairing.
  //     (sendPausedFor sends to the member's own address — the seeded
  //     t79past test account, squarely inside the woosh test world.)
  const pastSub = await subWithUser('t79past@woosh.dpdns.org')
  console.log('[t79-email] 2/3 → paused/reactivation email (gold + NAVY) to t79past@woosh.dpdns.org')
  await sendPausedFor(pastSub)

  // 3 — The owner's review copy: the same two-button summary, straight to
  //     practiceprosystems@gmail.com (never a real member's address).
  console.log('[t79-email] 3/3 → owner review copy of the two-button summary to ' + OWNER)
  await sendMonthlySummaryFor(activeSub, { overrideTo: OWNER })

  console.log('[t79-email] done — 3 sends, all inside the test world')
}

main()
  .catch((e) => {
    console.error('[t79-email] FAILED:', e)
    process.exit(1)
  })
  .finally(() => process.exit(0))
