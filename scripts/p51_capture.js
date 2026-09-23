// Phase 51 — visual captures of the reworked condition-photo step:
// desktop + mobile, mid-upload and settled states.
const { chromium } = require('playwright');
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
  await sleep(1500);
  await page.fill('#email', 'customer40@kozy-test.example');
  await page.fill('#password', 'Phase40!Customer2026');
  await page.click('button[type="submit"]');
  for (let i = 0; i < 20 && page.url().includes('/login'); i++) await sleep(500);

  await page.goto('http://localhost:3000/book', { waitUntil: 'domcontentloaded' });
  await sleep(2500);
  const resume = page.locator('button:has-text("Continue where you left off")');
  if (await resume.count() > 0) { await resume.first().click(); await sleep(800); }
  await page.locator('[aria-label^="Add one"]').first().click();
  await page.locator('[aria-label^="Add one"]').nth(1).click();
  await page.locator('button:has-text("Machine wash")').first().click();
  await page.locator('button:has-text("Continue")').first().click();
  await sleep(900);

  const files = [];
  for (let i = 1; i <= 8; i++) files.push({ name: `p${i}.png`, mimeType: 'image/png', buffer: TINY_PNG });
  await page.setInputFiles('input[type="file"][multiple]', files);
  await sleep(600);
  await page.screenshot({ path: 'work/p51-photostep-desktop-mid.png', fullPage: false });
  for (let i = 0; i < 20 && (await page.locator('text=8/30 photos').count()) === 0; i++) await sleep(400);
  await sleep(600);
  await page.screenshot({ path: 'work/p51-photostep-desktop.png', fullPage: false });

  // mobile
  const mctx = await browser.newContext({ viewport: { width: 375, height: 780 }, isMobile: true, hasTouch: true });
  const mp = await mctx.newPage();
  await mp.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
  await sleep(1500);
  await mp.fill('#email', 'customer40@kozy-test.example');
  await mp.fill('#password', 'Phase40!Customer2026');
  await mp.click('button[type="submit"]');
  for (let i = 0; i < 20 && mp.url().includes('/login'); i++) await sleep(500);
  await mp.goto('http://localhost:3000/book', { waitUntil: 'domcontentloaded' });
  await sleep(2500);
  const mresume = mp.locator('button:has-text("Continue where you left off")');
  if (await mresume.count() > 0) { await mresume.first().click(); await sleep(800); }
  await mp.locator('[aria-label^="Add one"]').first().click();
  await mp.locator('[aria-label^="Add one"]').nth(1).click();
  await mp.locator('button:has-text("Machine wash")').first().click();
  await mp.locator('button:has-text("Continue")').first().click();
  await sleep(900);
  await mp.setInputFiles('input[type="file"][multiple]', files);
  for (let i = 0; i < 20 && (await mp.locator('text=8/30 photos').count()) === 0; i++) await sleep(400);
  await sleep(600);
  await mp.screenshot({ path: 'work/p51-photostep-mobile.png', fullPage: false });
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  console.log('mobile horizontal overflow px:', overflow);

  await browser.close();
  console.log('CAPTURES DONE');
})().catch((e) => { console.error(e); process.exit(1); });
