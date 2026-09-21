// Phase 46 QA — home page tightening: structural checks + screenshots.
const { chromium } = require('playwright');

const BASE = 'http://localhost:3000';
let pass = 0, fail = 0;
function log(name, ok, extra) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? `  (${extra})` : ''}`);
  ok ? pass++ : fail++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch();

  // ---------- Desktop ----------
  const desk = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const dp = await desk.newPage();
  const deskErrors = [];
  dp.on('console', (m) => m.type() === 'error' && deskErrors.push(m.text()));
  dp.on('pageerror', (e) => deskErrors.push(String(e)));

  await dp.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await sleep(1200);

  const dh = await dp.evaluate(() => document.body.scrollHeight);
  log('desktop renders', dh > 2000, `total ${dh}px`);
  log('no console errors', deskErrors.length === 0, deskErrors.slice(0, 2).join(' | '));

  // hero intact
  log('hero h1', (await dp.locator('h1').first().textContent()).includes('Uncompromising'));
  log('hero Book button', (await dp.getByRole('button', { name: /book pickup now/i }).count()) === 1);
  log('hero Track button', (await dp.getByRole('button', { name: /track my orders/i }).count()) === 1);

  // trust bar + offers
  for (const t of ['4.9 / 5.0', '46 hours', '12,400+ Pieces']) {
    log(`trust bar: ${t}`, (await dp.locator(`text=${t}`).count()) > 0);
  }
  for (const t of ['off every online order', 'off your first order', 'off every order with pictures']) {
    log(`offer: ${t}`, (await dp.locator(`text=${t}`).count()) > 0);
  }

  // services summary — 6 cards with prices
  for (const t of ["Men's dry cleaning", "Women's dry cleaning", 'Home & linens', 'Shoe care & restoration', 'Alterations & repairs', 'Corporate & hotels']) {
    log(`service card: ${t}`, (await dp.locator(`text=${t}`).count()) > 0);
  }
  log('service CTA to /services', (await dp.locator('a:has-text("See all services & pricing")').count()) === 1);

  // how it works
  for (const t of ['01 · Request a pickup', '02 · We collect & treat', '03 · Pristine return']) {
    log(`step: ${t}`, (await dp.locator(`text=${t}`).count()) > 0);
  }

  // testimonials + guarantee + lifestyle band
  log('testimonials heading', (await dp.locator('text=Loved by Lagos.').count()) > 0);
  log('guarantee heading', (await dp.locator('text=Return-as-Received Guarantee').count()) > 0);
  log('guarantee terms deep-link', (await dp.locator('a:has-text("Read the full guarantee terms")').getAttribute('href')) === '/terms#guarantee');
  log('eligible-order rule kept', (await dp.locator('text=at least 2 garments').count()) > 0);
  log('lifestyle band heading', (await dp.locator('text=Care for everything you wear.').count()) > 0);
  log('lifestyle CTA', (await dp.getByRole('button', { name: /book your pickup/i }).count()) === 1);
  log('lifestyle photo is background', (await dp.locator('section:has-text("Care for everything") img[role="presentation"]').count()) === 1);

  // footer
  log('footer newsletter form', (await dp.locator('footer input[type="email"]').count()) === 1);
  log('footer guarantee link', (await dp.locator('footer a[href="/#guarantee"]').count()) === 1);
  log('footer terms link', (await dp.locator('footer a[href="/terms"]').count()) === 1);
  log('no horizontal overflow', await dp.evaluate(() => document.documentElement.scrollWidth === document.documentElement.clientWidth));

  // sticky CTA hidden on desktop
  const ctaDesk = await dp.locator('.kozy-sticky-cta').evaluate((el) => getComputedStyle(el).display);
  log('sticky CTA hidden on desktop', ctaDesk === 'none', ctaDesk);

  await dp.screenshot({ path: 'work/p46-home-desk-full.png', fullPage: true });
  await dp.screenshot({ path: 'work/p46-home-desk-fold.png' });

  // /terms#guarantee deep-link lands on section 5
  const tp = await desk.newPage();
  await tp.goto(`${BASE}/terms#guarantee`, { waitUntil: 'networkidle' });
  await sleep(400);
  const anchorOk = await tp.evaluate(() => {
    const el = document.getElementById('guarantee');
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.top > -80 && r.top < 250;
  });
  log('/terms#guarantee lands on section 5', anchorOk);
  await desk.close();

  // ---------- Mobile ----------
  const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const mp = await mob.newPage();
  const mobErrors = [];
  mp.on('console', (m) => m.type() === 'error' && mobErrors.push(m.text()));
  mp.on('pageerror', (e) => mobErrors.push(String(e)));

  await mp.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await sleep(1500);

  const mh = await mp.evaluate(() => document.body.scrollHeight);
  log('mobile renders', mh > 3000, `total ${mh}px`);
  log('mobile no console errors', mobErrors.length === 0, mobErrors.slice(0, 2).join(' | '));
  log('mobile no horizontal overflow', await mp.evaluate(() => document.documentElement.scrollWidth === document.documentElement.clientWidth));

  // sticky CTA: hidden at top, appears after scroll
  const ctaHiddenAtTop = await mp.evaluate(() => {
    const el = document.querySelector('.kozy-sticky-cta');
    return el && el.classList.contains('translate-y-full');
  });
  log('sticky CTA hidden at top (mobile)', !!ctaHiddenAtTop);
  await mp.evaluate(() => window.scrollTo(0, 900));
  await sleep(600);
  const ctaShown = await mp.evaluate(() => {
    const el = document.querySelector('.kozy-sticky-cta');
    return el && el.classList.contains('translate-y-0');
  });
  log('sticky CTA appears after scroll (mobile)', !!ctaShown);

  // offers 2-col on mobile
  const offerCols = await mp.evaluate(() => {
    const grid = document.querySelector('section.border-gold-200 .grid');
    return grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').length : 0;
  });
  log('offers 2-col on mobile', offerCols === 2, `${offerCols} cols`);

  // services 2-col on mobile
  const svcCols = await mp.evaluate(() => {
    const grid = document.querySelector('#services .grid');
    return grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').length : 0;
  });
  log('services 2-col on mobile', svcCols === 2, `${svcCols} cols`);

  await mp.screenshot({ path: 'work/p46-home-mob-full.png', fullPage: true });
  // fold crop
  await mp.evaluate(() => window.scrollTo(0, 0));
  await sleep(300);
  await mp.screenshot({ path: 'work/p46-home-mob-fold.png' });
  // lifestyle band crop
  await mp.evaluate(() => {
    const el = [...document.querySelectorAll('h2')].find((h) => h.textContent.includes('Care for everything'));
    el.scrollIntoView({ block: 'center' });
  });
  await sleep(700);
  await mp.screenshot({ path: 'work/p46-band-mob.png' });
  await mob.close();

  await browser.close();
  console.log(`\nRESULT: ${pass} pass, ${fail} fail`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
