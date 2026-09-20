// Final production measurements for phase 45: live page heights + screenshots.
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  const heights = {};
  for (const path of ['/', '/services']) {
    await page.goto('https://kozycare.ng' + path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    heights[path] = await page.evaluate(() => document.body.scrollHeight);
  }
  console.log('LIVE heights:', JSON.stringify(heights));

  await page.goto('https://kozycare.ng/', { waitUntil: 'networkidle' });
  await page.screenshot({ path: '/home/z/my-project/work/p45-prod-home.png', fullPage: true });
  await page.goto('https://kozycare.ng/services', { waitUntil: 'networkidle' });
  await page.screenshot({ path: '/home/z/my-project/work/p45-prod-services.png', fullPage: true });

  const m = await (await page.goto('https://kozycare.ng/services', { waitUntil: 'domcontentloaded' }), page).content();
  console.log('canonical present:', /rel="canonical"/.test(m));

  await browser.close();
  console.log('done');
})().catch((e) => { console.error(e); process.exit(1); });
