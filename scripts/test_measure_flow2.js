const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  // 1) measurements page — fill and save
  await page.goto('http://localhost:3000/measurements', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.8));
  await page.waitForTimeout(600);
  const inputs = await page.$$('input[placeholder="—"]');
  console.log('measurement inputs found:', inputs.length);
  const fillVals = ['39', '102', '88', '98'];
  for (let i = 0; i < Math.min(4, inputs.length); i++) await inputs[i].fill(fillVals[i]);
  await page.click('text=Save my measurements');
  await page.waitForTimeout(900);
  const stored = await page.evaluate(() => window.localStorage.getItem('kozy-saved-measurements-v1'));
  const parsed = JSON.parse(stored || 'null');
  if (!parsed || parsed.values.neck !== '39' || parsed.values.chest !== '102') {
    console.error('FAIL: saved values incorrect', stored); process.exit(1);
  }
  console.log('STEP1 PASS: measurements saved to localStorage');

  // 2) booking wizard — add alteration item via the + button
  await page.goto('http://localhost:3000/book', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const addBtn = await page.$('button[aria-label="Add one Alteration / Repair (per garment)"]');
  if (!addBtn) {
    console.error('FAIL: alteration add button not found');
    await page.screenshot({ path: '/home/z/my-project/work/image-rev5/qa-wizard-step1.png' });
    process.exit(1);
  }
  await addBtn.scrollIntoViewIfNeeded();
  await addBtn.click();
  await page.waitForTimeout(900);
  // check the alterations panel + attach button
  const attachBtn = await page.$('text=Attach my saved measurements');
  if (!attachBtn) {
    console.error('FAIL: attach button not shown');
    await page.screenshot({ path: '/home/z/my-project/work/image-rev5/qa-wizard-noattach.png' });
    process.exit(1);
  }
  console.log('STEP2 PASS: attach button visible');
  const chip = await page.$('text=+ Waist taken in');
  if (chip) { await chip.click(); await page.waitForTimeout(300); }
  await attachBtn.click();
  await page.waitForTimeout(600);
  const noteVal = await page.evaluate(() => document.querySelector('textarea')?.value ?? null);
  console.log('note value:', JSON.stringify(noteVal));
  if (!noteVal || !noteVal.includes('My measurements (men,') || !noteVal.includes('neck 39cm') || !noteVal.includes('chest 102cm')) {
    console.error('FAIL: note does not contain measurements'); process.exit(1);
  }
  console.log('STEP3 PASS: measurements attached to seamstress note');
  const attachedState = await page.$('text=Measurements attached to your note');
  console.log('attached state chip:', attachedState ? 'visible' : 'MISSING');
  await page.screenshot({ path: '/home/z/my-project/work/image-rev5/qa-wizard-attached.png' });
  await browser.close();
  console.log('ALL E2E PASS');
})().catch(e => { console.error('ERROR', e); process.exit(1); });
