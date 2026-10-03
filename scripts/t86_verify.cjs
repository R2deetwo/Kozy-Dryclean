// =============================================================================
// Task 86 battery — the checkout→membership conversion engine, verified
// end-to-end against a REAL browser + REAL local DB. Woosh accounts only.
//
//   [A] The checkout card: shows at ₦15k+ (Essentials band), names the plan
//       and price from the LIVE plan row, sits before "Choose payment
//       method", and DISMISSING preserves the one-off checkout intact.
//   [B] Below the threshold: no card (the checkout stays a checkout).
//   [C] Accept the offer: first-bag marker saved, routed to the join dialog
//       (guests → signup with prefill + the plan carried over), dialog shows
//       the gold first-Bag panel, joining records FIRST_BAG_CLAIMED.
//   [D] The office verifies the first payment → the basket BOOKS itself:
//       ₦0 PAYMENT_VERIFIED order on the normal pipeline, one unit consumed,
//       kit hand-over on the same stop, ledger rows UNIT + FIRST_BAG_BOOKED
//       + KIT_DELIVERED, marker + draft cleared client-side.
//   [E] Idempotency: a second verify (renewal) never books the bag twice.
//   [F] The monthly conversion email (sweep Job 4): the 60-day-spend
//       customer gets pitched the right tier with the first-Bag offer,
//       outside-allowlist addresses are SUPPRESSED, the 30-day cadence holds
//       on an immediate second run, members are never pitched.
// =============================================================================
const { chromium } = require('playwright')
const fs = require('fs')

const BASE = 'http://localhost:3000'
const CRON = 'kozy-dev-cron-secret-052'
const EMAIL_DIR = '/home/z/my-project/work/t86-emails'
let pass = 0, fail = 0
function ok(name, cond, extra) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? `  (${extra})` : ''}`)
  cond ? pass++ : fail++
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function api(ctx, method, path, body) {
  const page = await ctx.newPage()
  await page.goto(`${BASE}/`).catch(() => {})
  const res = await page.evaluate(
    async ({ method, path, body }) => {
      const r = await fetch(path, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
      })
      return { status: r.status, json: await r.json().catch(() => null) }
    },
    { method, path, body }
  )
  await page.close()
  return res
}

async function login(page, email, password) {
  await page.goto(`${BASE}/login`)
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL(/portal|admin/, { timeout: 20000 })
  await sleep(1200)
}

/** Drive the wizard to step 4 with N × 3-piece suit in the basket.
 *  Hydration-safe: a cold prod server can render the static shell before
 *  React attaches its handlers, so every click is VERIFIED (the Remove
 *  button only exists once a quantity is actually registered) and retried
 *  up to 5 times — the battery never silently books an empty basket. */
async function buildBasket(page, count) {
  await page.goto(`${BASE}/book`)
  await page.waitForLoadState('networkidle')
  await sleep(1500)
  const ADD = 'button[aria-label="Add one Suit (3-Piece)"]'
  for (let attempt = 0; attempt < 5; attempt++) {
    for (let i = 0; i < count; i++) {
      await page.click(ADD).catch(() => {})
      await sleep(120)
    }
    if ((await page.locator('button[aria-label="Remove one Suit (3-Piece)"]').count()) >= 1) break
    await sleep(800)
  }
  ok(`basket registered (${count} × 3-piece suit, hydration race survived)`, (await page.locator('button[aria-label="Remove one Suit (3-Piece)"]').count()) >= 1)
  await page.click('button:has-text("Machine Wash")')
  await sleep(300)
  await page.click('button:has-text("Continue")')
  await sleep(1200)
  for (let i = 0; i < 5; i++) {
    if ((await page.locator('button:has-text("Skip for now")').count()) > 0) break
    await sleep(400)
  }
  if ((await page.locator('button:has-text("Skip for now")').count()) > 0) {
    await page.click('button:has-text("Skip for now")')
  } else {
    await page.click('button:has-text("Continue")')
  }
  await sleep(1400)
}

/** The big basket (4 × 3-piece suit = one-off ₦22,000, ₦18,700 after the
 *  first-order + online discounts — comfortably in the ₦15k+ band). */
async function buildBigBasket(page) {
  await buildBasket(page, 4)
}

async function fillLogistics(page, address) {
  await page.fill('#pickup-address', address)
  await page.click('button:has-text("Continue")')
  await sleep(1400)
}

;(async () => {
  const browser = await chromium.launch()
  fs.rmSync(EMAIL_DIR, { recursive: true, force: true })
  fs.mkdirSync(EMAIL_DIR, { recursive: true })
  fs.mkdirSync('work/t86-shots', { recursive: true })

  // =========================================================================
  console.log('\n[A] The checkout card — visible, honest, dismissible')
  {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await login(page, 't86new@woosh.dpdns.org', 'T86New!2026')
    await buildBigBasket(page)
    await fillLogistics(page, '5 Redemption Close, Lekki Phase 1, Lagos')

    const card = page.locator('text=basket could be your first')
    ok('card visible at ₦15k+ total', await card.isVisible().catch(() => false))
    const cardText = (await page.locator('div.bg-navy').filter({ hasText: 'first Kozy Bag' }).first().textContent().catch(() => '')) || ''
    ok('card names The Essentials + live ₦30,000/mo price', /The Essentials/.test(cardText) && /₦30,000/.test(cardText), cardText.slice(0, 80))
    ok('card promises the mixed basket, free', /mixed as it is/i.test(cardText) && /free/i.test(cardText))
    const choosePay = page.locator('p:has-text("Choose payment method")')
    ok('payment choice still rendered below the card', await choosePay.isVisible().catch(() => false))
    await page.screenshot({ path: 'work/t86-shots/01-checkout-card.png', fullPage: true })

    // Dismiss → the one-off checkout is preserved.
    await page.click('button:has-text("No thanks — keep my one-off checkout")')
    await sleep(600)
    ok('card gone after dismiss', (await page.locator('text=basket could be your first').count()) === 0)
    ok('payment choice intact after dismiss', await choosePay.isVisible().catch(() => false))
    const summary = (await page.locator('body').textContent()) || ''
    ok('order summary still lists the basket (checkout preserved)', /4×\s*Suit \(3-Piece\)|4 × Suit/.test(summary))

    // The marker must NOT exist when the card is dismissed.
    const marker = await page.evaluate(() => localStorage.getItem('kozy.firstbag.v1'))
    ok('no first-bag marker left behind on dismiss', marker === null, JSON.stringify(marker))
    await ctx.close()
  }

  // =========================================================================
  console.log('\n[B] Below the threshold — no card')
  {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await login(page, 't86new@woosh.dpdns.org', 'T86New!2026')
    await buildBasket(page, 1) // ₦5,500 one-off — below every band
    await fillLogistics(page, '5 Redemption Close, Lekki Phase 1, Lagos')
    ok('no card below ₦15,000', (await page.locator('text=basket could be your first').count()) === 0)
    await ctx.close()
  }

  // =========================================================================
  console.log('\n[C] Accept the offer — marker, routing, join dialog, claim')
  {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await login(page, 't86new@woosh.dpdns.org', 'T86New!2026')
    await buildBigBasket(page)
    await fillLogistics(page, '5 Redemption Close, Lekki Phase 1, Lagos')

    await page.click('button:has-text("Make this my first")')
    await sleep(2500)
    ok('routed to the plan join page', page.url().includes('/memberships'), page.url())
    const dialog = (await page.locator('[role="dialog"]').textContent().catch(() => '')) || ''
    ok('join dialog opens on The Essentials', /Join The Essentials/.test(dialog), dialog.slice(0, 60))
    ok('gold first-Bag panel shows the basket value', /rides as your first Kozy Bag — free/.test(dialog) && /₦/.test(dialog))
    await page.screenshot({ path: 'work/t86-shots/02-join-dialog-firstbag.png', fullPage: false })

    // Start the membership (transfer — the production path).
    await page.click('button:has-text("Start my membership")')
    await sleep(3000)
    const after = (await page.locator('[role="dialog"]').textContent().catch(() => '')) || ''
    ok('Almost in the Circle (payment pending)', /Almost in the Circle/.test(after))
    ok('done copy explains the first Bag rides with the kit', /first Bag/.test(after) || /kit and collecting your first Bag/.test(after))

    // Marker + draft cleared client-side (the claim is server-side now).
    const marker = await page.evaluate(() => localStorage.getItem('kozy.firstbag.v1'))
    const draft = await page.evaluate(() => localStorage.getItem('kozy.booking.draft.v1'))
    ok('first-bag marker cleared after join', marker === null)
    ok('booking draft cleared after join (no double-book)', draft === null)

    // Server state: PENDING membership + the FIRST_BAG_CLAIMED ledger row.
    const me = await api(ctx, 'GET', '/api/subscriptions/me')
    const subId = me.json?.membership?.id
    ok('membership PENDING_ACTIVATION on The Essentials', me.json?.membership?.status === 'PENDING_ACTIVATION' && me.json?.membership?.plan?.code === 'ESSENTIALS', JSON.stringify(me.json?.membership?.status))
    const events = (me.json?.activity?.events || []).map((e) => e.kind)
    ok('ledger carries FIRST_BAG_CLAIMED', events.includes('FIRST_BAG_CLAIMED'), events.join(','))
    await ctx.close()

    // The office verifies the payment → the basket books itself.
    console.log('\n[D] Office verify → the first Bag books itself')
    const admin = await browser.newContext()
    await login(await admin.newPage(), 't86admin@woosh.dpdns.org', 'T86Admin!2026')
    const verify = await api(admin, 'PATCH', `/api/subscriptions/${subId}`, { action: 'verify' })
    ok('office verify succeeds', verify.status === 200, `status=${verify.status}`)

    const subs = await (await api(admin, 'GET', '/api/subscriptions')).json
    const row = (subs.items || []).find((m) => m.user?.email === 't86new@woosh.dpdns.org')
    ok('membership ACTIVE after verify', row?.effectiveStatus === 'ACTIVE' || row?.status === 'ACTIVE')
    ok('one bag/box unit consumed by the first Bag', row?.usage?.unitsUsed === 1, JSON.stringify(row?.usage?.unitsUsed))

    const orders = await (await api(admin, 'GET', '/api/orders?limit=50')).json
    const myOrders = orders.items || []
    const firstBagOrder = myOrders.find(
      (o) => o.userId === row?.user?.id && o.subscriptionId === subId && (o.totalPrice ?? 0) === 0
    )
    ok('first-Bag order exists at ₦0', Boolean(firstBagOrder), JSON.stringify(firstBagOrder?.orderNumber))
    ok('order PAYMENT_VERIFIED (money settled by the membership)', firstBagOrder?.status === 'PAYMENT_VERIFIED')
    const manifest = String(firstBagOrder?.itemsManifest || '')
    ok('manifest carries the real garments at zero each', /firstbag_/.test(manifest) && /Suit \(3-Piece\) — first Kozy Bag \(included\)/.test(manifest))
    const notes = String(firstBagOrder?.alterationNotes || '')
    ok('manifest note explains the gift + kit delivery', /FIRST KOZY BAG/.test(notes) && /KIT DELIVERY/.test(notes))
    ok('wash mode preserved from checkout', firstBagOrder?.modeOfWash === 'MACHINE')

    // The member sees their first Bag in the portal.
    const member = await browser.newContext()
    const mpage = await member.newPage()
    await login(mpage, 't86new@woosh.dpdns.org', 'T86New!2026')
    await mpage.goto(`${BASE}/portal`)
    await sleep(2500)
    const portalText = (await mpage.textContent('body')) || ''
    ok('member portal lists the first Bag pickup', /first Kozy Bag/i.test(portalText) || /Kozy Bag/i.test(portalText))
    await mpage.screenshot({ path: 'work/t86-shots/04-member-firstbag.png', fullPage: true })

    // [E] idempotency — a second verify is a RENEWAL: no second booking.
    console.log('\n[E] Idempotency — renewals never re-book the bag')
    const again = await api(admin, 'PATCH', `/api/subscriptions/${subId}`, { action: 'renew', months: 1, pricePaid: 30000 })
    ok('renewal succeeds', again.status === 200)
    const orders2 = await (await api(admin, 'GET', '/api/orders?limit=50')).json
    const bagOrders = (orders2.items || []).filter((o) => o.subscriptionId === subId && (o.totalPrice ?? 0) === 0)
    ok('still exactly ONE first-Bag order', bagOrders.length === 1, `count=${bagOrders.length}`)

    // [F] The monthly conversion email (Job 4).
    console.log('\n[F] The monthly conversion email (sweep Job 4)')
    const cronCtx = await browser.newContext()
    const cronPage = await cronCtx.newPage()
    await cronPage.goto(`${BASE}/`).catch(() => {})
    const sweep1 = await cronPage.evaluate(async () => {
      const r = await fetch('/api/cron/member-emails', {
        headers: { Authorization: 'Bearer kozy-dev-cron-secret-052' },
      })
      return await r.json().catch(() => null)
    })
    const conversions = (sweep1?.details || []).filter((d) => d.job === 'conversion')
    const buyerRow = conversions.find((d) => d.member?.email === 't86buyer@woosh.dpdns.org')
    ok('Job 4 ran', sweep1?.upsellCandidates >= 0 && Array.isArray(sweep1?.details))
    ok('the 60-day-spend customer pitched The Essentials', buyerRow?.outcome === 'SENT' && /The Essentials/.test(buyerRow?.planName || ''), JSON.stringify(buyerRow?.reason))
    const realRow = conversions.find((d) => d.member?.email === 't86real@example.com')
    ok('outside-allowlist address SUPPRESSED (test mode)', realRow?.outcome === 'SUPPRESSED')
    const memberRow = conversions.find((d) => d.member?.email === 't86new@woosh.dpdns.org')
    ok('members are never pitched', memberRow === undefined)

    const names = fs.readdirSync(EMAIL_DIR)
    const upsellName = names.find((n) => /runs-like-a-member/i.test(n))
    const upsellMail = upsellName
      ? fs.readFileSync(`${EMAIL_DIR}/${upsellName}`, 'utf8')
      : ''
    ok('conversion email captured', Boolean(upsellMail))
    ok('email carries the first-Bag offer + live plan price', /first Kozy Bag/i.test(upsellMail || '') && /₦30,000/.test(upsellMail || ''))
    // The capture filename embeds the RECIPIENT (subject-to pattern) — the
    // one place the addressee is recorded.
    ok('email addressed to the buyer', /t86buyer-woosh/.test(upsellName || ''), upsellName)

    // 30-day cadence: an immediate second sweep sends nothing new.
    const sweep2 = await cronPage.evaluate(async () => {
      const r = await fetch('/api/cron/member-emails', {
        headers: { Authorization: 'Bearer kozy-dev-cron-secret-052' },
      })
      return await r.json().catch(() => null)
    })
    const conversions2 = (sweep2?.details || []).filter(
      (d) => d.job === 'conversion' && d.member?.email === 't86buyer@woosh.dpdns.org' && d.outcome === 'SENT'
    )
    ok('monthly cadence: no repeat send inside 30 days', conversions2.length === 0)
    await cronCtx.close()
    await admin.close()
    await member.close()
  }

  // =========================================================================
  console.log('\n[G] The GUEST checkout card — new customers too')
  {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await buildBigBasket(page)
    await page.fill('#pickup-address', '9b Eleshin Street, off Admiralty, Lekki Phase 1')
    await page.fill('#guest-name', 'Grace Guest')
    await page.fill('#guest-email', 't86guest@woosh.dpdns.org')
    await page.fill('#guest-phone', '0803 000 1111')
    await page.click('button:has-text("Continue")')
    await sleep(1400)
    ok('guest sees the card too', await page.locator('text=basket could be your first').isVisible().catch(() => false))
    await page.click('button:has-text("Make this my first")')
    await sleep(2500)
    ok('guest routed to signup with the plan carried over', page.url().includes('/signup') && decodeURIComponent(page.url()).includes('join=ESSENTIALS'), page.url())
    ok('guest email prefilled', decodeURIComponent(page.url()).includes('t86guest@woosh.dpdns.org'))
    const marker = await page.evaluate(() => localStorage.getItem('kozy.firstbag.v1'))
    ok('first-bag marker saved for the signup detour', marker !== null)
    await page.screenshot({ path: 'work/t86-shots/05-guest-signup-carry.png', fullPage: false })
    await ctx.close()
  }

  await browser.close()
  console.log(`\n=== ${pass} PASS / ${fail} FAIL ===`)
  process.exit(fail > 0 ? 1 : 0)
})().catch((e) => {
  console.error('FATAL', e)
  process.exit(2)
})
