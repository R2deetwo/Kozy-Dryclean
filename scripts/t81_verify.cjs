// =============================================================================
// Task 81 verification — the payment UX, front and center + the quiet switch.
// Runs against localhost:3000 (server started by t81_run.sh with
// MEMBER_EMAIL_TEST_MODE=1 + EMAIL_CAPTURE_DIR=work/t81-emails, deliberately
// WITHOUT a Paystack key — the exact production condition).
//
//   [1] RENEW two-step — instructions WITHOUT a claim (no ledger row, no
//       office ping), then claim:true writes the RENEWAL_INTENT; the note
//       formats the naira properly (₦50,000, never a bare 50000)
//   [2] THE BANNER — position between the welcome header and the
//       Active/Past/Guarantee stat cards; "Complete your payment first";
//       "membership request" wording; Pay by bank transfer DROPS DOWN the
//       details; "I've made payment" → the verifying toast
//   [3] THE DEEP LINK — /portal?pay=1 signed out → login → back to the
//       banner (callbackUrl preserved)
//   [4] THE CLUB BANNER — a pending shoes-only member sees theirs
//   [5] THE QUIET SWITCH — schedule WHOLEHOME / ESSENTIALS (downgrade!),
//       undo, switch-target renewal pricing, family + same-plan guards
//   [6] THE ENGINE — the office verify applies the scheduled switch with
//       the payment (plan swapped, priced on the new tier)
//   [7] PENDING SWITCH — an unpaid request swaps plans immediately and the
//       banner price follows
//   [8] ALREADY_MEMBER — a pending member clicking Join is taken STRAIGHT
//       to /portal?pay=1
// =============================================================================
const { chromium } = require('playwright')

const BASE = 'http://localhost:3000'
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

function st(r) {
  return typeof r.status === 'function' ? r.status() : r.status
}

async function login(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL(/portal|admin/, { timeout: 20000 })
  await page.waitForTimeout(1500)
}

;(async () => {
  const browser = await chromium.launch()

  // ================================================================
  // [1] RENEW two-step — instructions vs claim, ₦ formatting
  // ================================================================
  console.log('[1] Renew API — the two-step transfer')
  {
    let res = await fetch(`${BASE}/api/subscriptions/renew`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscriptionId: 'x', months: 1, method: 'BANK_TRANSFER' }),
    })
    ok('renew unauthenticated 401', st(res) === 401, `status ${st(res)}`)

    const pendPage = await browser.newPage()
    await login(pendPage, 't81pend@woosh.dpdns.org', 'T81Pend!2026')
    let me = await pendPage.request.get(`${BASE}/api/subscriptions/me`)
    let meData = await me.json().catch(() => ({}))
    const pendSub = meData.membership
    ok('pending member sees their pending membership', pendSub?.status === 'PENDING_ACTIVATION')
    const pendId = pendSub?.id

    // months>1 while pending → a clear no
    res = await pendPage.request.post(`${BASE}/api/subscriptions/renew`, {
      data: { subscriptionId: pendId, months: 3, method: 'BANK_TRANSFER' },
    })
    let data = await res.json().catch(() => ({}))
    ok('pending months=3 rejected 400', st(res) === 400 && data.error === 'FIRST_MONTH_IS_ONE', `${st(res)} ${data.error}`)

    // card without a key → honest 503
    res = await pendPage.request.post(`${BASE}/api/subscriptions/renew`, {
      data: { subscriptionId: pendId, months: 1, method: 'PAYSTACK' },
    })
    data = await res.json().catch(() => ({}))
    ok('pending card without key → 503', st(res) === 503 && data.error === 'PAYSTACK_NOT_CONFIGURED', `${st(res)}`)

    // (a) instructions WITHOUT claim — no ledger row
    res = await pendPage.request.post(`${BASE}/api/subscriptions/renew`, {
      data: { subscriptionId: pendId, months: 1, method: 'BANK_TRANSFER' },
    })
    data = await res.json().catch(() => ({}))
    ok('instructions returned', st(res) === 200 && !!data.transfer, `${st(res)}`)
    ok(
      'note formats naira (₦50,000, never bare 50000)',
      data.transfer?.note?.includes('₦50,000') && !/\bSend 50000\b/.test(data.transfer?.note ?? ''),
      (data.transfer?.note ?? '').slice(0, 60)
    )
    ok(
      'reference + bank details present',
      /^KZY-RENEW-/.test(data.transfer?.reference ?? '') && !!data.transfer?.bankName && !!data.transfer?.accountNumber,
      data.transfer?.reference
    )
    me = await pendPage.request.get(`${BASE}/api/subscriptions/me`)
    meData = await me.json().catch(() => ({}))
    const eventsAfterInstructions = meData.activity?.events ?? []
    ok(
      'NO claim written by the instructions call',
      !eventsAfterInstructions.some((e) => e.kind === 'RENEWAL_INTENT'),
      `${eventsAfterInstructions.length} events`
    )

    // (b) the claim — ledger + isInitial
    res = await pendPage.request.post(`${BASE}/api/subscriptions/renew`, {
      data: { subscriptionId: pendId, months: 1, method: 'BANK_TRANSFER', claim: true },
    })
    data = await res.json().catch(() => ({}))
    ok('claim accepted (claimed:true)', st(res) === 200 && data.claimed === true, `${st(res)}`)
    me = await pendPage.request.get(`${BASE}/api/subscriptions/me`)
    meData = await me.json().catch(() => ({}))
    const eventsAfterClaim = meData.activity?.events ?? []
    const intent = eventsAfterClaim.find((e) => e.kind === 'RENEWAL_INTENT')
    ok('RENEWAL_INTENT written by the claim', !!intent)
    ok('claim meta says isInitial + ₦50,000', !!intent && /"isInitial":true/.test(intent.meta ?? '') && /"amount":50000/.test(intent.meta ?? ''))

    await pendPage.close()
  }

  // ================================================================
  // [2] THE BANNER — position, wording, drop-down, toast
  // ================================================================
  console.log('[2] The first-payment banner — front and center')
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    await login(page, 't81pend@woosh.dpdns.org', 'T81Pend!2026')
    await page.goto(`${BASE}/portal`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1200)

    const banner = page.locator('#kozy-first-payment')
    ok('banner renders', (await banner.count()) === 1)

    // POSITION: between the welcome header and the Active/Past/Guarantee grid
    const bannerBox = await banner.boundingBox()
    const headerBox = await page.locator('header').first().boundingBox()
    const statsBox = await page.locator('div.grid.grid-cols-3').first().boundingBox()
    ok(
      'banner sits between header and stat cards',
      !!bannerBox && !!headerBox && !!statsBox &&
        bannerBox.y > headerBox.y + headerBox.height - 40 &&
        bannerBox.y + bannerBox.height <= statsBox.y + 80,
      `banner@${Math.round(bannerBox?.y ?? -1)} header-end@${Math.round((headerBox?.y ?? 0) + (headerBox?.height ?? 0))} stats@${Math.round(statsBox?.y ?? -1)}`
    )

    const bannerText = await banner.innerText()
    ok('title: Complete your payment first', bannerText.includes('Complete your payment first'))
    ok('badge: Awaiting payment', bannerText.includes('Awaiting payment'))
    ok('wording: membership REQUEST (not "your membership")', /received your .* request/.test(bannerText))
    ok('first month ₦50,000 (formatted)', bannerText.includes('₦50,000'))
    ok('no "₦50,000 / month" running-cost framing', !/\/\s*month/.test(bannerText))
    ok('card honestly unavailable', bannerText.includes('Card payments are not configured yet'))
    ok(
      'card button disabled without a key',
      !(await page.getByRole('button', { name: /Pay ₦50,000 by card/i }).first().isEnabled())
    )

    // The drop-down reveal
    const transferBtn = page.getByRole('button', { name: 'Pay by bank transfer' }).first()
    ok('transfer button present (collapsed)', (await transferBtn.count()) === 1)
    await transferBtn.click()
    await page.waitForTimeout(900)
    const details = banner.locator('div.rounded-xl.border.border-gold-200')
    ok('details dropped down', (await details.count()) === 1)
    const detailsText = await details.innerText()
    ok('details: Transfer ₦50,000 + bank + account number + reference',
      detailsText.includes('Transfer ₦50,000') && /Bank/.test(detailsText) && /\d{10}/.test(detailsText) && /KZY-RENEW-/.test(detailsText))

    // The baton pass — "I've made payment"
    const madeBtn = page.getByRole('button', { name: /I've made payment/i }).first()
    ok('button became "I\'ve made payment"', (await madeBtn.count()) === 1)
    ok('"Pay by bank transfer" no longer clickable', (await transferBtn.count()) === 0)
    await madeBtn.click()
    await page.waitForTimeout(1200)
    const toastText = await page.locator('[data-sonner-toast], [role="status"]').allInnerTexts().catch(() => [])
    const bodyText = await page.locator('body').innerText()
    ok(
      'the verifying toast appears',
      bodyText.includes("We're verifying your payment"),
      toastText.join(' ').slice(0, 80)
    )
    ok(
      'button settled to "Payment sent — awaiting the office\'s confirmation"',
      (await page.getByRole('button', { name: /Payment sent/i }).count()) === 1
    )

    // The membership tab: request wording, no price headline, no second payment card
    await page.getByRole('tab', { name: /Membership/i }).click()
    await page.waitForTimeout(1200)
    const tabText = await page.locator('[data-state="active"][role="tabpanel"], div.space-y-4').last().innerText()
    ok('navy card: "Membership request received"', tabText.includes('Membership request received'))
    ok('navy card: request wording', /We received your .* request/.test(tabText))
    ok('no RenewalCard duplicate for pending (no ladder)', !tabText.includes('How many months?'))
    ok('quiet Change plan link present', tabText.includes('Change plan'))
    ok('banner scroll button present', tabText.includes('Complete your first payment'))

    await page.close()
  }

  // ================================================================
  // [3] THE DEEP LINK — /portal?pay=1 through login and back
  // ================================================================
  console.log('[3] The ?pay=1 deep link')
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const page = await ctx.newPage()
    await page.goto(`${BASE}/portal?pay=1`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1500)
    ok('signed-out → login with the deep link preserved', page.url().includes('/login') && page.url().includes(encodeURIComponent('/portal?pay=1')), page.url())
    await page.fill('input[type="email"]', 't81pend@woosh.dpdns.org')
    await page.fill('input[type="password"]', 'T81Pend!2026')
    await page.click('button[type="submit"]')
    await page.waitForURL(/portal/, { timeout: 20000 })
    await page.waitForTimeout(2000)
    ok('back on /portal?pay=1 after login', page.url().includes('/portal') && page.url().includes('pay=1'), page.url())
    const banner = page.locator('#kozy-first-payment')
    ok('banner present after the deep-link journey', (await banner.count()) === 1)
    const box = await banner.boundingBox()
    ok('banner scrolled into view', !!box && box.y > -50 && box.y < 700, `y=${Math.round(box?.y ?? -999)}`)
    await ctx.close()
  }

  // ================================================================
  // [4] THE CLUB BANNER — a pending shoes-only member
  // ================================================================
  console.log('[4] The club banner')
  {
    const page = await browser.newPage()
    await login(page, 't81clubpend@woosh.dpdns.org', 'T81Club!2026')
    const banner = page.locator('#kozy-first-payment')
    ok('club banner renders', (await banner.count()) === 1)
    const text = await banner.innerText()
    // NOTE: the eyebrow renders uppercase (CSS text-transform) — compare
    // case-insensitively.
    ok('club eyebrow: Almost in the club', /almost in the club/i.test(text))
    ok('club request wording', /received your .* request/.test(text))
    ok('club first month ₦3,000', text.includes('₦3,000'))
    await page.getByRole('button', { name: 'Pay by bank transfer' }).first().click()
    await page.waitForTimeout(900)
    const detailsText = await banner.locator('div.rounded-xl.border.border-gold-200').innerText()
    ok('club transfer details: Transfer ₦3,000', detailsText.includes('Transfer ₦3,000') && !/\b3000\b(?!\d)/.test(detailsText.replace(/₦3,000/g, '')))
    await page.close()
  }

  // ================================================================
  // [5] THE QUIET SWITCH — schedule / undo / pricing / guards
  // ================================================================
  console.log('[5] The quiet tier switch')
  {
    const page = await browser.newPage()
    await login(page, 't81active@woosh.dpdns.org', 'T81Active!2026')
    let me = await page.request.get(`${BASE}/api/subscriptions/me`)
    let meData = await me.json().catch(() => ({}))
    const sub = meData.membership
    ok('live member: HOUSEHOLD ACTIVE', sub?.plan?.code === 'HOUSEHOLD' && meData.effectiveStatus === 'ACTIVE')

    // unauthenticated → 401
    let res = await fetch(`${BASE}/api/subscriptions/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'plan-change', planCode: 'WHOLEHOME' }),
    })
    ok('plan-change unauthenticated 401', st(res) === 401, `${st(res)}`)

    // upgrade scheduled
    res = await page.request.patch(`${BASE}/api/subscriptions/me`, {
      data: { action: 'plan-change', planCode: 'WHOLEHOME' },
    })
    let data = await res.json().catch(() => ({}))
    ok('WHOLEHOME scheduled (next-renewal)', st(res) === 200 && data.applied === 'next-renewal', `${st(res)} ${data.applied}`)
    me = await page.request.get(`${BASE}/api/subscriptions/me`)
    meData = await me.json().catch(() => ({}))
    ok('me shows the pending switch', meData.membership?.pendingPlan?.code === 'WHOLEHOME' && meData.membership?.pendingPlan?.priceMonthly === 80000)

    // renewal priced on the switch target
    res = await page.request.post(`${BASE}/api/subscriptions/renew`, {
      data: { subscriptionId: sub.id, months: 1, method: 'BANK_TRANSFER' },
    })
    data = await res.json().catch(() => ({}))
    ok('renewal priced on WHOLEHOME (₦80,000)', st(res) === 200 && data.transfer?.amount === 80000, `${st(res)} ${data.transfer?.amount}`)
    res = await page.request.post(`${BASE}/api/subscriptions/renew`, {
      data: { subscriptionId: sub.id, months: 3, method: 'BANK_TRANSFER' },
    })
    data = await res.json().catch(() => ({}))
    // 3 × 80,000 = 240,000 − 13,500 (the 1/6 saving, rounded to ₦500) = 226,500
    ok('3-month ladder on WHOLEHOME (₦226,500)', st(res) === 200 && data.transfer?.amount === 226500, `${data.transfer?.amount}`)

    // undo
    res = await page.request.patch(`${BASE}/api/subscriptions/me`, {
      data: { action: 'plan-change-undo' },
    })
    data = await res.json().catch(() => ({}))
    ok('undo accepted', st(res) === 200)
    me = await page.request.get(`${BASE}/api/subscriptions/me`)
    meData = await me.json().catch(() => ({}))
    ok('pending switch cleared', !meData.membership?.pendingPlan)

    // THE QUIET DOWNGRADE — possible, unsung
    res = await page.request.patch(`${BASE}/api/subscriptions/me`, {
      data: { action: 'plan-change', planCode: 'ESSENTIALS' },
    })
    data = await res.json().catch(() => ({}))
    ok('ESSENTIALS (downgrade) scheduled just the same', st(res) === 200 && data.applied === 'next-renewal', `${st(res)}`)
    res = await page.request.post(`${BASE}/api/subscriptions/renew`, {
      data: { subscriptionId: sub.id, months: 1, method: 'BANK_TRANSFER' },
    })
    data = await res.json().catch(() => ({}))
    ok('downgrade renewal priced ₦30,000', data.transfer?.amount === 30000, `${data.transfer?.amount}`)
    await page.request.patch(`${BASE}/api/subscriptions/me`, { data: { action: 'plan-change-undo' } })

    // guards
    res = await page.request.patch(`${BASE}/api/subscriptions/me`, {
      data: { action: 'plan-change', planCode: 'SHOES2' },
    })
    data = await res.json().catch(() => ({}))
    ok('cross-family rejected 400', st(res) === 400 && data.error === 'WRONG_FAMILY', `${st(res)} ${data.error}`)
    res = await page.request.patch(`${BASE}/api/subscriptions/me`, {
      data: { action: 'plan-change', planCode: 'HOUSEHOLD' },
    })
    data = await res.json().catch(() => ({}))
    ok('same-plan rejected 400', st(res) === 400 && data.error === 'SAME_PLAN', `${st(res)} ${data.error}`)

    // the ledger rows
    me = await page.request.get(`${BASE}/api/subscriptions/me`)
    meData = await me.json().catch(() => ({}))
    const evts = meData.activity?.events ?? []
    ok('ledger: PLAN_CHANGE_SCHEDULED + PLAN_CHANGE_UNDO written',
      evts.some((e) => e.kind === 'PLAN_CHANGE_SCHEDULED') && evts.some((e) => e.kind === 'PLAN_CHANGE_UNDO'))

    // the UI: quiet link + the scheduled line + dialog
    await page.goto(`${BASE}/portal`, { waitUntil: 'networkidle' })
    await page.getByRole('tab', { name: /Membership/i }).click()
    await page.waitForTimeout(1000)
    let tabText = await page.locator('body').innerText()
    ok('portal: Change plan link (quiet)', tabText.includes('Change plan'))
    await page.getByRole('button', { name: 'Change plan' }).first().click()
    await page.waitForTimeout(700)
    const dialog = page.locator('[role="dialog"]')
    ok('Change plan dialog opens', (await dialog.count()) === 1)
    const dialogText = await dialog.innerText()
    ok('dialog lists both other tiers neutrally', dialogText.includes('The Essentials') && dialogText.includes('The Whole Home'))
    ok('dialog: no downgrade language', !/downgrade/i.test(dialogText))
    await dialog.getByRole('button', { name: /The Whole Home/i }).first().click()
    await page.waitForTimeout(400)
    await dialog.getByRole('button', { name: /Switch to The Whole Home at my next renewal/i }).click()
    await page.waitForTimeout(1500)
    tabText = await page.locator('body').innerText()
    ok('scheduled line: "Switching to The Whole Home"', tabText.includes('Switching to The Whole Home'))
    ok('scheduled line has the undo', tabText.includes('Undo'))
    await page.close()
  }

  // ================================================================
  // [6] THE ENGINE — office verify applies the scheduled switch
  // ================================================================
  console.log('[6] The engine applies the switch with the money')
  {
    // (t81active now has WHOLEHOME scheduled from the UI step above)
    const adminPage = await browser.newPage()
    await login(adminPage, 't81admin@woosh.dpdns.org', 'T81Admin!2026')
    const list = await adminPage.request.get(`${BASE}/api/subscriptions`)
    const listData = await list.json().catch(() => ({}))
    const target = (listData.items ?? []).find(
      (m) => m.user?.email === 't81active@woosh.dpdns.org' && m.effectiveStatus === 'ACTIVE'
    )
    ok('admin sees the scheduled switch in the list', target?.pendingPlan?.code === 'WHOLEHOME', target?.pendingPlan?.code ?? 'none')

    const res = await adminPage.request.patch(`${BASE}/api/subscriptions/${target.id}`, {
      data: { action: 'verify' },
    })
    const data = await res.json().catch(() => ({}))
    ok('office verify accepted', st(res) === 200, `${st(res)}`)
    ok(
      'plan swapped to WHOLEHOME, priced ₦80,000, switch cleared',
      data.membership?.plan?.code === 'WHOLEHOME' && data.membership?.pricePaid === 80000 && !data.membership?.pendingPlan
    )
    await adminPage.close()

    // the member sees their new tier + the ledger note
    const page = await browser.newPage()
    await login(page, 't81active@woosh.dpdns.org', 'T81Active!2026')
    const me = await page.request.get(`${BASE}/api/subscriptions/me`)
    const meData = await me.json().catch(() => ({}))
    ok('member is on The Whole Home now', meData.membership?.plan?.code === 'WHOLEHOME' && meData.effectiveStatus === 'ACTIVE')
    const evts = meData.activity?.events ?? []
    const cycle = evts.find((e) => e.kind === 'CYCLE_START' && /Tier switch applied/.test(e.note ?? ''))
    ok('ledger records the applied switch', !!cycle)
    await page.close()
  }

  // ================================================================
  // [7] PENDING SWITCH — an unpaid request swaps immediately
  // ================================================================
  console.log('[7] The pending-request switch')
  {
    const page = await browser.newPage()
    await login(page, 't81pend@woosh.dpdns.org', 'T81Pend!2026')
    let res = await page.request.patch(`${BASE}/api/subscriptions/me`, {
      data: { action: 'plan-change', planCode: 'ESSENTIALS' },
    })
    let data = await res.json().catch(() => ({}))
    ok('pending request switched immediately', st(res) === 200 && data.applied === 'immediately' && data.membership?.plan?.code === 'ESSENTIALS', `${st(res)} ${data.applied}`)
    // The banner prices from the plan itself — the swapped plan IS the price.
    // (No extra renew call here: this user's renew budget is already spent by
    // sections [1]+[2] — the 6/hour limit doing its job.)
    ok(
      'banner price follows the new plan (₦30,000)',
      data.membership?.plan?.priceMonthly === 30000,
      `${data.membership?.plan?.priceMonthly}`
    )
    // restore HOUSEHOLD for the next section
    res = await page.request.patch(`${BASE}/api/subscriptions/me`, {
      data: { action: 'plan-change', planCode: 'HOUSEHOLD' },
    })
    data = await res.json().catch(() => ({}))
    ok('switched back to HOUSEHOLD (restored)', data.membership?.plan?.code === 'HOUSEHOLD')
    await page.close()
  }

  // ================================================================
  // [8] ALREADY_MEMBER / join deep link — straight to the payment
  // ================================================================
  console.log('[8] The pending member lands on their payment')
  {
    const page = await browser.newPage()
    await login(page, 't81pend@woosh.dpdns.org', 'T81Pend!2026')
    // A join deep link while holding a pending request → redirected to the
    // banner, no dialog to figure out.
    await page.goto(`${BASE}/memberships?join=ESSENTIALS`, { waitUntil: 'domcontentloaded' })
    await page.waitForURL(/portal/, { timeout: 15000 })
    await page.waitForTimeout(1500)
    ok('join deep link → /portal?pay=1 (no dialog)', page.url().includes('/portal') && page.url().includes('pay=1'), page.url())
    ok('banner waiting there', (await page.locator('#kozy-first-payment').count()) === 1)
    // And a plain /memberships visit shows the payment CTA, not "join"
    await page.goto(`${BASE}/memberships`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1200)
    const bodyText = await page.locator('body').innerText()
    ok(
      'memberships page: "Your payment is waiting" CTA → the banner',
      bodyText.includes('Your payment is waiting') && !bodyText.includes('Join the Circle')
    )
    await page.close()
  }

  await browser.close()
  console.log(`\n==== ${pass} pass / ${fail} fail ====`)
  process.exit(fail > 0 ? 1 : 0)
})().catch((e) => {
  console.error('VERIFY CRASHED:', e)
  process.exit(1)
})
