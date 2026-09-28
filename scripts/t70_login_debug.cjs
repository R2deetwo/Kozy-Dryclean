// Debug the local admin login flow.
const { chromium } = require('playwright')
;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const reqs = []
  page.on('response', (r) => {
    if (r.url().includes('/api/auth')) reqs.push(`${r.status()} ${r.url().replace('http://localhost:3000', '')}`)
  })
  await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  await page.fill('input[type="email"]', 't70admin@kozy.test')
  await page.fill('input[type="password"]', 'T70Admin!2026')
  await page.click('button[type="submit"]')
  await page.waitForTimeout(6000)
  console.log('auth requests:', reqs)
  console.log('url now:', page.url())
  const bodyText = await page.locator('body').innerText()
  console.log('page text (first 400):', bodyText.slice(0, 400).replace(/\n+/g, ' | '))
  await page.screenshot({ path: 'work/t70_login_debug.png' })
  await browser.close()
})().catch((e) => { console.error('FATAL', e); process.exit(1) })
