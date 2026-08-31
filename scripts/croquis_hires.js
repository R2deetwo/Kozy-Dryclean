// High-res capture with VERIFIED tab switching (3x scale)
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 3,
  });
  await page.goto('http://localhost:3100/measurements', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  async function capture(tabText, mustHave, outPath) {
    let ok = false;
    for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
      try {
        await page.click(`button:has-text("${tabText}")`, { timeout: 5000 });
      } catch (e) {
        console.log(`click retry ${attempt} for ${tabText}: ${e.message.split('\n')[0]}`);
      }
      await page.waitForTimeout(900);
      // verify: the measurement chip unique to this profile must be visible
      try {
        await page.waitForSelector(`text=${mustHave}`, { timeout: 3000 });
        ok = true;
      } catch (e) {
        console.log(`verify retry ${attempt} for ${tabText} (${mustHave} not found)`);
      }
    }
    if (!ok) { console.log(`FAILED to activate ${tabText}`); return; }
    const svg = await page.$('svg[role="img"]');
    if (svg) {
      await svg.screenshot({ path: outPath });
      console.log(`ok: ${outPath}`);
    }
  }

  await capture('For men', 'Shirt length', '/home/z/my-project/work/croquis/men-hires.png');
  await capture('For women', 'Underbust', '/home/z/my-project/work/croquis/women-hires.png');
  await capture('For children', 'Height', '/home/z/my-project/work/croquis/child-hires.png');

  await browser.close();
  console.log('DONE');
})();
