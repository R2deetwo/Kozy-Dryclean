// Task 85 — probe the map iframe load state in headed vs headless contexts
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
  const netlog = [];
  page.on('requestfailed', (r) => netlog.push(`FAIL ${r.url().slice(0, 90)} :: ${r.failure()?.errorText}`));
  page.on('response', (r) => { if (r.url().includes('google.com/maps')) netlog.push(`${r.status()} ${r.url().slice(0, 90)}`); });
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(6000); // generous wait for lazy iframe
  await page.evaluate(() => document.querySelector('footer iframe[src*="google.com/maps"]')?.scrollIntoView({block:'center'}));
  await page.waitForTimeout(4000);
  // Playwright frame tree: did the iframe actually navigate?
  const frames = page.frames().map((fr) => `${fr.name() || '(anon)'} -> ${fr.url().slice(0, 70)}`);
  console.log('FRAME TREE:'); frames.forEach((l) => console.log('  ', l));
  const state = await page.evaluate(() => {
    const f = document.querySelector('footer iframe[src*="google.com/maps"]');
    if (!f) return { found: false };
    let inner = 'unknown';
    try {
      inner = f.contentDocument ? (f.contentDocument.body?.innerText || 'empty-body').slice(0, 60) : 'cross-origin-blocked';
    } catch (e) { inner = 'cross-origin-exception'; }
    const r = f.getBoundingClientRect();
    return { found: true, src: f.src.slice(0, 80), rect: { w: Math.round(r.width), h: Math.round(r.height) }, inner };
  });
  console.log('iframe state:', JSON.stringify(state, null, 2));
  console.log('network log:'); netlog.slice(0, 12).forEach((l) => console.log('  ', l));
  const f = page.locator('footer iframe[src*="google.com/maps"]');
  await f.screenshot({ path: '/home/z/my-project/work/t85-map-iframe.png' }).catch((e) => console.log('shot fail', e.message));
  await browser.close();
})();
