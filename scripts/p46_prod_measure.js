// Phase 46 — measure LIVE home page height on kozycare.ng
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  for (const [name, vp] of [
    ['desktop', { width: 1440, height: 1000 }],
    ['mobile', { width: 390, height: 844 }],
  ]) {
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    await page.goto('https://kozycare.ng/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const h = await page.evaluate(() => document.body.scrollHeight);
    console.log(`LIVE ${name}: ${h}px`);
    await ctx.close();
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
