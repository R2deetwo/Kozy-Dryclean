// Phase 55 capture: the join-riders FORM (not the success screen), and the
// rider app's ROUTE LIST with the Rules dialog open.
const { chromium } = require('playwright');
const BASE = 'http://localhost:3000';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch();

  // --- join-riders form (desktop, filled with sample values) ---
  const jp = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  await jp.goto(`${BASE}/join-riders`, { waitUntil: 'domcontentloaded' });
  await jp.waitForSelector('#fullName', { timeout: 15000 });
  await jp.evaluate(() => document.querySelector('#experience')?.scrollIntoView({ block: 'center' }));
  await sleep(400);
  await jp.screenshot({ path: 'work/p55-join-riders-form.png', fullPage: true });

  // --- rider app route list + Rules dialog ---
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const rp = await ctx.newPage();
  await rp.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await sleep(1200);
  await rp.fill('#email', 'driver44@kozy-test.example');
  await rp.fill('#password', 'Phase44!Driver2026');
  await rp.click('button[type="submit"]');
  for (let i = 0; i < 40 && rp.url().includes('/login'); i++) await sleep(500);
  await rp.goto(`${BASE}/driver`, { waitUntil: 'domcontentloaded' });
  await sleep(2500);
  await rp.screenshot({ path: 'work/p55-rider-route.png', fullPage: false });
  await rp.click('button:has-text("Rules")').catch(() => {});
  await sleep(800);
  await rp.screenshot({ path: 'work/p55-rider-rules.png', fullPage: false });

  await browser.close();
  console.log('captured: work/p55-join-riders-form.png, work/p55-rider-route.png, work/p55-rider-rules.png');
})();
