// Phase 53 visual capture — the two new loyalty surfaces, for VLM QA:
//   1. portal countdown card (Chidi: exactly 5 paid washes → "5 of 10")
//   2. /milestone page (Amaka's token — appreciation + feedback form)
// Dev-server rules (phase-50/52 lessons): domcontentloaded + sleep, one
// bash invocation starts dev + captures + kills it.
const { chromium } = require('playwright');

const BASE = 'http://localhost:3000';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await sleep(2000);
  await page.fill('#email', 'chidi53@kozy-test.example');
  await page.fill('#password', 'Phase53!Chidi2026');
  await page.click('button[type="submit"]');
  for (let i = 0; i < 40 && page.url().includes('/login'); i++) await sleep(500);
  await page.goto(`${BASE}/portal`, { waitUntil: 'domcontentloaded' });
  await sleep(3000);
  await page.screenshot({ path: '/home/z/my-project/work/p53-portal-countdown.png', fullPage: false });
  console.log('captured portal countdown');

  // milestone page (no login needed — HMAC token)
  const crypto = require('crypto');
  const payload = Buffer.from(JSON.stringify({ u: 'amaka53id0000000000000000' })).toString('base64url');
  const sig = crypto.createHmac('sha256', 'kozy-dev-secret-local-052').update(payload).digest('base64url');
  const token = `${payload}.${sig}`;
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page2 = await ctx2.newPage();
  await page2.goto(`${BASE}/milestone?token=${encodeURIComponent(token)}`, { waitUntil: 'domcontentloaded' });
  await sleep(3000);
  await page2.screenshot({ path: '/home/z/my-project/work/p53-milestone.png', fullPage: false });
  console.log('captured milestone page');

  await browser.close();
  process.exit(0);
})().catch((e) => {
  console.error('capture failed:', e);
  process.exit(1);
});
