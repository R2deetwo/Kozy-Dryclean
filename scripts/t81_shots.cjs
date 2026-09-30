// Task 81 — visual proof: the banner between header and stats, the drop-down,
// the "I've made payment" baton, and the quiet Change plan door.
const { chromium } = require('playwright')
const BASE = 'http://localhost:3000'
const OUT = '/home/z/my-project/work/t81-shots'

async function login(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL(/portal|admin/, { timeout: 20000 })
  await page.waitForTimeout(1500)
}

;(async () => {
  const fs = require('fs')
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()

  // Mobile — the owner's own testing viewport
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await login(page, 't81pend@woosh.dpdns.org', 'T81Pend!2026')
  await page.goto(`${BASE}/portal?pay=1`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1800)
  await page.screenshot({ path: `${OUT}/01-banner-top-mobile.png` })

  await page.getByRole('button', { name: 'Pay by bank transfer' }).first().click()
  await page.waitForTimeout(1000)
  await page.screenshot({ path: `${OUT}/02-transfer-dropped-down.png` })

  await page.getByRole('button', { name: /I've made payment/i }).first().click()
  await page.waitForTimeout(1300)
  await page.screenshot({ path: `${OUT}/03-claim-toast.png` })

  // Desktop — full portal with the banner above the stat cards
  const desk = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await login(desk, 't81pend@woosh.dpdns.org', 'T81Pend!2026')
  await desk.goto(`${BASE}/portal`, { waitUntil: 'networkidle' })
  await desk.waitForTimeout(1500)
  await desk.screenshot({ path: `${OUT}/04-banner-desktop.png` })

  // The membership tab for a pending member (request wording, scroll button)
  await desk.getByRole('tab', { name: /Membership/i }).click()
  await desk.waitForTimeout(1200)
  await desk.screenshot({ path: `${OUT}/05-membership-tab-pending.png` })

  // The quiet Change plan door on a live member
  const live = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await login(live, 't81active@woosh.dpdns.org', 'T81Active!2026')
  await live.goto(`${BASE}/portal`, { waitUntil: 'networkidle' })
  await live.getByRole('tab', { name: /Membership/i }).click()
  await live.waitForTimeout(1000)
  await live.screenshot({ path: `${OUT}/06-live-membership.png` })
  await live.getByRole('button', { name: 'Change plan' }).first().click()
  await live.waitForTimeout(700)
  await live.screenshot({ path: `${OUT}/07-change-plan-dialog.png` })

  await browser.close()
  console.log('shots done:', fs.readdirSync(OUT).join(', '))
})().catch((e) => {
  console.error('SHOTS CRASHED:', e)
  process.exit(1)
})
