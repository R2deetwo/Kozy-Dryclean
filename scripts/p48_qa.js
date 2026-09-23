// Phase 48 QA — (1) mobile "Pricing" pill in PublicNav (desktop text link
// unchanged); (2) hero floating quote card removed (atelier caption kept).
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

  // ================= MOBILE (360 / 375 / 390) =================
  for (const w of [360, 375, 390]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 800 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await sleep(700);

    // Pricing pill: exists, VISIBLE (has a box), links /services
    const pill = page.locator('nav, .sticky').first().getByRole('link', { name: /^pricing$/i }).first();
    // more robust: the sm:hidden link to /services containing a button
    const pillLink = page.locator('.sticky a[href="/services"]').filter({ has: page.locator('button') }).first();
    const pillBox = await pillLink.boundingBox();
    log(`[${w}] Pricing pill visible in nav`, !!pillBox, pillBox ? `x=${pillBox.x} w=${pillBox.width}` : 'no box');
    const pillRow = pillBox && pillBox.y < 60;
    log(`[${w}] pill sits on the logo row (slot of the desktop link)`, !!pillRow, `y=${pillBox?.y}`);
    const pillBtn = pillLink.locator('button');
    log(`[${w}] pill is a rounded-full outline button`, (await pillBtn.getAttribute('class') || '').includes('rounded-full'));
    const pillCursor = await pillBtn.evaluate((e) => getComputedStyle(e).cursor);
    log(`[${w}] CURSOR: Pricing pill = pointer`, pillCursor === 'pointer', pillCursor);

    // Sign in / Sign up still present, row 2
    const si = await page.getByRole('link', { name: /sign in/i }).first().boundingBox();
    const su = await page.getByRole('link', { name: /sign up/i }).first().boundingBox();
    log(`[${w}] Sign in / Sign up still in nav`, !!si && !!su);

    // no horizontal overflow introduced
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    log(`[${w}] no horizontal overflow`, overflow <= 0, `delta=${overflow}px`);

    // quote card GONE, atelier caption kept, real social proof kept
    log(`[${w}] floating quote card removed`, (await page.locator('text=My suits have never looked better.').count()) === 0);
    log(`[${w}] atelier caption kept`, (await page.locator('text=Atelier-grade finishing').count()) === 1);
    log(`[${w}] trust bar 4.9/5.0 kept`, (await page.locator('text=4.9 / 5.0').count()) > 0);
    // testimonials carousel renders after /api/reviews resolves — wait for it
    const tHeading = page.locator('#testimonials h2', { hasText: 'Loved by Lagos' });
    try {
      await tHeading.waitFor({ state: 'visible', timeout: 8000 });
      log(`[${w}] testimonials section kept`, true);
    } catch {
      log(`[${w}] testimonials section kept`, false, 'heading not visible within 8s');
    }
    log(`[${w}] no page errors`, errors.length === 0, errors.slice(0, 1).join(''));

    if (w === 375) {
      // pill click navigates to /services
      await pillLink.click();
      await page.waitForURL(`${BASE}/services`, { timeout: 15000 });
      log(`[${w}] pill click lands on /services`, new URL(page.url()).pathname === '/services');
      // nav on /services has the pill too (consistent with desktop self-link)
      const pill2 = page.locator('.sticky a[href="/services"]').filter({ has: page.locator('button') }).first();
      log(`[${w}] /services nav shows the pill too`, !!(await pill2.boundingBox()));
      await page.screenshot({ path: 'work/p48-after-nav-375.png', clip: { x: 0, y: 0, width: 375, height: 170 } });
    }
    await ctx.close();
  }

  // ================= TABLET BOUNDARY (640 = sm) =================
  {
    const ctx = await browser.newContext({ viewport: { width: 640, height: 800 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await sleep(600);
    const pillBox = await page.locator('.sticky a[href="/services"]').filter({ has: page.locator('button') }).first().boundingBox();
    const txtBox = await page.locator('.sticky a[href="/services"]').filter({ hasText: 'Services & pricing' }).first().boundingBox();
    log('[640] pill hidden at sm (desktop takes over)', !pillBox);
    log('[640] text link visible at sm', !!txtBox);
    await ctx.close();
  }

  // ================= DESKTOP (1440) =================
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await sleep(800);
    const pillBox = await page.locator('.sticky a[href="/services"]').filter({ has: page.locator('button') }).first().boundingBox();
    log('[1440] Pricing pill hidden on desktop (owner: unchanged)', !pillBox);
    const txt = page.getByRole('link', { name: /services & pricing/i }).first();
    log('[1440] text link "Services & pricing" visible', !!(await txt.boundingBox()));
    // single-row nav, no wrap (compare vertical RANGE overlap, not exact y —
    // items-center gives a 32px button a 4px offset inside the 40px row)
    const logoB = await page.locator('a:has(img[alt="Kozy Care mark"])').first().boundingBox();
    const siB = await page.getByRole('link', { name: /sign in/i }).first().boundingBox();
    const sameRow = logoB && siB ? siB.y < logoB.y + logoB.height && logoB.y < siB.y + siB.height : false;
    log('[1440] desktop nav stays one row', sameRow, `logoY=${logoB?.y} siY=${siB?.y}`);
    // hero: quote card gone, caption kept
    log('[1440] quote card removed', (await page.locator('text=My suits have never looked better.').count()) === 0);
    log('[1440] atelier caption kept', (await page.locator('text=Atelier-grade finishing').count()) === 1);
    // hero image corner screenshot (the client's flagged area, now clean).
    // NOTE: the card div's tokens are h-[360px] sm:h-[420px] — the h-[420px]
    // token does NOT exist in the class attribute; anchor on the hero <img>.
    const heroImg = page.locator('img[alt="Pristine freshly pressed white shirts on premium wooden hangers"]').first();
    const box = await heroImg.boundingBox();
    if (box) {
      await page.screenshot({
        path: 'work/p48-after-hero-corner.png',
        clip: { x: Math.max(0, box.x - 20), y: Math.max(0, box.y - 10), width: Math.min(box.width + 40, 1440 - box.x), height: box.height + 30 },
      });
    }
    // hero page height sanity (quote card removal should not shrink desktop much)
    const h = await page.evaluate(() => document.body.scrollHeight);
    log('[1440] home renders fully', h > 3000, `${h}px`);
    await ctx.close();
  }

  await browser.close();
  console.log(`\n=== ${pass} PASS / ${fail} FAIL ===`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
