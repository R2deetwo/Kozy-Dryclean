// =============================================================================
// Phase 55 — send the TEST RIDER's welcome email to the owner's inbox
// =============================================================================
// Runs from the dev environment with EMAIL_OVERRIDE_TO=practiceprosystems@gmail.com
// so the send lands in the owner's Gmail, while baseUrl() (fixed this phase)
// stamps PRODUCTION links — "Open the rider app" now goes to
// https://kozycare.ng/login?email=practiceprosystems%2Brider@gmail.com.
//
// The email carries the initial password for the account the test rig just
// created in PRODUCTION — clicking through, signing in and being walked
// through the password change IS the test.
//
// Run: source work/p55-env.env && BREVO creds + override, see p55_send_welcome.sh
// =============================================================================

process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54329/kozy'
process.env.DIRECT_URL = process.env.DATABASE_URL

async function main() {
  const { notifyRiderApproved } = await import('../src/lib/notifications')

  const res = await notifyRiderApproved({
    to: 'practiceprosystems+rider@gmail.com',
    name: 'Test Rider (Owner)',
    password: 'KozyTestRider!55',
    managerName: 'the Kozy Care team',
    refCode: 'KZR-TEST',
    lga: 'Lekki',
    note: 'This is YOUR test account for trying the rider app end to end. Sign in, set your own password, open the pickup stop (KZ-55555001, Admiralty Way, Lekki), try Call / Navigate / Report a problem, then swipe to confirm the pickup. Ask the office (your own admin console) to move the order along and watch the emails arrive in this inbox.',
  })

  console.log('welcome email delivery:', JSON.stringify(res))
  if (!res.ok) process.exit(1)
}

main().catch((e) => {
  console.error('FATAL', e)
  process.exit(1)
})
