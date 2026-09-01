// BEFORE screenshots — robust version with try/catch per step
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3100/measurements', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  for (const tab of ['men', 'women', 'children']) {
    try {
      await page.click(`text=For ${tab}`);
      await page.waitForTimeout(900);
      const svg = await page.$('svg[role="img"]');
      if (svg) {
        await svg.screenshot({ path: `/home/z/my-project/work/croquis/before-${tab}-fig.png` });
        console.log(`ok: before-${tab}-fig.png`);
      }
      await page.screenshot({ path: `/home/z/my-project/work/croquis/before-${tab}-panel.png` });
      console.log(`ok: before-${tab}-panel.png`);
    } catch (e) { console.log(`ERR ${tab}: ${e.message.split('\n')[0]}`); }
    try {
      const chip = await page.$('button:has-text("Waist")') || await page.$('text=Waist');
      if (chip) { await chip.click(); await page.waitForTimeout(700); }
      const svg2 = await page.$('svg[role="img"]');
      if (svg2) {
        await svg2.screenshot({ path: `/home/z/my-project/work/croquis/before-${tab}-active.png` });
        console.log(`ok: before-${tab}-active.png`);
      }
    } catch (e) { console.log(`ERR ${tab} active: ${e.message.split('\n')[0]}`); }
  }
  await browser.close();
  console.log('DONE');
})();
