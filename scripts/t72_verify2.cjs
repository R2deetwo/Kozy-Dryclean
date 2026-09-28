// =============================================================================
// Task 72 verification — PHASE B: the partner portal. Runs AFTER
// t72_partner_pw.ts has set a known password on the PARTNER account the
// admin approval created.
//   partner login → /partner → orders routed → advance PICKED_UP → … →
//   FINISHING → admin dispatches → rider delivers → share ledger → admin
//   settles → partner sees pending drop → suspend pauses the login →
//   reactivate.
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

async function login(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL(/portal|admin|partner|driver/, { timeout: 20000 })
  await page.waitForTimeout(1500)
}

;(async () => {
  const browser = await chromium.launch()

  // ================================================================
  // 1. Partner signs in → lands on the portal
  // ================================================================
  console.log('\n[1] Partner login + portal shell')
  const partner = await browser.newPage()
  await login(partner, 't72laundry@kozy.test', 'T72Partner!2026')
  ok('login lands on /partner', partner.url().includes('/partner'), partner.url())
  await partner.goto(`${BASE}/partner`, { waitUntil: 'domcontentloaded' })
  await partner.waitForTimeout(1500)
  const header = await partner.textContent('header').catch(() => '')
  ok('portal header greets the business', /T72 Sparkle Laundry/.test(header ?? ''))
  const shareBadge = await partner.textContent('header').catch(() => '')
  ok('share badge shows 75%', /75% share/.test(shareBadge ?? ''))

  let res = await partner.request.get(`${BASE}/api/partner/overview`)
  let body = await res.json().catch(() => ({}))
  ok('overview loads', res.status() === 200 && body.partner?.businessName === 'T72 Sparkle Laundry')
  ok('one active order routed', body.stats?.active === 1, JSON.stringify(body.stats))
  const orderC = (body.active ?? [])[0]
  ok('order C visible with items + customer', orderC?.orderNumber === 'KZ-T72C' && orderC?.itemCount === 5 && orderC?.customerName === 'T72 Customer')
  ok('order C at PICKED_UP (awaiting receipt)', orderC?.status === 'PICKED_UP')

  // ================================================================
  // 2. The wash-floor workflow — forward-only, one tap at a time
  // ================================================================
  console.log('\n[2] Partner advances the order')
  const steps = ['AT_STATION', 'PROCESSING', 'FINISHING']
  for (const expected of steps) {
    res = await partner.request.post(`${BASE}/api/partner/orders/${orderC.id}/status`, { data: {} })
    body = await res.json().catch(() => ({}))
    ok(`advance → ${expected}`, res.status() === 200 && body.order?.status === expected, `${res.status()} ${body.order?.status ?? body.error}`)
  }
  res = await partner.request.post(`${BASE}/api/partner/orders/${orderC.id}/status`, { data: {} })
  ok('no action past FINISHING (409)', res.status() === 409)

  // RBAC: the partner cannot touch console surfaces.
  res = await partner.request.get(`${BASE}/api/rider-applications`)
  ok('console API refused (403)', res.status() === 403)
  res = await partner.request.get(`${BASE}/api/orders`)
  ok('orders API refused (403)', res.status() === 403)

  // Middleware: /admin bounces the partner back to /partner.
  await partner.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' })
  await partner.waitForTimeout(800)
  ok('/admin redirects partner to /partner', partner.url().includes('/partner'), partner.url())

  // ================================================================
  // 3. Delivery closes the loop → the share ledger moves
  // ================================================================
  console.log('\n[3] Dispatch → delivery → share ledger')
  const admin = await browser.newPage()
  await login(admin, 't72admin@kozy.test', 'T72Admin!2026')

  // Find order C again — at FINISHING it is still ACTIVE on the partner's
  // floor (awaiting Kozy's rider); it only moves to recently-handled after
  // dispatch + delivery. That IS the product behaviour.
  res = await partner.request.get(`${BASE}/api/partner/overview`)
  body = await res.json().catch(() => ({}))
  const activeC = (body.active ?? []).find((o) => o.orderNumber === 'KZ-T72C')
  ok('finished order still active (awaiting pickup)', !!activeC && activeC.status === 'FINISHING', activeC?.status)
  const orderCId = activeC?.id ?? orderC.id

  // Admin dispatches it out for delivery…
  res = await admin.request.patch(`${BASE}/api/orders/${orderCId}`, { data: { status: 'OUT_FOR_DELIVERY' } })
  ok('admin dispatches OUT_FOR_DELIVERY', res.status() === 200)

  // …and the rider completes the door.
  const rider = await browser.newPage()
  await login(rider, 't72rider@kozy.test', 'T72Rider!2026')
  res = await rider.request.patch(`${BASE}/api/orders/${orderCId}`, { data: { status: 'DELIVERED' } })
  ok('rider swipes DELIVERED', res.status() === 200)

  // Admin sees the ledger: 1 delivered order, 75% share = 7,500 of 10,000.
  res = await admin.request.get(`${BASE}/api/partners`)
  body = await res.json().catch(() => ({}))
  const approved = (body.partners ?? []).find((p) => p.email === 't72laundry@kozy.test')
  const ledgerRow = (body.ledger ?? []).find((l) => l.partnerId === approved.id)
  ok('ledger: 1 delivered order, 10000 value', ledgerRow?.ordersLifetime === 1 && ledgerRow?.revenueLifetime === 10000, JSON.stringify(ledgerRow))
  ok('ledger: share earned 7500 at 75%', ledgerRow?.shareEarned === 7500)
  ok('ledger: pending settlement 7500 (nothing paid)', ledgerRow?.pendingSettlement === 7500)

  // ================================================================
  // 4. Settlement — the office pays, the partner sees it
  // ================================================================
  console.log('\n[4] Settlement')
  res = await admin.request.post(`${BASE}/api/partner-settlements`, {
    data: { partnerId: approved.id, amount: 5000, method: 'BANK_TRANSFER', reference: 'STL-72-001', note: 'First share' },
  })
  body = await res.json().catch(() => ({}))
  ok('settlement recorded 201', res.status() === 201)
  ok('pending drops to 2500', body?.balance?.pending === 2500, JSON.stringify(body?.balance))

  res = await partner.request.get(`${BASE}/api/partner/earnings`)
  body = await res.json().catch(() => ({}))
  ok('partner earnings: shareEarned 7500', body.ledger?.shareEarned === 7500)
  ok('partner earnings: settled 5000 / pending 2500', body.settlements?.settledTotal === 5000 && body.settlements?.pending === 2500)
  ok('delivered order listed with own share', (body.deliveredOrders ?? [])[0]?.orderNumber === 'KZ-T72C' && body.deliveredOrders[0]?.yourShare === 7500)
  ok('settlement history visible', (body.settlements?.history ?? []).some((s) => s.reference === 'STL-72-001'))

  // Partner adds their settlement bank account (self-service).
  res = await partner.request.patch(`${BASE}/api/users/me`, {
    data: { bankName: 'Access Bank', bankAccountNumber: '9876543210', bankAccountName: 'T72 Sparkle Laundry' },
  })
  body = await res.json().catch(() => ({}))
  ok('partner saves settlement bank', res.status() === 200 && body.bank?.set === true)

  // ================================================================
  // 5. Suspend / reactivate — the login follows the partnership
  // ================================================================
  console.log('\n[5] Suspend / reactivate')
  res = await admin.request.patch(`${BASE}/api/partners/${approved.id}`, { data: { action: 'suspend', note: 'Battery test' } })
  body = await res.json().catch(() => ({}))
  ok('suspend 200', res.status() === 200 && body.partner?.status === 'SUSPENDED')

  res = await admin.request.get(`${BASE}/api/partners`)
  body = await res.json().catch(() => ({}))
  const suspended = (body.partners ?? []).find((p) => p.email === 't72laundry@kozy.test')
  ok('linked login shows PAUSED', suspended?.account?.accessStatus === 'PAUSED')

  // A suspended partner cannot work orders — the portal API says 403.
  res = await partner.request.post(`${BASE}/api/partner/orders/${orderCId}/status`, { data: {} })
  ok('suspended partner blocked from working (403)', res.status() === 403, String(res.status()))

  // …but keeps read access to their ledger.
  res = await partner.request.get(`${BASE}/api/partner/earnings`)
  ok('suspended partner keeps the ledger (read)', res.status() === 200)

  res = await admin.request.patch(`${BASE}/api/partners/${approved.id}`, { data: { action: 'reactivate' } })
  body = await res.json().catch(() => ({}))
  ok('reactivate 200', res.status() === 200 && body.partner?.status === 'APPROVED')

  res = await admin.request.get(`${BASE}/api/partners`)
  body = await res.json().catch(() => ({}))
  const reactivated = (body.partners ?? []).find((p) => p.email === 't72laundry@kozy.test')
  ok('linked login ACTIVE again', reactivated?.account?.accessStatus === 'ACTIVE')

  // ================================================================
  // 6. Portal pages render clean (no console errors, tabs work)
  // ================================================================
  console.log('\n[6] Portal UI')
  const errors = []
  partner.on('pageerror', (e) => errors.push(String(e)))
  partner.on('console', (m) => {
    // Local-only noise: the Vercel-insights script 404s off-prod; the
    // console text itself carries no URL, so filter on the resource URL.
    const url = m.location()?.url ?? ''
    if (m.type() === 'error' && !url.includes('_vercel/insights') && !/_vercel\/insights/.test(m.text())) {
      errors.push(m.text())
    }
  })
  await partner.goto(`${BASE}/partner`, { waitUntil: 'domcontentloaded' })
  await partner.waitForTimeout(1200)
  await partner.click('nav button:has-text("Earnings")').catch(() => {})
  await partner.waitForTimeout(900)
  const earningsText = await partner.textContent('main').catch(() => '')
  ok('Earnings tab shows pending settlement', /Pending settlement/.test(earningsText ?? ''), String((earningsText ?? '').slice(0, 60)))
  await partner.click('nav button:has-text("Account")').catch(() => {})
  await partner.waitForTimeout(900)
  const accountText = await partner.textContent('main').catch(() => '')
  ok('Account tab shows the settlement bank card', /Settlement bank account/.test(accountText ?? ''))
  await partner.click('nav button:has-text("Orders")').catch(() => {})
  await partner.waitForTimeout(900)
  const ordersText = await partner.textContent('main').catch(() => '')
  ok('Orders tab shows recently handled', /Recently handled/.test(ordersText ?? ''))
  ok('zero page errors on the portal', errors.length === 0, errors.slice(0, 2).join(' | '))

  await browser.close()
  console.log(`\nPHASE B: ${pass} pass / ${fail} fail`)
  process.exit(fail > 0 ? 1 : 0)
})().catch((e) => {
  console.error('phase B crashed:', e)
  process.exit(1)
})
