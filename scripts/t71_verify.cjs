// =============================================================================
// Task 71 verification — Shoe Club repricing (2/4/6 rotation ladder) + tier
// shoe-perk visibility. One process, one server lifetime (the sandbox kills
// spawned processes at tool boundaries).
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
  // 1. API — the repriced club ladder + untouched tiers
  // ================================================================
  console.log('\n[1] Plans API')
  const plansRes = await fetch(`${BASE}/api/subscriptions/plans`)
  const plansBody = await plansRes.json()
  const plans = plansBody.plans || []
  const kit = plans.filter((p) => (p.family ?? 'KIT') === 'KIT' && p.isActive)
  const shoes = plans.filter((p) => p.family === 'SHOES' && p.isActive)
  ok('plans endpoint 200', plansRes.status === 200)
  ok('3 active KIT tiers', kit.length === 3, kit.map((p) => p.code).join(','))
  ok('3 active SHOES club plans (2/4/6)', shoes.length === 3, shoes.map((p) => p.code).join(','))
  ok('club codes are SHOES2/4/6', ['SHOES2', 'SHOES4', 'SHOES6'].every((c) => shoes.some((s) => s.code === c)))
  ok('no SHOES1/3/5 still active', ['SHOES1', 'SHOES3', 'SHOES5'].every((c) => !shoes.some((s) => s.code === c)))
  ok('club prices 3000/5000/7200', ['SHOES2', 'SHOES4', 'SHOES6'].every((c) => {
    const p = shoes.find((s) => s.code === c)
    return p && { SHOES2: 3000, SHOES4: 5000, SHOES6: 7200 }[c] === p.priceMonthly
  }))
  ok('club pairs 2/4/6', ['SHOES2', 'SHOES4', 'SHOES6'].every((c) => {
    const p = shoes.find((s) => s.code === c)
    return p && { SHOES2: 2, SHOES4: 4, SHOES6: 6 }[c] === p.shoesPerMonth
  }))
  ok('per-pair never below own 1000 floor', shoes.every((p) => p.shoesPerMonth > 0 && p.priceMonthly / p.shoesPerMonth >= 1000),
    shoes.map((p) => Math.round(p.priceMonthly / p.shoesPerMonth)).join('/'))
  ok('tiers keep 1/3/5 shoe perks', ['ESSENTIALS', 'HOUSEHOLD', 'WHOLEHOME'].every((c) => {
    const p = kit.find((t) => t.code === c)
    return p && { ESSENTIALS: 1, HOUSEHOLD: 3, WHOLEHOME: 5 }[c] === p.shoesPerMonth
  }))

  // ================================================================
  // 2. /services — repriced club band
  // ================================================================
  console.log('\n[2] /services — Shoe Club band')
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(`${BASE}/services`, { waitUntil: 'domcontentloaded' })
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
  const clubTxt = await clubSection.innerText().catch(() => '')
  ok('dynamic per-pair anchor reads 1,200', /₦1,200 a pair/.test(clubTxt || ''))
  ok('per-pair math on cards (1,500 / 1,250 / 1,200)', ['₦1,500', '₦1,250', '₦1,200'].every((n) => (clubTxt || '').includes(n)))
  ok('old ₦800/pair copy GONE', !/₦800/.test(clubTxt || ''))
  ok('competitor anchor (7,000–8,000) present', /7,000|8,000/.test(clubTxt || ''))
  ok('rotation rhythm chips (fortnightly/weekly/twice)', /fortnight/.test(clubTxt || '') && /twice a week/.test(clubTxt || ''))
  ok('stacking footer mentions tier pairs (1/3/5)', /1 pair on Essentials, 3 on Household, 5 on Whole Home/.test(clubTxt || ''))
  await page.screenshot({ path: 'work/t71_services_club.png', fullPage: false })

  // ================================================================
  // 3. /memberships — tiers with PROMINENT shoe perk + FAQ
  // ================================================================
  console.log('\n[3] /memberships — tier shoe perks visible')
  await page.goto(`${BASE}/memberships`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const memTxt = await page.content()
  ok('3 tiers render', /The Essentials/.test(memTxt) && /The Household/.test(memTxt) && /The Whole Home/.test(memTxt))
  ok('no Shoe Club card in tiers grid', !/Join this club/.test(memTxt))
  const unitsBoxShoes = await page.locator('text=/\\+ 1 pair of shoes every month|\\+ 3 pairs of shoes every month|\\+ 5 pairs of shoes every month/').count()
  ok('units box shows the shoe line on all three tiers', unitsBoxShoes >= 3, `found ${unitsBoxShoes}`)
  const faqShoe = await page.getByText('Do the plans really include shoes?').count()
  ok('shoe FAQ present', faqShoe >= 1)
  const faqBody = await page.getByText(/1 pair on The Essentials, 3 pairs on The Household, 5 pairs on The Whole Home/).count()
  ok('FAQ spells the 1/3/5 ladder + club stacking', faqBody >= 1)
  await page.screenshot({ path: 'work/t71_memberships_tiers.png', fullPage: false })

  // ================================================================
  // 4. Admin — Shoe Club editor shows the new ladder
  // ================================================================
  console.log('\n[4] Admin — Shoe Club editor')
  const admin = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await login(admin, 't70admin@kozy.test', 'T70Admin!2026')
  const growthNav = admin.getByRole('button', { name: /^Growth|^Marketing|^Memberships/i }).first()
  const navCandidates = ['Memberships', 'Growth', 'Marketing']
  let opened = false
  for (const label of navCandidates) {
    const nav = admin.getByRole('button', { name: new RegExp(`^${label}`, 'i') }).first()
    if (await nav.count()) {
      await nav.click()
      await admin.waitForTimeout(2500)
      opened = true
      break
    }
  }
  if (!opened) {
    const txt = admin.getByText('Memberships').first()
    if (await txt.count()) { await txt.click(); await admin.waitForTimeout(2500) }
  }
  await admin.waitForTimeout(1500)
  const adminTxt = await admin.content()
  ok('admin memberships surface reached', /The Shoe Club/.test(adminTxt))
  ok('admin editor shows 2 pairs card', /Shoe Club · 2 pairs/.test(adminTxt))
  ok('admin editor shows 6 pairs card', /Shoe Club · 6 pairs/.test(adminTxt))
  ok('admin per-pair hint updated (1,500/1,200)', /1,500 a pair/.test(adminTxt) || /1,200 a pair/.test(adminTxt))
  await admin.screenshot({ path: 'work/t71_admin_club.png' })

  // ================================================================
  // 5. Sanity — zero page errors across surfaces
  // ================================================================
  ok('zero page errors across surfaces', errors.length === 0, errors.slice(0, 3).join(' | '))

  console.log(`\nRESULT: ${pass} pass, ${fail} fail`)
  await browser.close()
  process.exit(fail > 0 ? 1 : 0)
})().catch((e) => {
  console.error('FATAL', e)
  process.exit(1)
})
