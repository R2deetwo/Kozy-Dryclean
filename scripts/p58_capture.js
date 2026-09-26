// Phase 58 captures — login banner + short-viewport sidebar evidence.
const { chromium } = require('playwright');
const BASE = 'http://localhost:3000';
const ADMIN = { email: 'admin40@kozy-test.example', password: 'Phase40!Admin2026' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"]', ADMIN.email);
  await page.fill('input[type="password"]', ADMIN.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/admin/, { timeout: 20000 });
  await sleep(1500);
  await page.setViewportSize({ width: 1280, height: 640 });
  await sleep(600);
  await page.screenshot({ path: 'work/p58-sidebar-640.png' }); // full sidebar incl. Sign out at short height
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector("text=You're already signed in", { timeout: 10000 });
  await sleep(1000);
  await page.screenshot({ path: 'work/p58-login-banner.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await sleep(800);
  await page.screenshot({ path: 'work/p58-login-banner-mobile.png' });
  await browser.close();
  console.log('captures done');
})().catch((e) => { console.error(e); process.exit(1); });
