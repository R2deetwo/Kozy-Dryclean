// Phase 47 QA — "finger pointer" affordance fix (client report: hovering the
// header logo shows no pointer cursor, so laptop users can't tell it goes home).
// Checks: logo is a real <a> with tooltip; pointer cursor on logo, nav links,
// nav buttons, hero CTAs (global Tailwind-v4 button-cursor restoration);
// /services logo click lands home CLIENT-SIDE (no full reload); /feedback logo.
const { chromium } = require('playwright');

const BASE = 'http://localhost:3000';
let pass = 0, fail = 0;
function log(name, ok, extra) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? `  (${extra})` : ''}`);
  ok ? pass++ : fail++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cursorOf(page, locator) {
  const el = await locator.first().elementHandle();
  return el ? await page.evaluate((e) => getComputedStyle(e).cursor, el) : '(missing)';
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  // ============ HOME ============
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await sleep(800);

  // The logo: now a real anchor with tooltip + accessible label
  const logo = page.locator('header, .sticky').first().getByText('Kozy Care').first();
  // locate via the mark's alt text — most robust: the anchor containing the mark
  const logoA = page.locator('a:has(img[alt="Kozy Care mark"])').first();
  const logoTag = await logoA.evaluate((e) => e.tagName.toLowerCase());
  log('logo renders as <a> (real link)', logoTag === 'a', `tag=${logoTag}`);
  const logoHref = await logoA.getAttribute('href');
  log('logo href points home', logoHref === '/', `href=${logoHref}`);
  const logoTitle = await logoA.getAttribute('title');
  log('logo tooltip present', logoTitle === 'Back to the home page', `title="${logoTitle}"`);
  const logoAria = await logoA.getAttribute('aria-label');
  log('logo aria-label', logoAria === 'Back to the home page', `aria="${logoAria}"`);

  await logoA.hover();
  log('CURSOR: logo = pointer', (await cursorOf(page, logoA)) === 'pointer', await cursorOf(page, logoA));

  // Parity with the client's reference: "Services & pricing" link
  const svc = page.getByRole('link', { name: /services & pricing/i }).first();
  await svc.hover();
  log('CURSOR: Services & pricing = pointer', (await cursorOf(page, svc)) === 'pointer', await cursorOf(page, svc));

  // Nav buttons (shadcn Button inside Link — the inner <button> is the hover target)
  const signin = page.getByRole('link', { name: /sign in/i }).first();
  await signin.hover();
  log('CURSOR: Sign in = pointer', (await cursorOf(page, signin)) === 'pointer', await cursorOf(page, signin));
  const signup = page.getByRole('link', { name: /sign up/i }).first();
  await signup.hover();
  log('CURSOR: Sign up = pointer', (await cursorOf(page, signup)) === 'pointer', await cursorOf(page, signup));

  // Hero CTAs — the global button-cursor fix (Tailwind v4 ships arrow cursor)
  const bookBtn = page.getByRole('button', { name: /book pickup now/i }).first();
  await bookBtn.hover();
  log('CURSOR: hero Book Pickup Now = pointer', (await cursorOf(page, bookBtn)) === 'pointer', await cursorOf(page, bookBtn));
  const trackBtn = page.getByRole('button', { name: /track my orders/i }).first();
  await trackBtn.hover();
  log('CURSOR: hero Track my orders = pointer', (await cursorOf(page, trackBtn)) === 'pointer', await cursorOf(page, trackBtn));

  // Control — footer logo is decorative (plain div): must NOT show the finger
  const footerLogo = page.locator('footer img[alt="Kozy Care mark"]').first();
  const fCur = await cursorOf(page, footerLogo);
  log('CURSOR: footer logo stays non-pointer (no false affordance)', fCur !== 'pointer', fCur);

  log('home: no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));

  // ============ /services -> click logo ============
  await page.goto(`${BASE}/services`, { waitUntil: 'networkidle' });
  await sleep(600);
  const logoA2 = page.locator('a:has(img[alt="Kozy Care mark"])').first();
  await logoA2.hover();
  log('CURSOR: /services logo = pointer', (await cursorOf(page, logoA2)) === 'pointer', await cursorOf(page, logoA2));

  // Client-side navigation proof: same document marker survives the click
  await page.evaluate(() => { window.__p47marker = 'alive'; });
  await logoA2.click();
  await page.waitForURL(`${BASE}/`, { timeout: 15000 });
  await sleep(600);
  const marker = await page.evaluate(() => window.__p47marker);
  log('logo click lands on home', new URL(page.url()).pathname === '/', page.url());
  log('client-side nav (no full reload)', marker === 'alive', `marker=${marker}`);
  const h1 = await page.locator('h1').first().textContent();
  log('home hero rendered after logo click', (h1 || '').includes('Uncompromising'), h1?.slice(0, 40));

  // ============ /feedback ============
  await page.goto(`${BASE}/feedback`, { waitUntil: 'networkidle' });
  await sleep(600);
  const fbLogo = page.locator('a:has(img[alt="Kozy Care mark"])').first();
  const fbTag = await fbLogo.evaluate((e) => e.tagName.toLowerCase());
  log('/feedback logo is <a> (no nested button-in-link)', fbTag === 'a', `tag=${fbTag}`);
  const fbTitle = await fbLogo.getAttribute('title');
  log('/feedback logo tooltip', !!fbTitle, `title="${fbTitle}"`);
  await fbLogo.hover();
  log('CURSOR: /feedback logo = pointer', (await cursorOf(page, fbLogo)) === 'pointer', await cursorOf(page, fbLogo));

  // Visual evidence: nav bar crop with the logo area
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await sleep(400);
  await page.locator('a:has(img[alt="Kozy Care mark"])').first().hover();
  await sleep(200);
  await page.screenshot({ path: 'work/p47-nav-hover.png', clip: { x: 0, y: 0, width: 1440, height: 90 } });

  await browser.close();
  console.log(`\n=== ${pass} PASS / ${fail} FAIL ===`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
