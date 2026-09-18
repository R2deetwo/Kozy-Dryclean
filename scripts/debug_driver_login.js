// Focused debug: why doesn't the driver sign-in navigate to /driver?
const { chromium } = require('playwright');
const BASE = 'http://localhost:3000';

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();

  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') console.log('CONSOLE', m.type(), m.text().slice(0, 200));
  });
  page.on('pageerror', (e) => console.log('PAGEERROR', String(e).slice(0, 300)));
  page.on('framenavigated', (f) => {
    if (f === page.mainFrame()) console.log('NAV ->', f.url());
  });
  page.on('requestfailed', (r) => console.log('REQFAIL', r.url().slice(0, 120), r.failure()?.errorText));
  page.on('response', (r) => {
    if (r.url().includes('/driver') || r.url().includes('callback') || r.url().includes('users/me')) {
      console.log('RESP', r.status(), r.url().slice(0, 120));
    }
  });

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"]', 'driver44@kozy-test.example');
  await page.fill('input[type="password"]', 'Phase44!Driver2026');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(9000);

  console.log('FINAL URL:', page.url());
  const btn = await page.locator('button[type="submit"]').innerText().catch(() => 'n/a');
  console.log('BUTTON TEXT:', btn);
  await browser.close();
})().catch((e) => {
  console.error('ERR', e);
  process.exit(1);
});
