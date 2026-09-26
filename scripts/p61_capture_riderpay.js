// Re-capture the admin Settings Rider Pay card (scrolled into view).
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"]', 'admin61@kozy-test.example');
  await page.fill('input[type="password"]', 'Phase61!Admin2026');
  await page.click('button[type="submit"]');
  await page.waitForURL(/admin/, { timeout: 20000 });
  await page.click('aside nav button:has-text("Settings")');
  await page.waitForSelector('button[role="tab"]', { timeout: 10000 });
  await page.click('button[role="tab"]:has-text("Offers & Delivery")');
  await page.waitForSelector('text=Rider Pay', { timeout: 10000 });
  await page.locator('text=Rider Pay').scrollIntoViewIfNeeded();
  await page.locator('#rider-pickup-rate').waitFor({ timeout: 5000 });
  await page.evaluate(() => window.scrollBy(0, -80));
  await sleep(600);
  await page.screenshot({ path: 'work/p61-riderpay-admin.png', fullPage: false });
  console.log('captured');
  await browser.close();
  process.exit(0);
})();
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
