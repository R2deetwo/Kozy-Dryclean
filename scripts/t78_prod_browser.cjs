// Task 78 — production smoke: home renders, the renewal deep link still
// funnels signed-out visitors to login, no store on the landing page, and
// no unexpected console errors.
const { chromium } = require('playwright')

const BASE = 'https://kozycare.ng'
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

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  const errors = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(String(e)))

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.waitForTimeout(2500)
  const homeText = await page.textContent('body').catch(() => '')
  ok('home renders', homeText.toLowerCase().includes('kozy'))
  ok('no store on the landing page', !/shop the store|kozy store|our products/i.test(homeText))

  // The renewal deep link: signed-out → login (the member journey entry).
  await page.goto(`${BASE}/portal?renew=1&months=6`, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.waitForTimeout(2000)
  const url = page.url()
  const loginText = await page.textContent('body').catch(() => '')
  ok('renewal deep link funnels to login', /login|sign in/i.test(url) || /log in|sign in/i.test(loginText), url)

  // Zip stays gone.
  const zipRes = await page.request.get(`${BASE}/kozy-google-ads-logos.zip`)
  ok('logo zip still 404', zipRes.status() === 404, `status ${zipRes.status()}`)

  const benign = errors.filter((e) => !/404|insights|vercel/i.test(e))
  ok('no unexpected console errors', benign.length === 0, benign.slice(0, 2).join(' | ').slice(0, 120))

  await browser.close()
  console.log(`\n[t78-prod] ${pass} pass, ${fail} fail`)
  process.exit(fail > 0 ? 1 : 0)
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
