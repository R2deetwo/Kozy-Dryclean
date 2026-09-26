// Debug the geofence ping + distance chip in the rider app.
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    permissions: ['notifications', 'geolocation'],
    geolocation: { latitude: 6.4541, longitude: 3.4703 },
  });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE ERR:', m.text().slice(0, 200)); });
  page.on('request', (r) => { if (r.url().includes('/api/driver/location')) console.log('REQ', r.method(), r.url()); });
  page.on('response', async (r) => {
    if (r.url().includes('/api/driver/location')) {
      console.log('RESP', r.status(), (await r.text().catch(() => '')).slice(0, 220));
    }
  });
  await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"]', 'driver61@kozy-test.example');
  await page.fill('input[type="password"]', 'Phase61!Rider2026');
  await page.click('button[type="submit"]');
  await page.waitForURL(/driver/, { timeout: 20000 });
  await page.waitForSelector('text=Your route today', { timeout: 15000 });
  for (let i = 0; i < 12; i++) {
    await sleep(1500);
    const pill = await page.textContent('header').catch(() => '');
    const chip = await page.evaluate(() => document.body.innerText.match(/[\d.]+\s?km away/i)?.[0] ?? null);
    console.log(`t=${(i + 1) * 1.5}s pill="${pill.replace(/\s+/g, ' ').trim().slice(0, 80)}" chip=${chip}`);
    if (chip) break;
  }
  await browser.close();
})();
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
