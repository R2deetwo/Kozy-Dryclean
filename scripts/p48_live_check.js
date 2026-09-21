// Phase 48 LIVE verification on kozycare.ng — Pricing pill (mobile) + hero cleanup.
const { chromium } = require('playwright');
let pass = 0, fail = 0;
function log(name, ok, extra) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? `  (${extra})` : ''}`);
  ok ? pass++ : fail++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  // HTML checks (deployment propagation)
  const html = await fetch('https://kozycare.ng/').then((r) => r.text());
  const nav = html.slice(html.indexOf('sticky'), html.indexOf('sticky') + 1500);
  const pillLink = /<a[^>]*class="[^"]*sm:hidden[^"]*"[^>]*>/.test(nav) || nav.includes('sm:hidden');
  log('live HTML: mobile pill link present in nav', pillLink);
  log('live HTML: pill text "Pricing" present', html.includes('>Pricing<'));
  log('live HTML: floating quote card gone', !html.includes('My suits have never looked better.'));
  log('live HTML: atelier caption kept', html.includes('Atelier-grade finishing'));
  log('live HTML: desktop text link kept', html.includes('Services &amp; pricing'));

  // Browser checks
  const browser = await chromium.launch();

  // mobile 375
  const m = await browser.newContext({ viewport: { width: 375, height: 800 } }).then((c) => c.newPage());
  await m.goto('https://kozycare.ng/', { waitUntil: 'networkidle' });
  await sleep(1200);
  const pill = m.locator('.sticky a[href="/services"]').filter({ has: m.locator('button') }).first();
  const pillBox = await pill.boundingBox();
  log('live [375]: Pricing pill visible', !!pillBox, pillBox ? `x=${pillBox.x} w=${pillBox.width}` : 'no box');
  const pillBtn = pill.locator('button');
  const pillCursor = await pillBtn.evaluate((e) => getComputedStyle(e).cursor);
  log('live [375]: pill cursor pointer', pillCursor === 'pointer', pillCursor);
  log('live [375]: quote card gone', (await m.locator('text=My suits have never looked better.').count()) === 0);
  log('live [375]: atelier caption kept', (await m.locator('text=Atelier-grade finishing').count()) === 1);
  await m.screenshot({ path: 'work/p48-live-nav-375.png', clip: { x: 0, y: 0, width: 375, height: 170 } });
  // pill click -> /services
  await pill.click();
  await m.waitForURL('https://kozycare.ng/services', { timeout: 20000 });
  log('live [375]: pill click lands on /services', new URL(m.url()).pathname === '/services');

  // desktop 1440
  const d = await browser.newContext({ viewport: { width: 1440, height: 1000 } }).then((c) => c.newPage());
  await d.goto('https://kozycare.ng/', { waitUntil: 'networkidle' });
  await sleep(1200);
  const pillD = await d.locator('.sticky a[href="/services"]').filter({ has: d.locator('button') }).first().boundingBox();
  log('live [1440]: Pricing pill hidden on desktop', !pillD);
  const txt = await d.getByRole('link', { name: /services & pricing/i }).first().boundingBox();
  log('live [1440]: desktop text link visible', !!txt);
  log('live [1440]: quote card gone', (await d.locator('text=My suits have never looked better.').count()) === 0);
  log('live [1440]: atelier caption kept', (await d.locator('text=Atelier-grade finishing').count()) === 1);
  // hero corner evidence
  const heroImg = d.locator('img[alt="Pristine freshly pressed white shirts on premium wooden hangers"]').first();
  const box = await heroImg.boundingBox();
  if (box) {
    await d.screenshot({
      path: 'work/p48-live-hero-corner.png',
      clip: { x: Math.max(0, box.x - 20), y: Math.max(0, box.y - 10), width: Math.min(box.width + 40, 1440 - box.x), height: box.height + 30 },
    });
    log('live [1440]: hero corner screenshot captured', true);
  }

  await browser.close();
  console.log(`\n=== ${pass} PASS / ${fail} FAIL ===`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
