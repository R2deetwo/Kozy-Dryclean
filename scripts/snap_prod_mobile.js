const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto('https://kozycare.ng/measurements', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);
  await page.evaluate(() => window.scrollTo(0, 1350));
  await page.waitForTimeout(900);
  await page.screenshot({ path: '/home/z/my-project/work/image-rev5/prod-measure-mobile.png' });
  await browser.close();
  console.log('done');
})().catch(e => { console.error(e); process.exit(1); });
