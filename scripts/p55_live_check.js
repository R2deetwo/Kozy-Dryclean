// Phase 55 live check on kozycare.ng — the new surfaces respond, the new
// endpoints are guarded (never 500), and the clarified form copy is live.
const { chromium } = require('playwright');
const BASE = 'https://kozycare.ng';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0;
const log = (name, ok, extra) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra !== undefined ? `  (${extra})` : ''}`);
  ok ? pass++ : fail++;
};

(async () => {
  // --- HTTP status checks ---
  for (const path of ['/', '/join-riders', '/login', '/services']) {
    const r = await fetch(`${BASE}${path}`, { redirect: 'follow' });
    log(`GET ${path} → 200`, r.status === 200, `status ${r.status}`);
  }

  // --- API guards (unauthenticated: 401, never 500) ---
  for (const [method, path] of [
    ['POST', '/api/orders/whatever/incident'],
    ['POST', '/api/rider-incidents/whatever'],
    ['GET', '/api/rider-applications'],
  ]) {
    const r = await fetch(`${BASE}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: method === 'POST' ? JSON.stringify({ kind: 'DAMAGE', description: 'probe' }) : undefined,
    });
    log(`${method} ${path} guarded (${r.status < 500 && r.status !== 404 ? r.status : 'unexpected'})`,
      r.status === 401 || r.status === 403, `status ${r.status}`);
  }

  // --- Validation live on the public form ---
  const r = await fetch(`${BASE}/api/rider-applications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Live Probe', phone: 'not-a-phone', altPhone: '08030000001',
      address: '12 Alexander Ave, Ikoyi', lga: 'Ikoyi', bikeModel: 'Bajaj Boxer',
      bikeYear: '2022', licenseNumber: 'ABC123456', availability: 'full-time', consent: true,
    }),
  });
  log('POST /api/rider-applications bad phone rejected (400)', r.status === 400, `status ${r.status}`);

  // --- UI copy checks ---
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${BASE}/join-riders`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#experience', { timeout: 20000 }).catch(() => {});
  const body = await page.textContent('body').catch(() => '');
  log('live form: self-explaining experience question',
    /worked as a rider or driver before/i.test(body) && /this would be my first/i.test(body));
  log('live form: phone field guidance present', /Your Phone Number/.test(body));
  await page.screenshot({ path: 'work/p55-live-join-riders.png', fullPage: false });

  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await sleep(1500);
  const home = await page.textContent('body').catch(() => '');
  log('home hero intact', /Kozy Care|uncompromising/i.test(home));
  log('zero page errors', errors.length === 0, errors.slice(0, 2).join(' | ') || 'clean');

  await browser.close();
  console.log(`\n${pass}/${pass + fail} PASS, ${fail} FAIL`);
  process.exit(fail === 0 ? 0 : 1);
})();
