const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const h2 = [...document.querySelectorAll('h2')].find(h => h.textContent.includes('Three steps'));
    h2.scrollIntoView({ block: 'start' });
  });
  await page.waitForTimeout(1400); // whileInView animations fire
  await page.screenshot({ path: 'work/p46-howitworks-desk.png' });
  const info = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('img')].filter(i => i.src.includes('how-')).map(i => ({ complete: i.complete, nw: i.naturalWidth }));
    return { cards, bodyLen: document.body.innerText.length };
  });
  console.log('how-it-works images loaded:', JSON.stringify(info.cards));
  await browser.close();
})();
