// Task 85 — screenshot the upgraded footer (map embed, WhatsApp, review door)
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
  await page.goto('http://localhost:3000/memberships', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(2500); // lazy map iframe loads
  const footer = page.locator('footer');
  await footer.screenshot({ path: '/home/z/my-project/work/t85-footer-desktop.png' });
  // mobile
  const mp = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await mp.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await mp.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 90)); } });
  await mp.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await mp.waitForTimeout(1500);
  await mp.locator('footer').screenshot({ path: '/home/z/my-project/work/t85-footer-mobile.png' });
  await browser.close();
  console.log('saved work/t85-footer-desktop.png + t85-footer-mobile.png');
})();
