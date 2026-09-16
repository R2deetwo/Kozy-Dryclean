// Snap the W36-W46 window — shows the fixed Week 38 row (the one the client flagged).
const { chromium } = require('playwright');
const BASE = 'http://localhost:3000';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'admin40@kozy-test.example');
  await page.fill('input[type="password"]', 'Phase40!Admin2026');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);

  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.click('text=Marketing');
  await page.waitForTimeout(3000);
  await page.click('button:has-text("Browse the 52-week plan")');
  await page.waitForTimeout(2500);

  const dialog = page.locator('.max-h-\\[420px\\]');
  // W38 sits ~72% down; W45 ~88% — two crops to show both fixed rows
  await dialog.evaluate((el) => { el.scrollTop = el.scrollHeight * 0.70; });
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/home/z/my-project/work/detty-fix/w36-w42-rows.png' });
  await dialog.evaluate((el) => { el.scrollTop = el.scrollHeight * 0.88; });
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/home/z/my-project/work/detty-fix/w43-w47-rows.png' });

  await browser.close();
  console.log('snapped');
})().catch((e) => { console.error(e); process.exit(1); });
