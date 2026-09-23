// Phase 48 pre-work — measure current mobile nav geometry + capture the
// hero-corner overlap the client flagged (before any changes).
const { chromium } = require('playwright');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch();

  // ---------- Desktop: the hero-corner overlap evidence ----------
  const desk = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const dp = await desk.newPage();
  await dp.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await sleep(800);
  // the hero image card + its floating quote card
  const imgCard = dp.locator('div.relative.h-\\[360px\\], div.relative.h-\\[420px\\]').first();
  const box = await imgCard.boundingBox();
  if (box) {
    await dp.screenshot({
      path: 'work/p48-before-hero-overlap.png',
      clip: { x: Math.max(0, box.x - 30), y: Math.max(0, box.y - 10), width: box.width + 60, height: box.height + 50 },
    });
    console.log('hero image card at', JSON.stringify(box));
  }
  // quote card geometry vs atelier caption geometry
  const quote = dp.locator('text=My suits have never looked better.').first();
  const atelier = dp.locator('text=Atelier-grade finishing').first();
  const qb = await quote.boundingBox();
  const ab = await atelier.boundingBox();
  console.log('quote card:', JSON.stringify(qb));
  console.log('atelier caption:', JSON.stringify(ab));
  if (qb && ab) {
    const overlap = !(qb.x + qb.width < ab.x || ab.x + ab.width < qb.x || qb.y + qb.height < ab.y || ab.y + ab.height < qb.y);
    console.log('OVERLAP between quote card and atelier caption:', overlap);
  }

  // ---------- Mobile: nav geometry ----------
  for (const w of [375, 390, 360]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 800 } });
    const page = await ctx.newPage();
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
    await sleep(600);
    const nav = page.locator('.sticky.top-0').first();
    const navBox = await nav.boundingBox();
    const logo = page.locator('a:has(img[alt="Kozy Care mark"])').first();
    const logoBox = await logo.boundingBox();
    const signin = page.getByRole('link', { name: /sign in/i }).first();
    const siBox = await signin.boundingBox();
    const signup = page.getByRole('link', { name: /sign up/i }).first();
    const suBox = await signup.boundingBox();
    const svcLink = page.getByRole('link', { name: /services & pricing/i }).first();
    const svcCount = await svcLink.count();
    const svcBox = svcCount ? await svcLink.boundingBox() : null;
    const wrapped = siBox && logoBox ? siBox.y > logoBox.y + 5 : 'n/a';
    console.log(`\n=== viewport ${w}px ===`);
    console.log('nav height:', navBox?.height, 'logo:', JSON.stringify({ x: logoBox?.x, w: logoBox?.width }));
    console.log('sign-in:', JSON.stringify(siBox && { x: siBox.x, y: siBox.y, w: siBox.width }));
    console.log('sign-up:', JSON.stringify(suBox && { x: suBox.x, y: suBox.y, w: suBox.width }));
    console.log('svc&pricing link count:', svcCount, svcBox ? JSON.stringify({ x: svcBox.x, w: svcBox.width }) : '');
    console.log('buttons WRAPPED below logo:', wrapped);
    await page.screenshot({ path: `work/p48-before-nav-${w}.png`, clip: { x: 0, y: 0, width: w, height: 170 } });
    await ctx.close();
  }

  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
