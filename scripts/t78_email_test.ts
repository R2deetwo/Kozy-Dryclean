// =============================================================================
// Task 78 REAL email test — the Kozy Ladder + smart-nudge mails, sent ONLY
// to the owner's test world (the standing directive):
//   ✓ @woosh.dpdns.org test accounts (the seeded test members)
//   ✓ practiceprosystems@gmail.com (the owner, review copies)
//   ✗ NO real members, NO admin/staff inboxes
// =============================================================================
// Runs directly against the local seeded DB (no server needed) with:
//   NEXTAUTH_URL = https://kozycare.ng  → every button/link in the emails
//   points at the REAL production portal, so the owner can click through
//   the exact journey a member would see (the portal now shows all four
//   rungs: 1 / 3 / 6 / 12 months).
//   BREVO_API_KEY from .env.prod → real delivery through the real provider.
//
// What lands where:
//   1. Chuka  (prepaid 3 months before) → summary with the PREPAY-6 nudge
//      line (₦166,500 · ₦27,750 a month · ₦13,500 kinder) + the two
//      renewal buttons (gold next month / green 3 months)
//   2. Amaka  (power user, 4/4 + 1 extra)  → summary with the UPGRADE line
//      (The Household, right-sized, "whenever it suits you")
//   3. Bola   (loyal, always monthly)      → summary with the standing
//      ladder line (6 months ₦166,500 · a year ₦324,000 · ₦27,000 a month)
//   4. OWNER  → review copy of the PREPAY-12 render (Funke's: "A year with
//      Kozy is one payment of ₦324,000 — ₦27,000 a month, our kindest rate")
//   5. OWNER  → review copy of the CARD_AUTOMATIC + upgrade render
//      (Chidinma's: informational block, ladder ONCE as a sentence, the
//      usage-driven upgrade line, no payment buttons)
//   6. Chuka  → the months-aware activation email after a 6-month renewal
//      ("your next 6 months are covered — ₦166,500 for the whole stretch")
//
// The battery's sweep already wrote UPSELL_SHOWN ledger rows (the frequency
// governor working as designed) — cleared first so these review renders
// carry the nudges they are meant to demonstrate.
// =============================================================================
import fs from 'fs'
import path from 'path'

// The URLs inside the emails must point at PRODUCTION — set BEFORE any send.
process.env.NEXTAUTH_URL = 'https://kozycare.ng'

// Pull the real Brevo key from the pulled production env (never committed).
try {
  const raw = fs.readFileSync(path.join(__dirname, '..', '.env.prod'), 'utf8')
  const m = raw.match(/^BREVO_API_KEY="?([^"\n]+)"?/m)
  if (m) process.env.BREVO_API_KEY = m[1]
} catch {
  console.warn('[t78-email] .env.prod not found — no BREVO key, nothing sends')
}

async function main() {
  const { db } = await import('../src/lib/db')
  const { sendMonthlySummaryFor } = await import('../src/lib/member-emails')
  const { notifyMembershipActive } = await import('../src/lib/notifications')

  // Reset the nudge history so the review renders carry the nudges (the
  // battery's sweep spent them — by design; this is a display garden).
  const cleared = await db.subscriptionEvent.deleteMany({ where: { kind: 'UPSELL_SHOWN' } })
  console.log(`[t78-email] cleared ${cleared.count} UPSELL_SHOWN rows (render fresh for review)`)

  const subWithUser = async (email: string) => {
    const user = await db.user.findUnique({ where: { email } })
    if (!user) throw new Error(`no user ${email}`)
    const sub = await db.subscription.findFirst({
      where: { userId: user.id, status: 'ACTIVE' },
      include: { plan: true },
    })
    if (!sub) throw new Error(`no sub for ${email}`)
    return { ...sub, user: { id: user.id, name: user.name, email: user.email } } as any
  }

  const OWNER = 'practiceprosystems@gmail.com'

  // 1 — Chuka: the PREPAY-6 nudge (a proven 3-month pre-payer shown the
  //     next rung — quiet, one line, no button)
  const prepaidSub = await subWithUser('t78prepaid@woosh.dpdns.org')
  console.log('[t78-email] 1/6 → summary with PREPAY-6 nudge to t78prepaid@woosh.dpdns.org')
  await sendMonthlySummaryFor(prepaidSub)

  // 2 — Amaka: the UPGRADE nudge (power user, right-sized to Household)
  const powerSub = await subWithUser('t78power@woosh.dpdns.org')
  console.log('[t78-email] 2/6 → summary with UPGRADE nudge to t78power@woosh.dpdns.org')
  await sendMonthlySummaryFor(powerSub)

  // 3 — Bola: the standing ladder line (loyal monthly renewer — no
  //     behavioural line for someone who has never prepaid)
  const loyalSub = await subWithUser('t78loyal@woosh.dpdns.org')
  console.log('[t78-email] 3/6 → summary with the standing ladder line to t78loyal@woosh.dpdns.org')
  await sendMonthlySummaryFor(loyalSub)

  // 4 — The owner's review copy: the year rung (Funke's PREPAY-12 render)
  const deepSub = await subWithUser('t78deep@woosh.dpdns.org')
  console.log('[t78-email] 4/6 → owner review copy (PREPAY-12, the year rung) to', OWNER)
  await sendMonthlySummaryFor(deepSub, { overrideTo: OWNER })

  // 5 — The owner's review copy: the card member's render (informational
  //     block + ladder once as a sentence + the usage-driven upgrade line)
  const cardSub = await subWithUser('t78card@woosh.dpdns.org')
  console.log('[t78-email] 5/6 → owner review copy (CARD_AUTOMATIC + upgrade) to', OWNER)
  await sendMonthlySummaryFor(cardSub, { overrideTo: OWNER })

  // 6 — The months-aware activation email after a 6-month renewal is
  //     confirmed (card path or office-confirmed transfer)
  console.log('[t78-email] 6/6 → months-aware activation email (6 months) to t78prepaid@woosh.dpdns.org')
  await notifyMembershipActive({
    user: { name: 'Chuka Nwosu', email: 't78prepaid@woosh.dpdns.org' },
    planName: prepaidSub.plan.name,
    pricePaid: 166500,
    periodEnd: new Date(Date.now() + 183 * 24 * 60 * 60 * 1000),
    unitName: prepaidSub.plan.unitName,
    includedUnits: prepaidSub.plan.includedUnits,
    months: 6,
  })

  console.log('[t78-email] ALL SIX SENT — check the woosh inboxes + practiceprosystems@gmail.com')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .then(() => process.exit(0))
