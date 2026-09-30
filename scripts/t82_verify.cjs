// =============================================================================
// Task 82 battery — sessions, claims, cancellation, dash separation.
//
// Run against a local server started with MEMBER_EMAIL_TEST_MODE=1 and
// EMAIL_CAPTURE_DIR (see t82_run.sh). Everything asserts NEW surface:
//
//   [A] session isolation: two browser contexts (customer + admin); the
//       admin session can NEVER render the customer portal and vice versa;
//       the owner's exact scenario — admin sign-in replacing a customer
//       session in the SAME browser — ends at the console, never at member
//       data; the login page carries the one-session notice
//   [B] admin Memberships opens on the MEMBERS tab (not Plans & pricing)
//   [C] deleting a member with a membership works (the FK fix) and reports
//       the membership in the counts
//   [D] an open transfer claim: visible on the ADMIN roster, greyed months +
//       settled banner state on the MEMBER side, duplicate claims refused,
//       office confirm clears everything
//   [E] cancellation end to end: member cancel + undo (ledger rows),
//       withdraw-request frees the slot, the sweep applies the scheduled
//       CANCELLED and never emails someone who chose to leave
//   [F] the first-payment nudge: sent once to a 20-day-old pending member,
//       quiet on the immediate re-run (14-day gap)
//   [G] a member holding BOTH a laundry tier and the Shoe Club sees the two
//       separated on the dash — with the tier's included pairs named
// =============================================================================
const { chromium } = require('playwright')
const fs = require('fs')

const BASE = 'http://localhost:3000'
const CRON = 'kozy-dev-cron-secret-052'
const EMAIL_DIR = '/home/z/my-project/work/t82-emails'
let pass = 0
let fail = 0

function ok(name, cond, extra = '') {
  if (cond) {
    pass++
    console.log(`  PASS ${name}${extra ? ' — ' + extra : ''}`)
  } else {
    fail++
    console.log(`  FAIL ${name}${extra ? ' — ' + extra : ''}`)
  }
}

async function api(ctx, method, path, body) {
  return await ctx.request.fetch(`${BASE}${path}`, {
    method,
    ...(body ? { data: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : {}),
    maxRedirects: 0,
  })
}

async function login(page, email, password) {
  await page.goto(`${BASE}/login`)
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForTimeout(2500)
}

async function main() {
  const browser = await chromium.launch()

  // =========================================================================
  // [A] SESSION ISOLATION — two machines (contexts), then one browser
  // =========================================================================
  console.log('\n[A] session isolation')
  {
    const member = await browser.newContext()
    const mpage = await member.newPage()
    await login(mpage, 't82both@woosh.dpdns.org', 'T82Both!2026')
    ok('customer lands on /portal', mpage.url().includes('/portal'))
    const portalText = await mpage.textContent('body')
    ok('portal identifies the account (Customer account chip)', /Customer account/.test(portalText || ''))
    ok('portal greets by name', /Fade Ogun/.test(portalText || ''))
    // The dash glance (checked fully in [G]) — sanity here:
    ok('dash separates laundry and shoe care', /Laundry · The Household/.test(portalText || '') && /Shoe care ·/.test(portalText || ''))

    const admin = await browser.newContext()
    const apage = await admin.newPage()
    await login(apage, 't82admin@woosh.dpdns.org', 'T82Admin!2026')
    ok('admin lands on /admin', apage.url().includes('/admin'))

    // Wrong-role doors — each session only ever opens its own doors.
    await apage.goto(`${BASE}/portal`)
    await apage.waitForTimeout(1200)
    ok('admin session on /portal → bounced to /admin (no member data)', apage.url().includes('/admin'))
    ok('member header never rendered for the admin', !/Welcome back/.test((await apage.textContent('body')) || ''))

    await mpage.goto(`${BASE}/admin`)
    await mpage.waitForTimeout(1200)
    ok('customer session on /admin → bounced to /portal', mpage.url().includes('/portal'))
    ok('console never rendered for the customer', !/Atelier Console/.test((await mpage.textContent('body')) || ''))

    // The owner's EXACT scenario: sign in as super admin in the SAME browser
    // (same context) where the customer session lives. The old tab must end
    // up at the console redirect — never at customer data.
    await login(mpage, 't82admin@woosh.dpdns.org', 'T82Admin!2026')
    ok('admin sign-in in the customer browser lands on /admin', mpage.url().includes('/admin'))
    await mpage.goto(`${BASE}/portal`)
    await mpage.waitForTimeout(1200)
    ok('the old /portal tab now redirects to /admin (no member data leak)', mpage.url().includes('/admin'))
    const leaked = (await mpage.textContent('body')) || ''
    ok('no customer portal content rendered', !/Customer account/.test(leaked) && !/Book pickup/.test(leaked))

    // The one-session notice on the login page + the 12-hour lease notice.
    await mpage.goto(`${BASE}/login?expired=1`)
    await mpage.waitForTimeout(800)
    const loginText = (await mpage.textContent('body')) || ''
    ok('login explains one-browser-one-session', /One browser holds one Kozy session/.test(loginText))
    ok('login explains the 12-hour console lease', /12-hour limit/.test(loginText))

    // users/me under the admin session: alive (lease fresh).
    const me = await api(admin, 'GET', '/api/users/me')
    ok('admin heartbeat 200 (fresh lease)', me.status() === 200)

    await member.close()
    await admin.close()
  }

  // =========================================================================
  // [B] ADMIN MEMBERSHIPS — the Members tab opens first
  // =========================================================================
  console.log('\n[B] memberships tab order')
  {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await login(page, 't82admin@woosh.dpdns.org', 'T82Admin!2026')
    await page.goto(`${BASE}/admin`)
    await page.waitForTimeout(1500)
    await page.click('text=Memberships')
    await page.waitForTimeout(2000)
    const text = (await page.textContent('body')) || ''
    ok('memberships opens on the member roster', /Running members/.test(text))
    ok('a member row is visible', /Fade Ogun/.test(text))
    ok('plans editor NOT shown by default', !/The laundry tiers/.test(text))
    // The open claim on the roster (detail assertions in [D] via API):
    ok('open claim visible on the roster', /KZY-RENEW-T82TEST1/.test(text) && /85,000/.test(text))
    await page.screenshot({ path: 'work/t82-shots/01-admin-members-first-tab.png', fullPage: false })
    await ctx.close()
  }

  // =========================================================================
  // [C] DELETING A MEMBER WITH A MEMBERSHIP — the FK fix
  // =========================================================================
  console.log('\n[C] member deletion (the FK fix)')
  {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await login(page, 't82admin@woosh.dpdns.org', 'T82Admin!2026')

    const users = await (await api(ctx, 'GET', '/api/users?limit=100')).json()
    const target = (users.items || []).find((u) => u.email === 't82del@woosh.dpdns.org')
    ok('found the pending member in the CRM', Boolean(target))

    const res = await api(ctx, 'DELETE', `/api/users/${target.id}`, { confirm: 'DELETE' })
    ok('deletion succeeded (was an FK failure before)', res.status() === 200)
    const body = await res.json()
    ok('membership reported in the deletion counts', (body.deleted?.memberships ?? 0) >= 1, JSON.stringify(body.deleted))

    const subs = await (await api(ctx, 'GET', '/api/subscriptions')).json()
    ok('the member is off the roster', !(subs.items || []).some((m) => m.user?.email === 't82del@woosh.dpdns.org'))
    await ctx.close()
  }

  // =========================================================================
  // [D] THE OPEN CLAIM — admin roster, member card, duplicate guard, confirm
  // =========================================================================
  console.log('\n[D] the months claim, wired both sides')
  {
    // Admin side: the roster row carries the claim.
    const admin = await browser.newContext()
    await login(await admin.newPage(), 't82admin@woosh.dpdns.org', 'T82Admin!2026')
    const subs = await (await api(admin, 'GET', '/api/subscriptions')).json()
    const row = (subs.items || []).find((m) => m.user?.email === 't82claim@woosh.dpdns.org')
    ok('roster row exposes openClaim', Boolean(row?.openClaim))
    ok('claim months + amount correct', row?.openClaim?.months === 3 && row?.openClaim?.amount === 85000)

    // Member side: the portal shows the awaiting state (greyed months).
    const member = await browser.newContext()
    const mpage = await member.newPage()
    await login(mpage, 't82claim@woosh.dpdns.org', 'T82Claim!2026')
    await mpage.goto(`${BASE}/portal?renew=1`)
    await mpage.waitForTimeout(2500)
    let text = (await mpage.textContent('body')) || ''
    ok('member sees the awaiting-confirmation state', /Payment sent — awaiting the office/.test(text))
    ok('claimed rung tagged', /awaiting confirmation/.test(text))
    ok('the other months greyed out', /Months awaiting the office/.test(text))
    await mpage.screenshot({ path: 'work/t82-shots/02-member-claim-awaiting.png', fullPage: true })

    // Duplicate claim refused by the server.
    const meSubs = await (await api(member, 'GET', '/api/subscriptions/me')).json()
    const subId = meSubs.membership?.id
    const dup = await api(member, 'POST', '/api/subscriptions/renew', {
      subscriptionId: subId, months: 3, method: 'BANK_TRANSFER', claim: true,
    })
    ok('duplicate claim refused (409)', dup.status() === 409)
    const dupBody = await dup.json()
    ok('refusal explains itself', dupBody?.error === 'CLAIM_ALREADY_OPEN' && /No need to send it again/.test(dupBody?.message || ''))

    // Office confirms the 3 claimed months.
    const confirm = await api(admin, 'PATCH', `/api/subscriptions/${subId}`, {
      action: 'renew', months: 3, pricePaid: 85000,
    })
    ok('office confirm succeeds', confirm.status() === 200)

    // After the confirm: the claim is settled everywhere.
    const subs2 = await (await api(admin, 'GET', '/api/subscriptions')).json()
    const row2 = (subs2.items || []).find((m) => m.user?.email === 't82claim@woosh.dpdns.org')
    ok('claim cleared from the roster after confirm', !row2?.openClaim)
    const periodEnd = new Date(row2.periodEnd).getTime()
    const days = Math.round((periodEnd - Date.now()) / (24 * 60 * 60 * 1000))
    ok('period extended ~3 months', days >= 80 && days <= 113, `days=${days}`)

    // Plain /portal (no ?renew=1 — that deep link expands the payment card
    // on purpose): mid-cycle the card must collapse to the quiet line.
    await mpage.goto(`${BASE}/portal`)
    await mpage.waitForTimeout(2500)
    // Open the Membership tab (the glance strip is on the dashboard; the
    // renewal card lives in Membership).
    await mpage.click('text=Membership')
    await mpage.waitForTimeout(1500)
    text = (await mpage.textContent('body')) || ''
    ok('member card collapsed to covered-through (redundant months gone)', /Covered through/.test(text))
    ok('awaiting state gone', !/Months awaiting the office/.test(text))
    await mpage.screenshot({ path: 'work/t82-shots/03-member-after-confirm.png', fullPage: true })

    await admin.close()
    await member.close()
  }

  // =========================================================================
  // [F] THE FIRST-PAYMENT NUDGE — the stuck signup recovery (before [E]
  //     disturbs the pending members)
  // =========================================================================
  console.log('\n[F] first-payment nudge (stuck signups)')
  {
    fs.rmSync(EMAIL_DIR, { recursive: true, force: true })
    fs.mkdirSync(EMAIL_DIR, { recursive: true })
    const r1 = await fetch(`${BASE}/api/cron/member-emails`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${CRON}`, 'Content-Type': 'application/json' },
      body: '{}',
    })
    ok('sweep runs', r1.status === 200, `status=${r1.status}`)
    const s1 = await r1.json()
    ok('cancellation applied by the sweep (t82cancel)', (s1.cancellationsApplied ?? 0) >= 1, `applied=${s1.cancellationsApplied}`)
    ok('first-payment candidate found (t82stale)', (s1.firstPaymentCandidates ?? 0) >= 1, `candidates=${s1.firstPaymentCandidates}`)

    const emails = fs.existsSync(EMAIL_DIR) ? fs.readdirSync(EMAIL_DIR) : []
    const nudgeFiles = emails.filter((f) => f.includes('t82stale') || f.toLowerCase().includes('stale'))
    const anyNudge = emails.filter((f) => /waiting for its first payment|first[-_ ]?payment/i.test(f))
    ok('nudge email captured for the stuck member', nudgeFiles.length > 0 || anyNudge.length > 0, `files=${emails.slice(0, 6).join(', ')}`)

    // Second sweep: inside the 14-day gap — the nudge must NOT re-send.
    const r2 = await fetch(`${BASE}/api/cron/member-emails`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${CRON}`, 'Content-Type': 'application/json' },
      body: '{}',
    })
    const s2 = await r2.json()
    ok('quiet on the immediate re-run (14-day gap)', (s2.firstPaymentCandidates ?? 1) === 0, `candidates=${s2.firstPaymentCandidates}`)

    // And nobody who chose to leave got a paused email.
    const allEmails = fs.existsSync(EMAIL_DIR) ? fs.readdirSync(EMAIL_DIR) : []
    const cancelChased = allEmails.filter((f) => /t82cancel|Okoro/i.test(f))
    ok('no paused email chased the cancelling member', cancelChased.length === 0, `files=${cancelChased.join(',')}`)
  }

  // =========================================================================
  // [H] banner claim persistence + the withdraw guard (on t82stale)
  // =========================================================================
  console.log('\n[H] banner claim persistence + withdraw guard')
  {
    const member = await browser.newContext()
    const mpage = await member.newPage()
    await login(mpage, 't82stale@woosh.dpdns.org', 'T82Stale!2026')
    await mpage.goto(`${BASE}/portal`)
    await mpage.waitForTimeout(2500)
    let text = (await mpage.textContent('body')) || ''
    ok('stuck member sees the first-payment banner', /Complete your payment first/.test(text))
    ok('withdraw affordance present while unpaid', /Withdraw this request/.test(text))

    // Claim the first payment, then RELOAD — the awaiting state must persist
    // (it used to be a local React flag that evaporated).
    await mpage.click('text=Pay by bank transfer')
    await mpage.waitForTimeout(1500)
    await mpage.click("text=I've made payment")
    await mpage.waitForTimeout(2000)
    await mpage.reload()
    await mpage.waitForTimeout(2500)
    text = (await mpage.textContent('body')) || ''
    ok('claimed state survives the reload (server-side)', /Payment sent — awaiting the office/.test(text))
    ok('payment buttons rest while the claim is open', !/I've made payment/.test(text))
    await mpage.screenshot({ path: 'work/t82-shots/04-banner-claim-persistent.png', fullPage: true })

    // Withdraw is blocked while a payment is under review.
    const wd = await api(member, 'PATCH', '/api/subscriptions/me', { action: 'withdraw-request' })
    ok('withdraw blocked while payment under review (409)', wd.status() === 409)
    const wdBody = await wd.json()
    ok('blocked with the human reason', wdBody?.error === 'PAYMENT_UNDER_REVIEW')

    // The office activates them — the banner disappears.
    const admin = await browser.newContext()
    await login(await admin.newPage(), 't82admin@woosh.dpdns.org', 'T82Admin!2026')
    const subs = await (await api(admin, 'GET', '/api/subscriptions')).json()
    const row = (subs.items || []).find((m) => m.user?.email === 't82stale@woosh.dpdns.org')
    ok('roster shows the first-payment note', Boolean(row?.openClaim) && row?.openClaim?.isInitial === true)
    const verify = await api(admin, 'PATCH', `/api/subscriptions/${row.id}`, { action: 'verify' })
    ok('office verify succeeds', verify.status() === 200)
    await mpage.goto(`${BASE}/portal`)
    await mpage.waitForTimeout(2500)
    text = (await mpage.textContent('body')) || ''
    ok('banner gone once active', !/Complete your payment first/.test(text))
    ok('activated card shows the running membership', /Active/.test(text))
    await member.close()
    await admin.close()
  }

  // =========================================================================
  // [E] CANCELLATION — member cancel/undo ledger, withdraw + rejoin, sweep
  // =========================================================================
  console.log('\n[E] cancellation end to end')
  {
    const member = await browser.newContext()
    const mpage = await member.newPage()
    await login(mpage, 't82both@woosh.dpdns.org', 'T82Both!2026')
    await mpage.goto(`${BASE}/portal?renew=1`)
    await mpage.waitForTimeout(2500)
    let text = (await mpage.textContent('body')) || ''

    // Cancel at period end (tier) — then check the ledger + undo.
    await mpage.getByRole('button', { name: 'Cancel membership (runs to month end)' }).click()
    await mpage.waitForTimeout(900)
    // The confirm dialog's destructive button (exact name "Cancel" — the
    // underlying links say more than that).
    await mpage.getByRole('button', { name: 'Cancel', exact: true }).click()
    await mpage.waitForTimeout(1800)
    text = (await mpage.textContent('body')) || ''
    ok('cancel lands (undo appears)', /Undo — keep my membership/.test(text))

    const admin = await browser.newContext()
    await login(await admin.newPage(), 't82admin@woosh.dpdns.org', 'T82Admin!2026')
    let subs = await (await api(admin, 'GET', '/api/subscriptions')).json()
    let tierRow = (subs.items || []).find((m) => m.user?.email === 't82both@woosh.dpdns.org' && m.plan?.family !== 'SHOES')
    ok('roster flags not-renewing', tierRow?.cancelAtPeriodEnd === true)
    const drill = await (await api(admin, 'GET', `/api/subscriptions/${tierRow.id}`)).json()
    const evts = (drill?.activity?.events || []).map((e) => e.kind)
    ok('ledger carries CANCELLATION_SCHEDULED', evts.includes('CANCELLATION_SCHEDULED'))

    // Undo.
    const undo = await api(member, 'PATCH', '/api/subscriptions/me', { action: 'cancel-undo' })
    ok('undo succeeds', undo.status() === 200)
    const drill2 = await (await api(admin, 'GET', `/api/subscriptions/${tierRow.id}`)).json()
    const evts2 = (drill2?.activity?.events || []).map((e) => e.kind)
    ok('ledger carries CANCELLATION_UNDONE', evts2.includes('CANCELLATION_UNDONE'))

    // Withdraw on a LIVE membership: refused with guidance (only unpaid
    // requests can be withdrawn — a running one uses cancel-at-period-end).
    const wdLive = await api(member, 'PATCH', '/api/subscriptions/me', { action: 'withdraw-request' })
    ok('withdraw on a live membership refused (409)', wdLive.status() === 409)
    const wdLiveBody = await wdLive.json()
    ok('refusal points at Cancel membership instead', /Cancel membership/i.test(wdLiveBody?.message || ''))

    // Withdraw the fresh pending request (t82withdraw) — then re-join.
    const fresh = await browser.newContext()
    const fpage = await fresh.newPage()
    await login(fpage, 't82withdraw@woosh.dpdns.org', 'T82With!2026')
    const wd = await api(fresh, 'PATCH', '/api/subscriptions/me', { action: 'withdraw-request' })
    ok('withdraw succeeds (200)', wd.status() === 200)
    const rejoin = await api(fresh, 'POST', '/api/subscriptions', { planCode: 'HOUSEHOLD', paymentMethod: 'BANK_TRANSFER' })
    ok('slot freed — a fresh join works after withdrawing', rejoin.status() === 201)

    // The sweep already applied t82cancel's CANCELLED (in [F]) — verify state.
    subs = await (await api(admin, 'GET', '/api/subscriptions')).json()
    const cancelledRow = (subs.items || []).find((m) => m.user?.email === 't82cancel@woosh.dpdns.org')
    ok('scheduled cancellation applied (status CANCELLED)', cancelledRow?.status === 'CANCELLED')
    const drillC = await (await api(admin, 'GET', `/api/subscriptions/${cancelledRow.id}`)).json()
    const evtsC = (drillC?.activity?.events || []).map((e) => e.kind)
    ok('ledger carries CANCELLED_APPLIED', evtsC.includes('CANCELLED_APPLIED'))

    await member.close()
    await admin.close()
    await fresh.close()
  }

  // =========================================================================
  // [G] BOTH FAMILIES — separated on the dash, tier pairs named
  // =========================================================================
  console.log('\n[G] laundry + shoe care, separated')
  {
    const member = await browser.newContext()
    const mpage = await member.newPage()
    await login(mpage, 't82both@woosh.dpdns.org', 'T82Both!2026')
    await mpage.goto(`${BASE}/portal`)
    await mpage.waitForTimeout(2500)
    let text = (await mpage.textContent('body')) || ''
    ok('dash: laundry line names the tier', /Laundry · The Household/.test(text))
    ok('dash: shoe line names the club pairs', /3 of 4 club pairs left/.test(text))
    ok('dash: tier pairs called out in the shoe line', /plus 2 pairs from The Household included/.test(text))
    await mpage.screenshot({ path: 'work/t82-shots/05-dash-both-families.png', fullPage: false })

    await mpage.goto(`${BASE}/portal`)
    await mpage.waitForTimeout(2200)
    await mpage.click('text=Membership')
    await mpage.waitForTimeout(1500)
    text = (await mpage.textContent('body')) || ''
    ok('tier card: clothing meters separate from shoes', /Kozy Box pickups/.test(text))
    ok('tier card: the shoe allowance becomes a quiet note', /also includes 2 shoe cleans a month/.test(text))
    ok('club card names the tier pairs separately', /The Household tier separately includes 2 shoe cleans a month/.test(text))
    await mpage.screenshot({ path: 'work/t82-shots/06-membership-tab-separated.png', fullPage: true })

    await member.close()
  }

  // =========================================================================
  // [I] THE CLAIM IN THE OPERATIONS FEED + the deep link (the owner's exact
  //     complaint: the email arrived, the dashboard had nothing to approve)
  // =========================================================================
  console.log('\n[I] claim lands in Operations + deep links work')
  {
    fs.rmSync(EMAIL_DIR, { recursive: true, force: true })
    fs.mkdirSync(EMAIL_DIR, { recursive: true })
    // A fresh claim on t82claim (its seeded claim was confirmed in [D]).
    const member = await browser.newContext()
    await login(await member.newPage(), 't82claim@woosh.dpdns.org', 'T82Claim!2026')
    const meSubs = await (await api(member, 'GET', '/api/subscriptions/me')).json()
    const claim = await api(member, 'POST', '/api/subscriptions/renew', {
      subscriptionId: meSubs.membership?.id, months: 3, method: 'BANK_TRANSFER', claim: true,
    })
    ok('fresh claim accepted', claim.status() === 200)

    // The Operations feed now carries the claim event.
    const admin = await browser.newContext()
    const apage = await admin.newPage()
    await login(apage, 't82admin@woosh.dpdns.org', 'T82Admin!2026')
    const notes = await (await api(admin, 'GET', '/api/admin/notifications')).json()
    const feed = notes.items || notes.events || []
    const claimEvent = feed.find((n) => n.type === 'MEMBERSHIP_CLAIM')
    ok('MEMBERSHIP_CLAIM event in the feed', Boolean(claimEvent), claimEvent?.title || 'not found')
    ok('feed event links to memberships', claimEvent?.linkTab === 'memberships')

    // The email CTA deep-links to the Members tab (not a dashboard dump).
    await new Promise((r) => setTimeout(r, 1200))
    const emails = fs.existsSync(EMAIL_DIR) ? fs.readdirSync(EMAIL_DIR) : []
    const claimMail = emails.find((f) => /renewal|claim/i.test(f))
    let ctaOK = false
    if (claimMail) {
      const html = fs.readFileSync(`${EMAIL_DIR}/${claimMail}`, 'utf8')
      ctaOK = html.includes('/admin?tab=memberships')
    }
    ok('email CTA lands on /admin?tab=memberships', ctaOK, claimMail || 'no mail captured')

    // UI: the feed row is clickable and lands on the Members roster.
    await apage.goto(`${BASE}/admin`)
    await apage.waitForTimeout(2200)
    await apage.click('text=Notifications')
    await apage.waitForTimeout(1800)
    let text = (await apage.textContent('body')) || ''
    ok('feed shows the claim row', /claims a 3-month renewal/.test(text))
    await apage.click('text=claims a 3-month renewal')
    await apage.waitForTimeout(1800)
    text = (await apage.textContent('body')) || ''
    ok('clicking the row lands on the Members roster', /Running members/.test(text) && /Nnamdi Kalu/.test(text))
    ok('the open claim sits right on the roster row', /KZY-RENEW-/.test(text))

    // The email CTA path itself: /admin?tab=memberships opens straight there.
    await apage.goto(`${BASE}/admin?tab=memberships`)
    await apage.waitForTimeout(2500)
    text = (await apage.textContent('body')) || ''
    ok(
      '?tab=memberships opens the Members tab directly',
      /Running members/.test(text) && /The Kozy Circle/.test(text) && /Members\b/.test(text)
    )
    await apage.screenshot({ path: 'work/t82-shots/07-admin-tab-deep-link.png', fullPage: false })

    // Clean the claim up: confirm it, so later sections start clean.
    const subs = await (await api(admin, 'GET', '/api/subscriptions')).json()
    const row = (subs.items || []).find((m) => m.user?.email === 't82claim@woosh.dpdns.org')
    await api(admin, 'PATCH', `/api/subscriptions/${row.id}`, { action: 'renew', months: 3, pricePaid: 85000 })
    await member.close()
    await admin.close()
  }

  // =========================================================================
  // [J] THE JOIN CARD — laundry pricing honest, the Shoe Club separate
  // =========================================================================
  console.log('\n[J] join card pricing (the N3,000 confusion)')
  {
    // A customer with NO memberships sees the JoinCard (inside the
    // Membership tab of the portal).
    const member = await browser.newContext()
    const mpage = await member.newPage()
    await login(mpage, 't82withdraw@woosh.dpdns.org', 'T82With!2026')
    // t82withdraw re-joined HOUSEHOLD in [E] and is PENDING again — withdraw
    // once more so the JoinCard renders.
    const wd = await api(member, 'PATCH', '/api/subscriptions/me', { action: 'withdraw-request' })
    ok('rejoined request withdrawn so the JoinCard shows', wd.status() === 200)
    await mpage.goto(`${BASE}/portal`)
    await mpage.waitForTimeout(2500)
    await mpage.click('text=Membership')
    await mpage.waitForTimeout(1800)
    const text = (await mpage.textContent('body')) || ''
    ok('plans start at the LAUNDRY price (₦30,000)', /Plans start at ₦30,000 a month/.test(text))
    ok('no ₦3,000 claim next to the laundry plans', !/start at ₦3,000/.test(text))
    ok('the Shoe Club named separately with its own door', /The Shoe Club/.test(text) && /sold separately from the laundry plans/.test(text))
    await mpage.screenshot({ path: 'work/t82-shots/08-join-card-pricing.png', fullPage: false })
    await member.close()
  }

  // =========================================================================
  // [K] KIT TAG PRIVACY — the QR destination leaks nothing to a stranger
  // =========================================================================
  console.log('\n[K] kit tag (QR) privacy')
  {
    const TAG = 'KZK-T82BTH'
    // 1. Anonymous scanner: brand-only, nothing personal.
    const anon = await browser.newContext()
    const anonApi = anon.request
    const r1 = await anonApi.fetch(`${BASE}/api/kit/${TAG}`)
    const pub = await r1.json()
    ok('anonymous scan: scope public', pub.scope === 'public')
    ok('anonymous scan: no member object', !pub.member)
    ok('anonymous scan: no phone/email anywhere', !JSON.stringify(pub).match(/@|\+234|phone/i))
    const apage = await anon.newPage()
    await apage.goto(`${BASE}/kit/${TAG}`)
    await apage.waitForTimeout(2000)
    let text = (await apage.textContent('body')) || ''
    ok('public page shows the sign-in gate note', /private/.test(text) && /signed into their own account/.test(text))
    ok('public page: sign-in CTA present', /Is this your kit\? Sign in to see it/.test(text))
    ok('public page: NO member name shown', !/Fade Ogun/.test(text))
    await apage.screenshot({ path: 'work/t82-shots/09-kit-public.png', fullPage: false })

    // 2. A DIFFERENT signed-in member: still public (not their kit).
    const other = await browser.newContext()
    const opage = await other.newPage()
    await login(opage, 't82stale@woosh.dpdns.org', 'T82Stale!2026')
    const r2 = await other.request.fetch(`${BASE}/api/kit/${TAG}`)
    const theirs = await r2.json()
    ok('another member scanning: still public scope', theirs.scope === 'public')
    await opage.goto(`${BASE}/kit/${TAG}`)
    await opage.waitForTimeout(2000)
    const text2 = (await opage.textContent('body')) || ''
    ok('another member sees the honest privacy note', /this kit belongs to another member/.test(text2))
    ok('another member: no name leaked', !/Fade Ogun/.test(text2))

    // 3. The OWNER signed in: their own kit, full snapshot, no phone needed.
    const owner = await browser.newContext()
    const opage2 = await owner.newPage()
    await login(opage2, 't82both@woosh.dpdns.org', 'T82Both!2026')
    const r3 = await owner.request.fetch(`${BASE}/api/kit/${TAG}`)
    const own = await r3.json()
    ok('owner scan: scope member', own.scope === 'member')
    ok('owner scan: their name + plan', own.member?.name === 'Fade Ogun' && /Household/.test(own.planName || ''))
    await opage2.goto(`${BASE}/kit/${TAG}`)
    await opage2.waitForTimeout(2000)
    text = (await opage2.textContent('body')) || ''
    ok('owner page: "This is your kit" chip', /This is your kit/.test(text))
    ok('owner page: usage visible', /This cycle/.test(text))
    await opage2.screenshot({ path: 'work/t82-shots/10-kit-owner.png', fullPage: false })

    // 4. The OFFICE signed in: the full identification snapshot with phone.
    const admin = await browser.newContext()
    const adpage = await admin.newPage()
    await login(adpage, 't82admin@woosh.dpdns.org', 'T82Admin!2026')
    const r4 = await admin.request.fetch(`${BASE}/api/kit/${TAG}`)
    const office = await r4.json()
    ok('office scan: scope office', office.scope === 'office')
    ok('office scan: phone present (the wash-floor use case)', Boolean(office.member?.phone))
    await adpage.goto(`${BASE}/kit/${TAG}`)
    await adpage.waitForTimeout(2000)
    const officeText = (await adpage.textContent('body')) || ''
    ok('office page: viewing-as chip + member name', /Viewing as the Kozy office/.test(officeText) && /Fade Ogun/.test(officeText))
    await adpage.screenshot({ path: 'work/t82-shots/11-kit-office.png', fullPage: false })

    await anon.close()
    await other.close()
    await owner.close()
    await admin.close()
  }

  await browser.close()
  console.log(`\n=== ${pass} passed, ${fail} failed ===`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error('BATTERY CRASHED:', e)
  process.exit(1)
})
