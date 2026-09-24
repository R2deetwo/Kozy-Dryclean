// Phase 58 LIVE check — kozycare.ng. Signs in/out as the E2E admin persona
// (vk5m2w8t4a@woosh.dpdns.org — the owner's test inbox persona; login and
// logout fire no emails, and no order data is touched).
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
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  // 1. pages up
  const home = await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  log('login page 200', home.status() === 200, String(home.status()));
  await sleep(1500);
  log('signed-out /login shows NO banner', (await page.locator("text=You're already signed in").count()) === 0);

  // 2. sign in as the E2E admin persona
  await page.fill('input[type="email"]', ADMIN.email);
  await page.fill('input[type="password"]', ADMIN.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/admin/, { timeout: 25000 });
  log('admin persona lands on /admin', page.url().endsWith('/admin'), page.url());
  await sleep(2000);

  // 3. THE FIX — /login while authenticated must NOT force-redirect
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector("text=You're already signed in", { timeout: 15000 });
  await sleep(1000);
  log('authenticated /login STAYS on /login (no force sign-in)', page.url().includes('/login'), page.url());
  log('banner shows the signed-in email', (await page.locator(`text=${ADMIN.email}`).count()) >= 1);
  log('email prefilled with session credentials', (await page.inputValue('input[type="email"]')) === ADMIN.email);
  log('"Continue as" + "Sign out" buttons present',
    (await page.locator('button:has-text("Continue as")').count()) === 1 &&
    (await page.locator('button:has-text("Sign out")').count()) >= 1);

  // 4. short-viewport sidebar sign out reachable
  await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
  await sleep(2500);
  await page.setViewportSize({ width: 1280, height: 640 });
  await sleep(700);
  const box = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('aside button')].find((x) => x.textContent.includes('Sign out'));
    if (!btn) return null;
    const r = btn.getBoundingClientRect();
    return { bottom: Math.round(r.bottom), vh: innerHeight };
  });
  log('sidebar Sign out IN VIEWPORT at 1280x640', !!box && box.bottom <= box.vh, box ? `bottom ${box.bottom}/${box.vh}` : 'not found');

  // 5. banner sign out clears the session
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector("text=You're already signed in", { timeout: 15000 });
  await page.click('button:has-text("Sign out")');
  await page.waitForURL((u) => u.pathname === '/login', { timeout: 20000 });
  await sleep(1500);
  const me = await page.evaluate(async () => (await fetch('/api/users/me', { cache: 'no-store' })).status);
  log('banner Sign out returns to clean /login, session cleared (me → 401)', me === 401 && (await page.locator("text=You're already signed in").count()) === 0, `me ${me}`);

  // 6. zero page errors
  log('zero page errors on production', errors.length === 0, errors.slice(0, 2).join(' | '));

  await browser.close();
  console.log(`\np58_live: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('LIVE CHECK CRASH:', e); process.exit(1); });
