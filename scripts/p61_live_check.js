// Read-only live health check of kozycare.ng (phase-60 production) as the
// phase-56 E2E admin persona. Confirms the site is healthy and pinpoints
// exactly which phase-61 surfaces are NOT yet live (deploy blocked by the
// dead Vercel token). Zero mutations, zero emails.
const { chromium } = require('playwright');

const BASE = 'https://kozycare.ng';
const ADMIN = { email: 'vk5m2w8t4a@woosh.dpdns.org', password: 'KozyE2EAdmin!56' };

let pass = 0, fail = 0;
function log(name, ok, extra) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra !== undefined ? `  (${extra})` : ''}`);
  ok ? pass++ : fail++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  // Public pages
  for (const path of ['/', '/driver', '/login']) {
    const res = await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', maxWait: 30000 }).catch(() => null);
    log(`${path} reachable`, Boolean(res && res.status() === 200), res ? res.status() : 'network error');
  }

  // Admin persona sign-in (read-only session)
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"]', ADMIN.email);
  await page.fill('input[type="password"]', ADMIN.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/admin/, { timeout: 30000 });
  log('E2E admin persona signs in', page.url().includes('/admin'));
  await sleep(2500);
  const bodyText = await page.textContent('body');
  log('console dashboard renders', /Orders|Kanban|Dashboard/i.test(bodyText));

  // Rider app as this admin (admins can preview /driver) — phase 60 state
  await page.goto(`${BASE}/driver`, { waitUntil: 'domcontentloaded' });
  await sleep(2000);
  const riderText = await page.textContent('body');
  log('rider app page loads for admin preview', riderText.length > 200);

  // Phase-61 surfaces NOT yet live (the deploy gap, stated as fact):
  const manifestCode = await page.evaluate(() => fetch('/manifest-driver.webmanifest').then((r) => r.status).catch(() => 0));
  log('PHASE-61 CHECK: manifest-driver.webmanifest is 404 (NOT deployed yet)', manifestCode === 404, `status=${manifestCode}`);
  const swCode = await page.evaluate(() => fetch('/sw.js').then((r) => r.status).catch(() => 0));
  log('PHASE-61 CHECK: service worker is 404 (NOT deployed yet)', swCode === 404, `status=${swCode}`);
  const tabsPresent = /Earnings/.test(riderText) && /History/.test(riderText);
  log('PHASE-61 CHECK: rider tabs absent on live (phase 60 running)', !tabsPresent);

  log('zero page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  console.log(`\n==== LIVE CHECK: ${pass} PASS, ${fail} FAIL ====`);
  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => {
  console.error('LIVE CHECK CRASH:', String(e).slice(0, 300));
  process.exit(2);
});
