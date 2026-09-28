// Task 70 LIVE verification against kozycare.ng
const { chromium } = require('playwright')
let pass = 0, fail = 0
function ok(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  PASS ${name}${extra ? ' — ' + extra : ''}`) }
  else { fail++; console.log(`  FAIL ${name}${extra ? ' — ' + extra : ''}`) }
}

;(async () => {
  const browser = await chromium.launch()

  // 1. Plans API
  console.log('[1] Live plans API')
  const res = await fetch('https://kozycare.ng/api/subscriptions/plans')
  const body = await res.json()
  const active = (body.plans || []).filter((p) => p.isActive)
  ok('6 active plans', active.length === 6, `${active.length}`)
  ok('3 SHOES family live', active.filter((p) => p.family === 'SHOES').length === 3)
  ok('3 KIT family live', active.filter((p) => (p.family ?? 'KIT') === 'KIT').length === 3)

  // 2. /services — the Shoe Club band
  console.log('[2] /services live — Shoe Club')
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto('https://kozycare.ng/services', { waitUntil: 'domcontentloaded' })
  for (let y = 0; y < 8000; y += 700) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y)
    await page.waitForTimeout(150)
  }
  await page.evaluate(() => window.scrollTo(0, 0))
  ok('club band heading present', (await page.locator('text=The Kozy Shoe Club').count()) >= 1)
  const joinBtns = await page.locator('#shoe-club button:has-text("Join this club")').count()
  ok('3 joinable club cards', joinBtns === 3, `found ${joinBtns}`)
  const clubTxt = await page.locator('#shoe-club').innerText().catch(() => '')
  ok('undercut copy present', /7,000|8,000/.test(clubTxt || ''))
  await page.screenshot({ path: 'work/t70_live_services_club.png' })

  // 3. /memberships — tiers only
  console.log('[3] /memberships live — tiers only')
  await page.goto('https://kozycare.ng/memberships', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  const memTxt = await page.content()
  ok('3 tiers render', /The Essentials/.test(memTxt) && /The Household/.test(memTxt) && /The Whole Home/.test(memTxt))
  ok('no Shoe Club in tiers grid', !/Shoe Club/.test(memTxt))

  // 4. branches API — statsResetAt field live
  console.log('[4] Live branches API')
  const bres = await fetch('https://kozycare.ng/api/branches')
  const bbody = await bres.json()
  ok('branches carry statsResetAt', bbody.branches.every((b) => 'statsResetAt' in b))
  ok('ownership types present', bbody.branches.every((b) => b.ownershipType === 'COMPANY'))

  ok('zero page errors', errors.length === 0, errors.slice(0, 2).join(' | '))
  console.log(`\nLIVE RESULT: ${pass} pass, ${fail} fail`)
  await browser.close()
  process.exit(fail > 0 ? 1 : 0)
})().catch((e) => { console.error('FATAL', e); process.exit(1) })
