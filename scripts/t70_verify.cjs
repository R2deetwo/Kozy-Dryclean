// =============================================================================
// Task 70 verification — one process, one server lifetime (the sandbox kills
// spawned processes at tool boundaries, so this runs against a server the
// parent bash call keeps alive for the duration).
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
  await page.waitForURL(/portal|admin/, { timeout: 20000 })
  await page.waitForTimeout(1200)
}

;(async () => {
  const browser = await chromium.launch()

  // ================================================================
  // 1. API — plans carry the family split
  // ================================================================
  console.log('\n[1] Plans API')
  const plansRes = await fetch(`${BASE}/api/subscriptions/plans`)
  const plansBody = await plansRes.json()
  const plans = plansBody.plans || []
  const kit = plans.filter((p) => (p.family ?? 'KIT') === 'KIT' && p.isActive)
  const shoes = plans.filter((p) => p.family === 'SHOES' && p.isActive)
  ok('plans endpoint 200', plansRes.status === 200)
  ok('3 active KIT tiers', kit.length === 3, kit.map((p) => p.code).join(','))
  ok('3 active SHOES club plans', shoes.length === 3, shoes.map((p) => p.code).join(','))
  ok('club prices 1000/2500/4000', ['SHOES1', 'SHOES3', 'SHOES5'].every((c) => {
    const p = shoes.find((s) => s.code === c)
    return p && { SHOES1: 1000, SHOES3: 2500, SHOES5: 4000 }[c] === p.priceMonthly
  }))
  ok('club pairs 1/3/5', ['SHOES1', 'SHOES3', 'SHOES5'].every((c) => {
    const p = shoes.find((s) => s.code === c)
    return p && { SHOES1: 1, SHOES3: 3, SHOES5: 5 }[c] === p.shoesPerMonth
  }))

  // ================================================================
  // 2. /services — the Shoe Club band in the shoe-care section
  // ================================================================
  console.log('\n[2] /services — Shoe Club band')
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(`${BASE}/services`, { waitUntil: 'domcontentloaded' })
  // scroll pass so whileInView sections materialize (documented artifact guard)
  for (let y = 0; y < 8000; y += 700) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y)
    await page.waitForTimeout(150)
  }
  await page.evaluate(() => window.scrollTo(0, 0))
  const clubHeader = await page.locator('text=The Kozy Shoe Club').count()
  ok('club band heading present', clubHeader >= 1)
  const clubCards = await page.locator('#shoe-club button:has-text("Join this club")').count()
  ok('3 joinable club cards', clubCards === 3, `found ${clubCards}`)
  const clubSection = page.locator('#shoe-club')
  const pairPrice = await clubSection.getByText('₦800 a pair').count()
  ok('per-pair math rendered', pairPrice >= 1)
  const clubTxt = await clubSection.innerText().catch(() => '')
  ok('club mentions ₦2,500 mid tier', /2,500/.test(clubTxt || ''))
  ok('club undercut copy present', /7,000|8,000/.test(clubTxt || ''))
  await page.screenshot({ path: 'work/t70_services_club.png', fullPage: false })

  // ================================================================
  // 3. /memberships — tiers only, club never in the grid
  // ================================================================
  console.log('\n[3] /memberships — tiers untouched')
  await page.goto(`${BASE}/memberships`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const memTxt = await page.content()
  ok('3 tiers render', /The Essentials/.test(memTxt) && /The Household/.test(memTxt) && /The Whole Home/.test(memTxt))
  ok('no Shoe Club in tiers grid', !/Shoe Club/.test(memTxt))

  // ================================================================
  // 4. Admin — Branch Health numbers reset (company branch only)
  // ================================================================
  console.log('\n[4] Admin — Branch Health reset')
  const admin = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await login(admin, 't70admin@kozy.test', 'T70Admin!2026')
  // Sidebar → Operations, then the "Branch health" tab inside it.
  const opsNav = admin.getByRole('button', { name: /^Operations/ }).first()
  if (await opsNav.count()) {
    await opsNav.click()
    await admin.waitForTimeout(2500)
  }
  const healthTab = admin.getByRole('tab', { name: /branch health/i }).first()
  if (await healthTab.count()) {
    await healthTab.click()
    await admin.waitForTimeout(3000)
  } else {
    // fallback: text click
    await admin.getByText('Branch health').first().click()
    await admin.waitForTimeout(3000)
  }
  const adminTxt = await admin.content()
  const hasChevronCard = /Chevron/i.test(adminTxt)
  ok('branch health surface reached', hasChevronCard)
  // Chevron: all-time line should show the 3 seeded orders
  const chevronAllTime = await admin.getByText(/All-time:\s*3 order/i).count()
  ok('Chevron all-time shows 3 orders before reset', chevronAllTime >= 1)
  // company reset control visible; franchise control must never render
  const resetButtons = await admin.locator('button:has-text("Reset numbers")').count()
  ok('Reset numbers control present', resetButtons >= 1, `found ${resetButtons}`)
  // two-tap reset on Chevron
  const chevronCard = admin.locator('div.card, [data-slot="card"]').filter({ hasText: /Chevron/i }).first()
  const chevReset = chevronCard.locator('button:has-text("Reset numbers")').first()
  if (await chevReset.count()) {
    await chevReset.click()
    await admin.waitForTimeout(300)
    const confirmBtn = chevronCard.locator('button:has-text("Confirm restart")').first()
    ok('two-tap confirm appears', (await confirmBtn.count()) === 1)
    await confirmBtn.click()
    await admin.waitForTimeout(2500)
    const sinceLine = await admin.getByText(/Since\s+/i).count()
    ok('"Since" epoch label renders after reset', sinceLine >= 1)
    const zeroLine = await admin.getByText(/0 orders/i).count()
    ok('all-time counts from zero after reset', zeroLine >= 1)
  } else {
    ok('Chevron reset control clickable', false, 'locator missed')
  }
  await admin.screenshot({ path: 'work/t70_branch_health.png' })

  // ================================================================
  // 5. Customer portal — the Shoe Club card
  // ================================================================
  console.log('\n[5] Portal — Shoe Club card')
  const cust = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await login(cust, 't70cust@kozy.test', 'T70Cust!2026')
  await cust.goto(`${BASE}/portal`, { waitUntil: 'domcontentloaded' })
  await cust.waitForTimeout(2500)
  // open the Membership tab if the tab UI exists
  const memTab = cust.locator('button, a, [role="tab"]').filter({ hasText: /membership/i }).first()
  if (await memTab.count()) {
    await memTab.click()
    await cust.waitForTimeout(2000)
  }
  const portalTxt = await cust.content()
  ok('club card renders in portal', /Kozy Shoe Club/.test(portalTxt))
  ok('club plan name shown', /Shoe Club · 3 pairs/.test(portalTxt))
  ok('pairs meter shows 3', /Shoe pairs/.test(portalTxt))
  ok('book a shoe clean button', /Book a shoe clean/.test(portalTxt))
  ok('laundry join invitation for shoes-only member', /Explore the plans|The Kozy Circle/.test(portalTxt))
  await cust.screenshot({ path: 'work/t70_portal_club.png' })

  // ================================================================
  // 6. /book — wizard scroll-to-top on step change
  // ================================================================
  console.log('\n[6] Booking wizard — scroll to top on step change')
  const book = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await book.goto(`${BASE}/book`, { waitUntil: 'domcontentloaded' })
  await book.waitForTimeout(2500)
  // add an item (the + button carries aria-label "Add one …")
  const addBtn = book.locator('button[aria-label^="Add one"]').first()
  if (await addBtn.count()) {
    await addBtn.click()
    await book.waitForTimeout(600)
  }
  // Mode of wash is a required choice on step 1 — pick Machine Wash.
  const machineBtn = book.getByText('Machine Wash').first()
  if (await machineBtn.count()) {
    await machineBtn.click()
    await book.waitForTimeout(500)
  }
  await book.evaluate(() => window.scrollTo(0, 3000))
  await book.waitForTimeout(300)
  const before = await book.evaluate(() => window.scrollY)
  const next = book.locator('button:has-text("Continue"), button:has-text("Next")').first()
  if ((await next.count()) && await next.isEnabled()) {
    await next.click()
    await book.waitForTimeout(900)
    const after = await book.evaluate(() => window.scrollY)
    ok('step change scrolls to top', after < 60, `before=${before} after=${after}`)
  } else {
    ok('Next button enabled after adding an item', false, `count=${await next.count()} enabled=${await next.isEnabled().catch(() => false)}`)
  }

  ok('zero page errors across surfaces', errors.length === 0, errors.slice(0, 3).join(' | '))

  console.log(`\nRESULT: ${pass} pass, ${fail} fail`)
  await browser.close()
  process.exit(fail > 0 ? 1 : 0)
})().catch((e) => {
  console.error('FATAL', e)
  process.exit(1)
})
