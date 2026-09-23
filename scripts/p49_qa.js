// Phase 49 QA — Pricing pill: brand navy + white text, ALIGNED with the
// Sign in / Sign up cluster, visible on ALL breakpoints (desktop included).
const { chromium } = require('playwright');

const BASE = 'http://localhost:3000';
let pass = 0, fail = 0;
function log(name, ok, extra) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? `  (${extra})` : ''}`);
  ok ? pass++ : fail++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// same-row check via vertical range overlap
function sameRow(a, b) {
  return a && b ? b.y < a.y + a.height && a.y < b.y + b.height : false;
}

(async () => {
  const browser = await chromium.launch();

  for (const w of [360, 375, 390, 640, 768, 1024, 1440]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await sleep(700);

    // the pill: link to /services containing a button (in the account cluster)
    const pill = page.locator('.sticky a[href="/services"]').filter({ has: page.locator('button') }).first();
    const pillBox = await pill.boundingBox();
    log(`[${w}] Pricing pill visible`, !!pillBox, pillBox ? `x=${Math.round(pillBox.x)} y=${Math.round(pillBox.y)} w=${Math.round(pillBox.width)}` : 'no box');

    // BRAND NAVY bg + white text (computed)
    const btn = pill.locator('button');
    const styles = await btn.evaluate((e) => {
      const cs = getComputedStyle(e);
      return { bg: cs.backgroundColor, color: cs.color, border: cs.borderColor };
    });
    log(`[${w}] pill bg = brand navy #0A192F`, styles.bg === 'rgb(10, 25, 47)', styles.bg);
    log(`[${w}] pill text = white`, styles.color === 'rgb(255, 255, 255)', styles.color);

    // ALIGNMENT: same row as Sign in and Sign up
    const siBox = await page.getByRole('link', { name: /sign in/i }).first().boundingBox();
    const suBox = await page.getByRole('link', { name: /sign up/i }).first().boundingBox();
    log(`[${w}] pill aligned with Sign in`, sameRow(pillBox, siBox), `pillY=${Math.round(pillBox?.y || -1)} siY=${Math.round(siBox?.y || -1)}`);
    log(`[${w}] pill aligned with Sign up`, sameRow(pillBox, suBox));

    // pill is INSIDE the account cluster (same parent as Sign in)
    const sameParent = await page.evaluate(() => {
      const pillBtn = document.querySelector('.sticky a[href="/services"] button');
      const siBtn = document.querySelector('.sticky a[href="/login"] button');
      return pillBtn && siBtn ? pillBtn.closest('div.flex') === siBtn.closest('div.flex') : false;
    });
    log(`[${w}] pill lives in the account cluster (same group as Sign in/up)`, sameParent);

    // cursor + hover feedback class
    const cursor = await btn.evaluate((e) => getComputedStyle(e).cursor);
    log(`[${w}] cursor pointer`, cursor === 'pointer', cursor);
    const btnClass = (await btn.getAttribute('class')) || '';
    log(`[${w}] hover state = navy-600`, btnClass.includes('hover:bg-navy-600'));

    // old desktop text link is GONE (replaced by the pill)
    const txtCount = await page.locator('.sticky a[href="/services"]').filter({ hasText: 'Services & pricing' }).count();
    log(`[${w}] old text link replaced`, txtCount === 0, `count=${txtCount}`);

    // no horizontal overflow
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    log(`[${w}] no horizontal overflow`, overflow <= 0, `delta=${overflow}px`);

    // cluster fits on ONE row of pills (pill/signin/signup mutually aligned already proves it)

    if (w === 375 || w === 1440) {
      await page.screenshot({ path: `work/p49-nav-${w}.png`, clip: { x: 0, y: 0, width: w, height: 170 } });
    }
    if (w === 1440) {
      await pill.hover();
      await sleep(300);
      const hoverBg = await btn.evaluate((e) => getComputedStyle(e).backgroundColor);
      log(`[${w}] hover bg darkens to navy-600`, hoverBg === 'rgb(16, 39, 64)', hoverBg);
      await pill.click();
      await page.waitForURL(`${BASE}/services`, { timeout: 15000 });
      log(`[${w}] pill click lands on /services`, new URL(page.url()).pathname === '/services');
      const pill2 = page.locator('.sticky a[href="/services"]').filter({ has: page.locator('button') }).first();
      log(`[${w}] /services nav shows the pill too`, !!(await pill2.boundingBox()));
    }
    log(`[${w}] no page errors`, errors.length === 0, errors.slice(0, 1).join(''));
    await ctx.close();
  }

  await browser.close();
  console.log(`\n=== ${pass} PASS / ${fail} FAIL ===`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
