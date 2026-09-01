const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto('http://localhost:3000/measurements', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  // men tab (default) — scroll to figure
  await page.evaluate(() => window.scrollTo(0, 900));
  await page.waitForTimeout(600);
  const figCard = await page.$('.lg\\:sticky');
  if (figCard) await figCard.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  // screenshot the diagram + cards region
  await page.evaluate(() => window.scrollTo(0, 850));
  await page.waitForTimeout(700);
  await page.screenshot({ path: '/home/z/my-project/work/image-rev5/qa-measure-men.png' });
  // children height fixed
  await page.click('text=For children');
  await page.waitForTimeout(700);
  await page.screenshot({ path: '/home/z/my-project/work/image-rev5/qa-measure-children2.png' });
  // mobile view check
  const mpage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mpage.goto('http://localhost:3000/measurements', { waitUntil: 'networkidle' });
  await mpage.waitForTimeout(1500);
  await mpage.evaluate(() => window.scrollTo(0, 1100));
  await mpage.waitForTimeout(700);
  await mpage.screenshot({ path: '/home/z/my-project/work/image-rev5/qa-measure-mobile.png' });
  await browser.close();
  console.log('done');
})().catch(e => { console.error(e); process.exit(1); });
