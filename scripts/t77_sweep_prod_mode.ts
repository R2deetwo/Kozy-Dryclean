// =============================================================================
// Task 77 — the ALWAYS-ON proof, in-process. Runs the sweep exactly the way
// production does: MEMBER_EMAIL_TEST_MODE deliberately UNSET, so every real
// member in the window receives (the owner's phase-77 directive). Called by
// the battery AFTER the server-side test-mode sweep, with the capture dir
// set so the outsider's email lands as a file the assertions can read.
// (No BREVO key locally — sendEmail no-ops after the capture hook.)
// =============================================================================
delete process.env.MEMBER_EMAIL_TEST_MODE

async function main() {
  const { runMemberEmailSweep } = await import('../src/lib/member-emails')
  const result = await runMemberEmailSweep({})
  console.log(JSON.stringify(result, null, 2))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .then(() => process.exit(0))
