// Task 77 — quick production browser verification: the deployed site renders,
// no console errors, and the removed logo zip is really gone.
const { chromium } = require('playwright')

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })

  await page.goto('https://kozycare.ng/', { waitUntil: 'networkidle', timeout: 45000 })
  const title = await page.title()
  const body = await page.textContent('body').catch(() => '')
  console.log('title:', title)
  console.log('home renders brand:', /Kozy/i.test(body))
  console.log('store NOT on landing page:', !/Kozy Store|Also from Kozy/i.test(body))

  // The login page (the renewal deep link lands here signed-out).
  await page.goto('https://kozycare.ng/portal?renew=1&months=3', { waitUntil: 'networkidle', timeout: 45000 })
  const url = page.url()
  console.log('renew deep link signed-out →', url.includes('/login') ? 'login (correct)' : url)
  await page.waitForTimeout(800)
  const loginBody = await page.textContent('body').catch(() => '')
  console.log('login renders:', /sign in|welcome/i.test(loginBody))

  const zipRes = await page.request.get('https://kozycare.ng/kozy-google-ads-logos.zip')
  const zst = typeof zipRes.status === 'function' ? zipRes.status() : zipRes.status
  console.log('logo zip status:', zst, zst === 404 ? '(gone — correct)' : '(STILL THERE)')

  console.log('console/page errors:', errors.length === 0 ? 'none' : errors.slice(0, 5))
  await browser.close()
  process.exit(errors.length > 0 || zst !== 404 ? 1 : 0)
})().catch((e) => {
  console.error('PROD BROWSER CHECK FAILED:', e)
  process.exit(1)
})
