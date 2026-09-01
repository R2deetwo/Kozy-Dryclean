const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto('https://kozycare.ng/measurements', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);
  await page.evaluate(() => window.scrollTo(0, 950));
  await page.waitForTimeout(900);
  await page.screenshot({ path: '/home/z/my-project/work/image-rev5/prod-measurements.png' });
  // prod e2e: save measurements then book flow
  await page.evaluate(() => window.localStorage.clear());
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.8));
  await page.waitForTimeout(600);
  const inputs = await page.$$('input[placeholder="—"]');
  for (let i = 0; i < 4; i++) await inputs[i].fill(['39','102','88','98'][i]);
  await page.click('text=Save my measurements');
  await page.waitForTimeout(900);
  const stored = await page.evaluate(() => window.localStorage.getItem('kozy-saved-measurements-v1'));
  console.log('PROD localStorage save:', stored ? 'PASS' : 'FAIL');
  await page.goto('https://kozycare.ng/book', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  const addBtn = await page.$('button[aria-label="Add one Alteration / Repair (per garment)"]');
  if (!addBtn) { console.error('FAIL: alteration button missing on prod'); process.exit(1); }
  await addBtn.scrollIntoViewIfNeeded();
  await addBtn.click();
  await page.waitForTimeout(1000);
  const attachBtn = await page.$('text=Attach my saved measurements');
  console.log('PROD attach button:', attachBtn ? 'PASS' : 'FAIL');
  if (attachBtn) {
    await attachBtn.click();
    await page.waitForTimeout(700);
    const note = await page.evaluate(() => document.querySelector('textarea')?.value ?? '');
    console.log('PROD attach note:', note.includes('My measurements (men,') && note.includes('neck 39cm') ? 'PASS' : 'FAIL: ' + note);
    await page.screenshot({ path: '/home/z/my-project/work/image-rev5/prod-wizard-attached.png' });
  }
  // landing sections
  await page.goto('https://kozycare.ng/#alterations', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2200);
  const el = await page.$('#alterations');
  if (el) await el.screenshot({ path: '/home/z/my-project/work/image-rev5/prod-alterations.png' });
  const imgs = await page.$$('img');
  for (const img of imgs) {
    const src = await img.getAttribute('src');
    if (src && src.includes('laundry-handover')) {
      await img.scrollIntoViewIfNeeded();
      await page.waitForTimeout(900);
      const box = await img.boundingBox();
      if (box) await page.screenshot({ path: '/home/z/my-project/work/image-rev5/prod-care.png', clip: { x: Math.max(0, box.x - 20), y: Math.max(0, box.y - 20), width: Math.min(1400, box.width + 40), height: Math.min(900, box.height + 40) } });
    }
  }
  await browser.close();
  console.log('done');
})().catch(e => { console.error(e); process.exit(1); });
