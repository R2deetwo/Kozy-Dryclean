// Verify the moved /services sections render after scroll (whileInView) with
// loaded images — rules out the full-page-screenshot blank artifact.
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:3000/services', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  for (const secId of ['shoe-care', 'alterations']) {
    const sec = page.locator('#' + secId);
    await sec.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1400);
    const textLen = (await sec.innerText()).length;
    const imgs = await sec.locator('img').all();
    const imgInfo = [];
    for (const im of imgs) {
      imgInfo.push(await im.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return `${Math.round(r.width)}x${Math.round(r.height)}:${el.naturalWidth > 0 ? 'loaded' : 'broken'}`;
      }));
    }
    console.log(secId, '| innerText length:', textLen, '| images:', imgInfo.join(', ') || 'none');
    await sec.screenshot({ path: `/home/z/my-project/work/p45-sec-${secId}.png` });
  }

  const at = page.locator('section').filter({ hasText: 'Inside the atelier' }).first();
  await at.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1400);
  console.log('atelier | innerText length:', (await at.innerText()).length);
  await at.screenshot({ path: '/home/z/my-project/work/p45-sec-atelier.png' });

  await browser.close();
  console.log('done');
})().catch((e) => { console.error(e); process.exit(1); });
