// Phase 58 QA — admin sign-out reachability + login-page account switching.
// Verifies on the dev server (scripts/p58_run_qa.sh boots it):
//   A. FORCE-LOGIN FIX (the owner's complaint): visiting /login while
//      authenticated STAYS on /login — banner "You're already signed in",
//      email prefilled from the session, form usable for OTHER credentials.
//   B. ACCOUNT SWITCHING: signing in with a different set of credentials
//      while authenticated replaces the session and routes by the NEW role.
//   C. ?email= LOGIN LINKS (rider play) win over the session prefill.
//   D. SIDEBAR SIGN OUT at every viewport height — the 13-tab admin nav now
//      scrolls internally so Live strip + Change password + Sign out stay
//      pinned (was pushed below the fixed h-screen sidebar on short screens).
//   E. Sign out actually clears the session (console button AND login-page
//      banner button); mobile header sign-out still present.
// Run: node scripts/p58_qa.js
const { chromium } = require('playwright');

const BASE = 'http://localhost:3000';
const ADMIN = { email: 'admin40@kozy-test.example', password: 'Phase40!Admin2026' };
const CUSTOMER = { email: 'customer40@kozy-test.example', password: 'Phase40!Customer2026' };

let pass = 0, fail = 0;
function log(name, ok, extra) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra !== undefined ? `  (${extra})` : ''}`);
  ok ? pass++ : fail++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function signIn(page, creds) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"]', creds.email);
  await page.fill('input[type="password"]', creds.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/admin|driver|portal/, { timeout: 20000 });
}

async function meStatus(page) {
  const res = await page.evaluate(async () => {
    const r = await fetch('/api/users/me', { cache: 'no-store' });
    return { status: r.status, email: r.ok ? (await r.json())?.user?.email : null };
  });
  return res;
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  // ---------- 1. Fresh (signed-out) login regression ----------
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await sleep(1200); // let useSession resolve — must NOT redirect and must NOT banner
  log('signed-out /login stays on /login', page.url().includes('/login'), page.url());
  log('signed-out /login shows NO banner', (await page.locator("text=You're already signed in").count()) === 0);
  log('signed-out /login email field empty', (await page.inputValue('input[type="email"]')) === '');

  await signIn(page, ADMIN);
  log('admin sign-in lands on /admin', page.url().endsWith('/admin'), page.url());

  // ---------- 2. THE BUG — /login while authenticated used to force-redirect ----------
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector("text=You're already signed in", { timeout: 10000 });
  await sleep(800);
  log('authenticated /login STAYS on /login (no force sign-in)', page.url().includes('/login'), page.url());
  log('banner states the signed-in email', (await page.locator(`text=${ADMIN.email}`).count()) >= 1);
  log('email field prefilled with session credentials', (await page.inputValue('input[type="email"]')) === ADMIN.email);
  log('password field left blank', (await page.inputValue('input[type="password"]')) === '');
  log('"Continue as" button present', (await page.locator('button:has-text("Continue as")').count()) === 1);
  log('banner Sign out button present', (await page.locator('button:has-text("Sign out")').count()) >= 1);

  // ---------- 3. Continue button routes by role ----------
  await page.click('button:has-text("Continue as")');
  await page.waitForURL(/admin|driver|portal/, { timeout: 10000 });
  log('"Continue as Admin" routes to /admin', page.url().endsWith('/admin'), page.url());

  // ---------- 4. Sidebar sign out reachable at a SHORT viewport (the owner's screen) ----------
  await page.setViewportSize({ width: 1280, height: 640 });
  await sleep(600);
  const sidebarBox = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('aside button')].find((x) => x.textContent.includes('Sign out'));
    if (!btn) return null;
    const r = btn.getBoundingClientRect();
    const aside = document.querySelector('aside');
    const nav = aside.querySelector('nav');
    return {
      top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight,
      navScrolls: nav.scrollHeight > nav.clientHeight,
      changePwVisible: [...document.querySelectorAll('aside button')].some((x) => x.textContent.includes('Change password') && x.getBoundingClientRect().bottom <= innerHeight),
    };
  });
  log('sidebar Sign out IN VIEWPORT at 1280x640', !!sidebarBox && sidebarBox.bottom <= sidebarBox.vh,
    sidebarBox ? `bottom ${sidebarBox.bottom}/${sidebarBox.vh}` : 'button not found');
  log('nav scrolls internally (min-h-0 fix)', !!sidebarBox && sidebarBox.navScrolls);
  log('Change password also visible at 640px', !!sidebarBox && sidebarBox.changePwVisible);

  await page.setViewportSize({ width: 1440, height: 900 });
  await sleep(400);
  const tall = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('aside button')].find((x) => x.textContent.includes('Sign out'));
    return btn ? btn.getBoundingClientRect().bottom <= innerHeight : false;
  });
  log('sidebar Sign out still visible at 1440x900', tall);

  // ---------- 5. Console Sign out clears the session ----------
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('aside button')].find((x) => x.textContent.includes('Sign out'));
    btn.click();
  });
  await page.waitForURL((u) => !u.pathname.startsWith('/admin'), { timeout: 15000 });
  await sleep(1000);
  const afterConsole = await meStatus(page);
  log('console Sign out lands off /admin', !page.url().startsWith(`${BASE}/admin`), page.url());
  log('console Sign out clears the session (me → 401)', afterConsole.status === 401, `status ${afterConsole.status}`);

  // ---------- 6. THE ASK — sign in with a DIFFERENT set of credentials ----------
  await signIn(page, ADMIN);
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector("text=You're already signed in", { timeout: 10000 });
  await page.fill('input[type="email"]', CUSTOMER.email); // overwrite the prefilled admin email
  await page.fill('input[type="password"]', CUSTOMER.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal/, { timeout: 20000 });
  const switched = await meStatus(page);
  log('switch-account sign-in routes to the NEW role portal (/portal)', page.url().endsWith('/portal'), page.url());
  log('session is now the CUSTOMER account', switched.email === CUSTOMER.email, `me → ${switched.email}`);

  // ---------- 7. ?email= login links (rider play) win over session prefill ----------
  await page.goto(`${BASE}/login?email=riderplay@woosh.dpdns.org`, { waitUntil: 'domcontentloaded' });
  await sleep(1200);
  log('login link ?email= prefills THAT email (not the session)', (await page.inputValue('input[type="email"]')) === 'riderplay@woosh.dpdns.org');
  log('banner still explains the active session', (await page.locator(`text=${CUSTOMER.email}`).count()) >= 1);
  await page.fill('input[type="password"]', 'WrongPassword!1');
  await page.click('button[type="submit"]');
  await page.waitForSelector('text=Invalid email or password', { timeout: 10000 });
  log('form still submits while authenticated (bad password → clear error)', true);
  log('stayed on /login through the failed attempt', page.url().includes('/login'), page.url());

  // ---------- 8. Banner Sign out clears the session and stays on /login ----------
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector("text=You're already signed in", { timeout: 10000 });
  await page.click('button:has-text("Sign out")');
  await page.waitForURL((u) => u.pathname === '/login', { timeout: 15000 });
  await sleep(1500);
  const afterBanner = await meStatus(page);
  log('banner Sign out returns to a clean /login', page.url().endsWith('/login') && (await page.locator("text=You're already signed in").count()) === 0);
  log('banner Sign out clears the session (me → 401)', afterBanner.status === 401, `status ${afterBanner.status}`);
  log('email field empty again after sign out', (await page.inputValue('input[type="email"]')) === '');

  // ---------- 9. Mobile header sign-out regression (phase 33) ----------
  await signIn(page, ADMIN);
  await page.setViewportSize({ width: 390, height: 844 });
  await sleep(800);
  const mobileBtn = await page.evaluate(() => {
    const b = document.querySelector('button[aria-label="Sign out"]');
    return b ? b.getBoundingClientRect().bottom <= innerHeight : false;
  });
  log('mobile header sign-out present and visible', mobileBtn);

  // ---------- 10. Zero page errors ----------
  log('zero page errors across the whole battery', errors.length === 0, errors.slice(0, 3).join(' | '));

  await browser.close();
  console.log(`\np58_qa: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error('BATTERY CRASH:', e);
  process.exit(1);
});
