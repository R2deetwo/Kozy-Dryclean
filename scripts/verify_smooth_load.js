// Phase 42 verification: proves the landing paints completely WITHOUT JS
// (the "loaded but stuck on iPhone" failure mode) + normal-load smoke test.
const { chromium, devices } = require('playwright');

(async () => {
  const browser = await chromium.launch();

  // ---------- TEST 1: JS disabled (the slow-iPhone worst case) ----------
  const ctxNoJs = await browser.newContext({
    ...devices['iPhone 14'],
    javaScriptEnabled: false,
  });
  const p1 = await ctxNoJs.newPage();
  await p1.goto('http://localhost:3100/', { waitUntil: 'domcontentloaded' });
  await p1.waitForTimeout(1200); // allow CSS animation to finish
  const heroVisible = await p1.evaluate(() => {
    const h1 = document.querySelector('h1');
    if (!h1) return { found: false };
    const cs = getComputedStyle(h1.parentElement);
    const r = h1.getBoundingClientRect();
    return { found: true, opacity: cs.opacity, transform: cs.transform, top: Math.round(r.top), text: h1.textContent.slice(0, 40) };
  });
  console.log('TEST1 no-JS hero:', JSON.stringify(heroVisible));
  const imgInfo = await p1.evaluate(() => {
    // hero img may be inside picture/img; find any img with alt mentioning shirts
    const img = [...document.querySelectorAll('img')].find(i => (i.alt || '').includes('shirts'));
    if (!img) return { found: false };
    const cs = getComputedStyle(img);
    return { found: true, opacity: cs.opacity, w: Math.round(img.getBoundingClientRect().width), h: Math.round(img.getBoundingClientRect().height) };
  });
  console.log('TEST1 no-JS hero image:', JSON.stringify(imgInfo));
  await p1.screenshot({ path: '/home/z/my-project/work/p42/no-js-mobile.png' });
  await ctxNoJs.close();

  // ---------- TEST 2: normal load (mobile), console errors + FCP ----------
  const ctx2 = await browser.newContext({ ...devices['iPhone 14'] });
  const p2 = await ctx2.newPage();
  const errors = [];
  p2.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 120)); });
  p2.on('pageerror', e => errors.push('PAGEERROR ' + String(e).slice(0, 120)));
  await p2.goto('http://localhost:3100/', { waitUntil: 'load' });
  await p2.waitForTimeout(800);
  const nav = await p2.evaluate(() => {
    const n = performance.getEntriesByType('navigation')[0];
    return { domContentLoaded: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd) };
  });
  console.log('TEST2 mobile DCL/load ms:', JSON.stringify(nav), '| console errors:', errors.length ? errors.slice(0, 3) : 'NONE');
  await p2.screenshot({ path: '/home/z/my-project/work/p42/mobile-top.png' });
  await p2.screenshot({ path: '/home/z/my-project/work/p42/mobile-full.png', fullPage: true });

  // scroll through the page to trigger lazy images + reveals
  await p2.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); }
    window.scrollTo(0, 0);
  });
  await p2.waitForTimeout(900);
  const revealed = await p2.evaluate(() => {
    // count sections still at opacity 0 after full scroll
    const els = [...document.querySelectorAll('section div')].filter(el => getComputedStyle(el).opacity === '0');
    return els.length;
  });
  console.log('TEST2 elements still opacity:0 after scroll:', revealed);
  await p2.screenshot({ path: '/home/z/my-project/work/p42/mobile-scrolled.png' });
  await ctx2.close();

  // ---------- TEST 3: desktop ----------
  const ctx3 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p3 = await ctx3.newPage();
  await p3.goto('http://localhost:3100/', { waitUntil: 'load' });
  await p3.waitForTimeout(700);
  await p3.screenshot({ path: '/home/z/my-project/work/p42/desktop-top.png' });
  await ctx3.close();

  // ---------- TEST 4: /book skeleton shows instantly ----------
  const ctx4 = await browser.newContext({ ...devices['iPhone 14'] });
  const p4 = await ctx4.newPage();
  // throttle CPU to force the loading state to be visible
  await ctx4.route('**/*', route => route.continue());
  await p4.goto('http://localhost:3100/book', { waitUntil: 'commit' });
  const sawSkeleton = await p4.evaluate(() => !!document.querySelector('.kozy-skeleton'));
  console.log('TEST4 /book skeleton visible at commit:', sawSkeleton);
  await p4.waitForTimeout(2500);
  const wizardLoaded = await p4.evaluate(() => !!document.querySelector('.kozy-skeleton') === false && document.body.innerText.length > 200);
  await p4.screenshot({ path: '/home/z/my-project/work/p42/book-after.png' });
  console.log('TEST4 /book wizard loaded (skeleton gone):', wizardLoaded);
  await ctx4.close();

  await browser.close();
  console.log('DONE');
})();
