// =============================================================================
// Task 77 REAL email test — the redesigned member mails, sent ONLY to the
// owner's test world (the standing directive):
//   ✓ @woosh.dpdns.org test accounts (the seeded test members)
//   ✓ practiceprosystems@gmail.com (the owner, "as the case may require")
//   ✗ NO real members, NO admin/staff inboxes
// =============================================================================
// Runs directly against the local seeded DB (no server needed) with:
//   NEXTAUTH_URL = https://kozycare.ng  → every button/link in the emails
//   points at the REAL production renewal page, so the owner can click
//   through the exact journey a member would see.
//   BREVO_API_KEY from .env.prod → real delivery through the real provider.
//
// What lands where:
//   1. Chidinma (card member)       → summary, CARD_AUTOMATIC render (the
//                                      informational block + the quiet
//                                      3-month offer line)
//   2. Tunde (transfer member)      → summary, NEEDS_PAYMENT render — THE
//                                      REDESIGN: gold "Pay next month —
//                                      ₦30,000" + green "Pay 3 months —
//                                      ₦85,000 · you save ₦5,000"
//   3. Ngozi (lapsed member)        → the paused/reactivation email (the
//                                      same two-button pattern)
//   4. practiceprosystems@gmail.com → Tunde's summary again WITH the Kozy
//                                      Store line (the store is switched on
//                                      for this one render, then off again)
//                                      — the owner reviews the strategic
//                                      placement without it ever reaching a
//                                      member
//   5. practiceprosystems@gmail.com → the office-side alert for Tunde's
//                                      claimed 3-month transfer (₦85,000)
//   6. Tunde                        → the months-aware activation email
//                                      ("your next 3 months are covered")
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
  console.warn('[t77-email] .env.prod not found — no BREVO key, nothing sends')
}

// The office alert during THIS test may only reach the owner (the directive:
// no admin/staff inboxes except practiceprosystems@gmail.com).
process.env.ADMIN_ALERTS_EMAIL = 'practiceprosystems@gmail.com'

async function main() {
  const { db } = await import('../src/lib/db')
  const { sendMonthlySummaryFor, sendPausedFor } = await import('../src/lib/member-emails')
  const {
    notifyAdminRenewalTransferPending,
    notifyMembershipActive,
  } = await import('../src/lib/notifications')
  const { getAppSettings, saveAppSettings } = await import('../src/lib/app-settings')

  // The local admin_alerts_email must be the owner only for this test.
  const settings = await getAppSettings()
  if (settings.adminAlertsEmail !== 'practiceprosystems@gmail.com') {
    await saveAppSettings({ adminAlertsEmail: 'practiceprosystems@gmail.com' })
    console.log('[t77-email] local admin_alerts_email → practiceprosystems@gmail.com (test only)')
  }

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

  // 1 — Chidinma: card member summary (informational + the 3-month line)
  const cardSub = await subWithUser('t77card@woosh.dpdns.org')
  console.log('[t77-email] 1/6 → summary (CARD_AUTOMATIC) to t77card@woosh.dpdns.org')
  await sendMonthlySummaryFor(cardSub)

  // 2 — Tunde: transfer member summary (the two-button redesign)
  const transferSub = await subWithUser('t77transfer@woosh.dpdns.org')
  console.log('[t77-email] 2/6 → summary (NEEDS_PAYMENT, two buttons) to t77transfer@woosh.dpdns.org')
  await sendMonthlySummaryFor(transferSub)

  // 3 — Ngozi: the paused/reactivation email (two buttons)
  const lapsedSub = await subWithUser('t77lapsed@woosh.dpdns.org')
  console.log('[t77-email] 3/6 → paused/reactivation to t77lapsed@woosh.dpdns.org')
  await sendPausedFor(lapsedSub)

  // 4 — The owner's review copy WITH the Kozy Store line: switch the store
  //     on for this single render, then straight back off. The store ships
  //     dark — this preview is the only way to see the line today, and it
  //     goes to the owner's inbox alone.
  console.log('[t77-email] 4/6 → owner review copy (store line preview) to', OWNER)
  await saveAppSettings({ storeEnabled: true })
  try {
    await sendMonthlySummaryFor(transferSub, { overrideTo: OWNER })
  } finally {
    await saveAppSettings({ storeEnabled: false })
    console.log('[t77-email] store switched back OFF (ships dark)')
  }

  // 5 — The office alert for a claimed 3-month transfer renewal (₦85,000)
  console.log('[t77-email] 5/6 → office alert: 3-month transfer claim (owner only)')
  await notifyAdminRenewalTransferPending({
    member: { name: 'Tunde Balogun', email: 't77transfer@woosh.dpdns.org' },
    planName: transferSub.plan.name,
    months: 3,
    amount: 85000,
    transferReference: 'KZY-RENEW-T77TEST01',
    receiptUrl: null,
  })

  // 6 — The months-aware activation email after a 3-month renewal is
  //     confirmed (card path or office-confirmed transfer)
  console.log('[t77-email] 6/6 → months-aware activation email to t77transfer@woosh.dpdns.org')
  await notifyMembershipActive({
    user: { name: 'Tunde Balogun', email: 't77transfer@woosh.dpdns.org' },
    planName: transferSub.plan.name,
    pricePaid: 85000,
    periodEnd: new Date(Date.now() + 93 * 24 * 60 * 60 * 1000),
    unitName: transferSub.plan.unitName,
    includedUnits: transferSub.plan.includedUnits,
    months: 3,
  })

  console.log('[t77-email] ALL SIX SENT — check the woosh inboxes + practiceprosystems@gmail.com')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .then(() => process.exit(0))
