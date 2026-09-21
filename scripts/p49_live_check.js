// Phase 49 LIVE verification on kozycare.ng — navy Pricing pill, aligned,
// on all breakpoints.
const { chromium } = require('playwright');
let pass = 0, fail = 0;
function log(name, ok, extra) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? `  (${extra})` : ''}`);
  ok ? pass++ : fail++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function sameRow(a, b) {
  return a && b ? b.y < a.y + a.height && a.y < b.y + b.height : false;
}

(async () => {
  const html = await fetch('https://kozycare.ng/').then((r) => r.text());
  log('live HTML: navy pill classes present', /a[^>]*href="\/services"[^>]*>\s*<button[^>]*bg-navy text-white/.test(html.replace(/\n/g, '')) || (html.includes('bg-navy text-white hover:bg-navy-600') && html.includes('href="/services"')));
  log('live HTML: old text link gone', !html.includes('Services &amp; pricing'));

  const browser = await chromium.launch();
  for (const w of [375, 1440]) {
    const page = await browser.newContext({ viewport: { width: w, height: 900 } }).then((c) => c.newPage());
    await page.goto('https://kozycare.ng/', { waitUntil: 'networkidle' });
    await sleep(1500);
    const pill = page.locator('.sticky a[href="/services"]').filter({ has: page.locator('button') }).first();
    const pillBox = await pill.boundingBox();
    log(`live [${w}]: pill visible`, !!pillBox, pillBox ? `y=${Math.round(pillBox.y)}` : 'no box');
    const styles = await pill.locator('button').evaluate((e) => {
      const cs = getComputedStyle(e);
      return { bg: cs.backgroundColor, color: cs.color };
    });
    log(`live [${w}]: bg = brand navy`, styles.bg === 'rgb(10, 25, 47)', styles.bg);
    log(`live [${w}]: text = white`, styles.color === 'rgb(255, 255, 255)', styles.color);
    const siBox = await page.getByRole('link', { name: /sign in/i }).first().boundingBox();
    log(`live [${w}]: aligned with Sign in`, sameRow(pillBox, siBox), `pillY=${Math.round(pillBox?.y || -1)} siY=${Math.round(siBox?.y || -1)}`);
    if (w === 375) {
      await pill.click();
      await page.waitForURL('https://kozycare.ng/services', { timeout: 20000 });
      log('live [375]: click lands on /services', new URL(page.url()).pathname === '/services');
    }
    if (w === 1440) {
      await page.screenshot({ path: 'work/p49-live-nav-1440.png', clip: { x: 0, y: 0, width: 1440, height: 90 } });
    }
    await page.close();
  }
  await browser.close();
  console.log(`\n=== ${pass} PASS / ${fail} FAIL ===`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
