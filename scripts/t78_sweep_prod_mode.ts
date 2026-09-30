// =============================================================================
// Task 78 — the ALWAYS-ON proof, in-process (same as t77's): runs the sweep
// exactly the way production does, MEMBER_EMAIL_TEST_MODE deliberately
// UNSET, so a real member in the window receives. The battery runs it AFTER
// the test-mode sweep: everyone allowlisted already has their SUMMARY_SENT
// row, so the only new send is the OUTSIDER — proving (a) always-on and
// (b) suppression never spent the dedupe row.
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
