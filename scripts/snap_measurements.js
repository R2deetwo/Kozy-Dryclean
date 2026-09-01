// Screenshot the measurements page + landing alterations section
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3000/measurements', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  // top of page
  await page.screenshot({ path: '/home/z/my-project/work/image-rev5/qa-measure-top.png' });
  // click women tab
  await page.click('text=For women');
  await page.waitForTimeout(800);
  await page.screenshot({ path: '/home/z/my-project/work/image-rev5/qa-measure-women.png' });
  // click children tab
  await page.click('text=For children');
  await page.waitForTimeout(800);
  await page.screenshot({ path: '/home/z/my-project/work/image-rev5/qa-measure-children.png' });
  // click a measurement chip (waist) on children
  const waist = await page.$('text=Waist');
  if (waist) { await waist.click(); await page.waitForTimeout(600); }
  await page.screenshot({ path: '/home/z/my-project/work/image-rev5/qa-measure-waist-active.png' });
  // scroll to save section
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.75));
  await page.waitForTimeout(800);
  await page.screenshot({ path: '/home/z/my-project/work/image-rev5/qa-measure-save.png' });
  // landing alterations section
  await page.goto('http://localhost:3000/#alterations', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);
  const el = await page.$('#alterations');
  if (el) await el.screenshot({ path: '/home/z/my-project/work/image-rev5/qa-landing-alterations.png' });
  // care section with new image
  const imgs = await page.$$('img');
  for (const img of imgs) {
    const src = await img.getAttribute('src');
    if (src && src.includes('laundry-handover')) {
      await img.scrollIntoViewIfNeeded();
      await page.waitForTimeout(800);
      const box = await img.boundingBox();
      if (box) {
        await page.screenshot({ path: '/home/z/my-project/work/image-rev5/qa-landing-care.png', clip: { x: Math.max(0, box.x - 20), y: Math.max(0, box.y - 20), width: Math.min(1400, box.width + 40), height: Math.min(900, box.height + 40) } });
      }
    }
  }
  await browser.close();
  console.log('done');
})().catch(e => { console.error(e); process.exit(1); });
