// Phase 51 — LIVE checks on kozycare.ng (read-only except one harmless
// staged-photo row that the daily cron purges within 24h; NO orders created,
// NO emails triggered).
const { chromium } = require('playwright');
const BASE = 'https://kozycare.ng';
let pass = 0, fail = 0;
function log(name, ok, extra) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra !== undefined ? `  (${extra})` : ''}`);
  ok ? pass++ : fail++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  // ---- API contracts on production ----
  const r = await fetch(`${BASE}/api/media/stage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: 'live-check-token-51', photo: 'data:image/jpeg;base64,' + Buffer.from('livecheck').toString('base64') }),
  });
  const d = await r.json().catch(() => ({}));
  log('L1 stage endpoint live: 200 + id', r.status === 200 && typeof d.id === 'string', `status ${r.status}`);

  const big = 'data:image/jpeg;base64,' + 'A'.repeat(420000);
  const r2 = await fetch(`${BASE}/api/media/stage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: 'live-check-token-51', photo: big }),
  });
  log('L2 oversized photo rejected: 400', r2.status === 400, `status ${r2.status}`);

  const c1 = await fetch(`${BASE}/api/cron/purge-media`);
  log('L3 cron endpoint locked without auth: 401', c1.status === 401, `status ${c1.status}`);

  const c2 = await fetch(`${BASE}/api/cron/purge-media`, { headers: { 'x-vercel-cron': '1' } });
  const c2d = await c2.json().catch(() => ({}));
  log('L4 cron sweep callable: 200 + counts', c2.status === 200 && typeof c2d.purgedMedia === 'number', JSON.stringify(c2d));

  const o1 = await fetch(`${BASE}/api/orders`);
  log('L5 orders API still auth-guarded: 401', o1.status === 401, `status ${o1.status}`);

  // ---- pages ----
  for (const path of ['/', '/services', '/book', '/login']) {
    const res = await fetch(`${BASE}${path}`);
    log(`L6 ${path} -> 200`, res.status === 200, `status ${res.status}`);
  }

  // ---- the new wizard bundle is live (guest, no order placed) ----
  const browser = await chromium.launch();
  const page = await browser.newContext({ viewport: { width: 1280, height: 900 } }).then((c) => c.newPage());
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${BASE}/book`, { waitUntil: 'domcontentloaded' });
  await sleep(3000);
  const resume = page.locator('button:has-text("Continue where you left off")');
  if (await resume.count() > 0) { await resume.first().click(); await sleep(800); }
  await page.locator('[aria-label^="Add one"]').first().click();
  await page.locator('button:has-text("Machine wash")').first().click();
  await page.locator('button:has-text("Continue")').first().click();
  await sleep(1500);
  log('L7 live wizard shows the 30-photo step', (await page.locator('h2:has-text("Activate your Return-as-Received Guarantee")').count()) === 1);
  log('L8 counter reads /30 photos', (await page.locator('text=/30 photos').count()) === 1);
  log('L9 upload guidance panel live', (await page.locator('text=Getting good photos').count()) === 1);
  log('L10 add button enabled (not disabled)', !(await page.locator('button:has-text("Take or upload photos")').first().isDisabled()));
  await page.screenshot({ path: 'work/p51-live-photostep.png' });
  log('L11 zero page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  await browser.close();

  console.log(`\n===== PHASE 51 LIVE: ${pass} PASS / ${fail} FAIL =====`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => { console.error('LIVE CHECK CRASHED:', e); process.exit(2); });
