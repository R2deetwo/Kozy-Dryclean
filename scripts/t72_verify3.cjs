// =============================================================================
// Task 72 verification — PHASE C: the admin desks render (Riders payout desk
// + Partners settlement desk). The API layer is proven by phases A/B; this
// catches runtime React errors in the heavily edited console views.
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
  await page.waitForURL(/admin/, { timeout: 20000 })
  await page.waitForTimeout(1500)
}

;(async () => {
  const browser = await chromium.launch()
  const admin = await browser.newPage()
  const errors = []
  admin.on('pageerror', (e) => errors.push(String(e)))
  admin.on('console', (m) => {
    const url = m.location()?.url ?? ''
    if (m.type() === 'error' && !url.includes('_vercel/insights') && !/_vercel\/insights/.test(m.text())) {
      errors.push(m.text())
    }
  })

  await login(admin, 't72admin@kozy.test', 'T72Admin!2026')

  // ---- Team → Riders (payout desk) ----
  console.log('\n[C1] Riders desk renders')
  // The nav groups SCALE → Team (Staff · Riders): find the Riders entry.
  await admin.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' })
  await admin.waitForTimeout(2000)
  // Team → (Staff · Riders): open the Team tab, then the Riders sub-tab
  // (shadcn Tabs renders role="tab" triggers).
  const clicked = await admin
    .locator('button:has-text("Team")')
    .first()
    .click()
    .then(() => true)
    .catch(() => false)
  await admin.waitForTimeout(1500)
  const clickedRiders = await admin
    .locator('[role="tab"]:has-text("Riders"), button:has-text("Riders")')
    .first()
    .click()
    .then(() => true)
    .catch(() => false)
  ok('Team tab + Riders sub-tab reachable', clicked && clickedRiders)
  await admin.waitForTimeout(2500)
  const ridersText = await admin.textContent('body').catch(() => '')
  ok('roster card shows pending payout line', /Pending payout/.test(ridersText ?? ''))
  ok('settle action present', /Settle rider/.test(ridersText ?? ''))
  ok('bank line present (GTBank from phase A)', /GTBank/.test(ridersText ?? ''))
  ok('payout history table present', /Payout history/.test(ridersText ?? '') && /TRF-72-001/.test(ridersText ?? ''))

  // ---- Partners desk ----
  console.log('\n[C2] Partners desk renders')
  await admin.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' })
  await admin.waitForTimeout(2000)
  const clickedPartners = await admin
    .locator('button:has-text("Partners")')
    .first()
    .click()
    .then(() => true)
    .catch(() => false)
  ok('Partners tab reachable', clickedPartners)
  await admin.waitForTimeout(2500)
  let partnersText = await admin.textContent('body').catch(() => '')
  // Applications tab first (default).
  ok('applications queue renders (KZP ref visible)', /KZP-/.test(partnersText ?? ''))
  // Switch to the network tab.
  await admin.click('[role="tab"]:has-text("Network"), button:has-text("Network")').catch(() => {})
  await admin.waitForTimeout(2000)
  partnersText = await admin.textContent('body').catch(() => '')
  ok('network roster shows the approved partner', /T72 Sparkle Laundry/.test(partnersText ?? ''))
  ok('settlement line renders with pending', /Settlements — share earned/.test(partnersText ?? ''))
  ok('login badge on partner card', /login active/.test(partnersText ?? '') || /login paused/.test(partnersText ?? ''))

  ok('zero page errors on the console desks', errors.length === 0, errors.slice(0, 2).join(' | '))

  await browser.close()
  console.log(`\nPHASE C: ${pass} pass / ${fail} fail`)
  process.exit(fail > 0 ? 1 : 0)
})().catch((e) => {
  console.error('phase C crashed:', e)
  process.exit(1)
})
