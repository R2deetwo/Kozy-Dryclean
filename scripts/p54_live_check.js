// Phase 54 LIVE check — kozycare.ng after the deploy. Read-only probes:
// pages render, the new endpoints are guarded (401/400, never 500), the
// join-riders page carries the onboarding strip, and NO emails fire.
const { chromium } = require('playwright');

const BASE = 'https://kozycare.ng';
let pass = 0, fail = 0;
function log(name, ok, extra) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra !== undefined ? `  (${extra})` : ''}`);
  ok ? pass++ : fail++;
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  // 1) pages
  for (const path of ['/', '/services', '/book', '/login', '/join-riders']) {
    const res = await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
    log(`L1 ${path} 200`, res.status() === 200, `status ${res.status()}`);
  }

  // 2) join-riders content (the clarity strip)
  await page.goto(`${BASE}/join-riders`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  const strip = await page.locator('text=How onboarding works').count();
  const apply = await page.locator('text=Apply').count();
  const welcome = await page.locator('text=Welcome email').count();
  const formFields = await page.locator('#licenseNumber').count();
  log('L2 join-riders onboarding strip + form', strip === 1 && apply >= 1 && welcome >= 1 && formFields === 1,
    `strip=${strip}, licence=${formFields}`);

  // 3) API guards (from the browser so CORS/cookies behave like the app)
  const g1 = await page.evaluate(async () => (await fetch('/api/rider-applications')).status);
  log('L3 rider-applications GET unauthenticated 401 (not 500)', g1 === 401, `status ${g1}`);

  const g2 = await page.evaluate(async () => {
    const r = await fetch('/api/rider-applications', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: 'probe' }),
    });
    return r.status;
  });
  log('L4 application POST missing fields 400 (not 500)', g2 === 400, `status ${g2}`);

  const g3 = await page.evaluate(async () => {
    const r = await fetch('/api/rider-applications/xyzprobe/decision', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    });
    return r.status;
  });
  log('L5 decision endpoint unauthenticated 401', g3 === 401, `status ${g3}`);

  const g4 = await page.evaluate(async () => {
    const r = await fetch('/api/orders/someorderid/message', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'A probe question for the endpoint guard.' }),
    });
    return r.status;
  });
  log('L6 message endpoint unauthenticated 401', g4 === 401, `status ${g4}`);

  // 4) home regression (hero still present — the cadence change touched no page)
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const hero = await page.locator('h1').first().textContent().catch(() => '');
  log('L7 home hero intact', /Uncompromising care/i.test(hero || ''), (hero || '').slice(0, 60));

  log('L8 zero page errors', errors.length === 0, errors.slice(0, 2).join(' | '));

  await browser.close();
  console.log(`\n=== LIVE: ${pass} passed, ${fail} failed ===`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => {
  console.error('live check crashed:', e);
  process.exit(1);
});
