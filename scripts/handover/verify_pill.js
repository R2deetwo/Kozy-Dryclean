// Verify the KOZY CARE pill: identical appearance + navigates to /signup.
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));

  await page.goto('https://kozycare.ng/', { waitUntil: 'networkidle' });

  // locate the pill link by its accessible name
  const pill = page.locator('a[aria-label*="Kozy Care"]').first();
  await pill.waitFor({ timeout: 15000 });
  const box = await pill.boundingBox();
  const styles = await pill.evaluate(el => {
    const s = getComputedStyle(el);
    return { radius: s.borderRadius, bg: s.backgroundColor, color: s.color,
             font: s.fontWeight + ' ' + s.fontSize, pad: s.padding, display: s.display };
  });
  console.log('pill box:', JSON.stringify({ w: Math.round(box.width), h: Math.round(box.height) }));
  console.log('pill styles:', JSON.stringify(styles));
  await pill.screenshot({ path: '/tmp/pill.png' });

  await pill.click();
  await page.waitForURL('**/signup**', { timeout: 15000 });
  const title = await page.title();
  console.log('after click URL:', page.url());
  console.log('signup page title:', title);

  // visual regression guard: pill vs pre-change look (gold pill, navy text, uppercase)
  const okStyle = styles.bg.includes('212, 175, 55') || styles.bg.includes('d4af37');
  console.log('gold background preserved:', okStyle ? 'YES' : 'CHECK ' + styles.bg);

  console.log('console errors:', errors.length ? errors.slice(0, 3) : 'none');
  await browser.close();
})();
