// =============================================================================
// Task 73 verification — distance-aware rider pay, the join-dialog account
// step, the /signup-success conversion route, and the SEO package.
// Runs against localhost:3000 (server started by t73_run_verify.sh).
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
  await page.waitForTimeout(1200)
}

;(async () => {
  const browser = await chromium.launch()

  // ================================================================
  // [1] SEO package — sitemap, robots, the new route's noindex
  // ================================================================
  console.log('\n[1] SEO package')
  let res = await fetch(`${BASE}/signup-success?email=seo@kozy.test`)
  let html = await res.text()
  ok('GET /signup-success 200', res.status === 200)
  ok('signup-success shows the notice', html.includes('Account created') || html.includes('check your email'))
  ok('signup-success is noindex', /<meta\s+name="robots"\s+content="noindex/i.test(html))

  res = await fetch(`${BASE}/sitemap.xml`)
  const sitemap = await res.text()
  ok('sitemap lists /partners', sitemap.includes('/partners'))
  ok('sitemap keeps /signup', sitemap.includes('/signup'))
  ok('sitemap does NOT list /signup-success', !sitemap.includes('/signup-success'))

  res = await fetch(`${BASE}/robots.txt`)
  const robots = await res.text()
  ok('robots disallows /partner portal', robots.includes('Disallow: /partner'))
  ok('robots disallows /signup-success', robots.includes('Disallow: /signup-success'))
  ok('robots disallows /review', robots.includes('Disallow: /review'))
  ok('robots keeps /book indexable', !/Disallow: \/book\b/.test(robots))

  // ================================================================
  // [2] The signup conversion route — a real submit lands on /signup-success
  // ================================================================
  console.log('\n[2] Signup → /signup-success')
  const anon = await browser.newPage()
  const errors = []
  anon.on('pageerror', (e) => errors.push(String(e)))
  const signupEmail = `t73signup${Date.now()}@kozy.test`
  await anon.goto(`${BASE}/signup`, { waitUntil: 'domcontentloaded' })
  await anon.fill('#name', 'T73 Signup')
  await anon.fill('#email', signupEmail)
  await anon.fill('#phone', '+234 803 555 7777')
  await anon.fill('#password', 'T73Signup!2026')
  await anon.click('button[type="submit"]')
  try {
    await anon.waitForURL(/\/signup-success/, { timeout: 25000 })
    ok('successful signup redirects to /signup-success', true)
  } catch {
    ok('successful signup redirects to /signup-success', false)
  }
  const successUrl = anon.url()
  ok('URL carries the email param', successUrl.includes(encodeURIComponent(signupEmail)))
  await anon.waitForTimeout(800)
  const successBody = await anon.textContent('body')
  ok('success page shows the address', (successBody || '').includes(signupEmail))
  ok('success page has the login CTA', (successBody || '').includes('Go to login'))

  // ================================================================
  // [3] Join dialog — logged out: the account step, never "Billed to"
  // ================================================================
  console.log('\n[3] Join dialog: signed out')
  await anon.goto(`${BASE}/memberships`, { waitUntil: 'domcontentloaded' })
  await anon.waitForTimeout(2500)
  try {
    await anon.getByRole('button', { name: /Join The Household/i }).first().click({ timeout: 8000 })
    await anon.waitForSelector('[role="dialog"]', { timeout: 8000 })
    await anon.waitForTimeout(600)
    const dialogText = (await anon.textContent('[role="dialog"]')) || ''
    ok('dialog opens with the account step', dialogText.includes('Create my account'))
    ok('no Billed-to line while signed out', !dialogText.includes('Billed to'))
    ok('dialog offers sign-in too', dialogText.includes('I already have an account'))
    ok('monthly price still shown', dialogText.includes('Monthly'))
    const createHref = await anon
      .locator('[role="dialog"] a[href*="/signup?callbackUrl="]')
      .first()
      .getAttribute('href')
      ok('create-account link returns to /memberships', (createHref || '').includes(encodeURIComponent('/memberships')))
  } catch (e) {
    ok('dialog opens with the account step', false, String(e).slice(0, 120))
  }

  // ================================================================
  // [4] Join dialog — RIDER session: explained, still never "Billed to"
  // ================================================================
  console.log('\n[4] Join dialog: rider session')
  const riderPage = await browser.newPage()
  await login(riderPage, 't73rider@kozy.test', 'T73Rider!2026')
  await riderPage.goto(`${BASE}/memberships`, { waitUntil: 'domcontentloaded' })
  await riderPage.waitForTimeout(2500)
  try {
    await riderPage.getByRole('button', { name: /Join The Household/i }).first().click({ timeout: 8000 })
    await riderPage.waitForSelector('[role="dialog"]', { timeout: 8000 })
    await riderPage.waitForTimeout(600)
    const dialogText = (await riderPage.textContent('[role="dialog"]')) || ''
    ok('rider session gets the plain-words account step', dialogText.includes("You're signed in as a rider account"))
    ok('no rider email as Billed-to', !dialogText.includes('Billed to'))
    ok('rider can create a personal account', dialogText.includes('Create my account'))
    ok('rider can sign out from the dialog', dialogText.includes('Sign out of the rider account'))
  } catch (e) {
    ok('rider session gets the plain-words account step', false, String(e).slice(0, 120))
  }

  // ================================================================
  // [5] Admin — the rate card in Settings
  // ================================================================
  console.log('\n[5] Admin: rider rate card')
  const admin = await browser.newPage()
  await login(admin, 't73admin@kozy.test', 'T73Admin!2026')
  res = await admin.request.get(`${BASE}/api/settings/app`)
  let body = await res.json().catch(() => ({}))
  const s = body.settings ?? body
  ok('settings load', res.status() === 200 && !!s)
  ok('base rates 1500/1500', s.riderPickupRate === 1500 && s.riderDeliveryRate === 1500)
  ok('distance rate 150/km', s.riderPerKmRate === 150)
  ok('free km 4', s.riderFreeKm === 4)
  ok('distance cap 1800', s.riderDistanceCap === 1800)

  // The new keys flow through PUT validation too (edit + restore).
  res = await admin.request.put(`${BASE}/api/settings/app`, {
    data: { settings: { riderPerKmRate: 175 } },
  })
  body = await res.json().catch(() => ({}))
  ok('PUT accepts riderPerKmRate', res.status() === 200 && (body.settings ?? body).riderPerKmRate === 175)
  res = await admin.request.put(`${BASE}/api/settings/app`, {
    data: { settings: { riderPerKmRate: 150 } },
  })
  ok('PUT restores riderPerKmRate', res.status() === 200)

  // ================================================================
  // [6] Rider — distance-aware earnings ledger
  // ================================================================
  console.log('\n[6] Rider: distance-aware earnings')
  res = await riderPage.request.get(`${BASE}/api/driver/earnings`)
  body = await res.json().catch(() => ({}))
  ok('earnings load', res.status() === 200 && body.published === true)
  ok('rate card exposed to the rider', body.rates && body.rates.pickup === 1500 && body.rates.perKm === 150 && body.rates.freeKm === 4 && body.rates.cap === 1800)

  const leg = (num) => (body.ledger ?? []).find((l) => l.orderNumber === num && l.leg === 'PICKUP')
  const nearPickup = leg('KZ-T73NEAR')
  const midPickup = leg('KZ-T73MID')
  const capPickup = leg('KZ-T73CAP')
  const nobrPickup = leg('KZ-T73NOBR')
  const nozonePickup = leg('KZ-T73NOZONE')

  ok('NEAR: 0.0 km pays base 1500', nearPickup && nearPickup.amount === 1500 && nearPickup.distanceKm === 0, JSON.stringify(nearPickup))
  ok('MID: 7.3 km pays 2100 (600 distance)', midPickup && midPickup.amount === 2100 && midPickup.distancePay === 600, JSON.stringify(midPickup))
  ok('CAP: 28.8 km pays 3300 (capped 1800)', capPickup && capPickup.amount === 3300 && capPickup.distancePay === 1800, JSON.stringify(capPickup))
  ok('NO-BRANCH: base only, null distance', nobrPickup && nobrPickup.amount === 1500 && nobrPickup.distanceKm === null, JSON.stringify(nobrPickup))
  ok('NO-ZONE: base only, null distance', nozonePickup && nozonePickup.amount === 1500 && nozonePickup.distanceKm === null, JSON.stringify(nozonePickup))

  const nearDelivery = (body.ledger ?? []).find((l) => l.orderNumber === 'KZ-T73NEAR' && l.leg === 'DELIVERY')
  ok('NEAR delivery leg priced too', nearDelivery && nearDelivery.amount === 1500)

  ok('summary total 11400 (6 legs)', body.summary && body.summary.total === 11400, String(body.summary?.total))
  ok('paid 2000 from seed payout', body.payouts && body.payouts.paidTotal === 2000)
  ok('pending 9400', body.payouts && body.payouts.pending === 9400, String(body.payouts?.pending))

  // ================================================================
  // [7] Admin roster — reconciles with the rider's own ledger
  // ================================================================
  console.log('\n[7] Admin roster reconciliation')
  res = await admin.request.get(`${BASE}/api/rider-applications`)
  body = await res.json().catch(() => ({}))
  const roster = (body.roster ?? []).find((r) => r.email === 't73rider@kozy.test')
  ok('roster loads the rider', res.status() === 200 && !!roster)
  ok('roster earnedTotal 11400 (same priceLeg path)', roster && roster.earnedTotal === 11400, String(roster?.earnedTotal))
  ok('roster pendingPayout 9400', roster && roster.pendingPayout === 9400, String(roster?.pendingPayout))
  ok('roster sees bank on file', roster && roster.bankOnFile === true)

  // ================================================================
  // [8] Payout desk — settle against the distance-aware balance
  // ================================================================
  console.log('\n[8] Payout desk round-trip')
  res = await admin.request.post(`${BASE}/api/rider-payouts`, {
    data: { riderId: roster.id, amount: 1400, method: 'BANK_TRANSFER', reference: 'TRF-73-002', note: 'Distance-era settle' },
  })
  body = await res.json().catch(() => ({}))
  ok('payout recorded', res.status() === 201)
  ok('pending drops to 8000', (body.balance ?? {}).pending === 8000, JSON.stringify(body.balance))

  res = await riderPage.request.get(`${BASE}/api/driver/earnings`)
  body = await res.json().catch(() => ({}))
  ok('rider sees the settle instantly (pending 8000)', body.payouts && body.payouts.pending === 8000)
  ok('payout history lists both rows', (body.payouts?.history ?? []).length === 2)

  // ================================================================
  // [9] Cleanliness — no page errors on the visited surfaces
  // ================================================================
  console.log('\n[9] Console cleanliness')
  ok('zero page errors on public surfaces', errors.length === 0, errors.slice(0, 3).join(' | '))

  await browser.close()
  console.log(`\n==== T73 VERIFY: ${pass} PASS, ${fail} FAIL ====`)
  process.exit(fail > 0 ? 1 : 0)
})().catch((e) => {
  console.error('verify crashed:', e)
  process.exit(1)
})
