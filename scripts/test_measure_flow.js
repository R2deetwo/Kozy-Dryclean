// E2E: save measurements on /measurements, then book an alteration and attach them
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  // 1) measurements page — fill and save
  await page.goto('http://localhost:3000/measurements', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  // scroll to save section
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.8));
  await page.waitForTimeout(600);
  const inputs = await page.$$('input[placeholder="—"]');
  console.log('measurement inputs found:', inputs.length);
  // fill first four inputs (men: neck, chest, waist, seat)
  const fillVals = ['39', '102', '88', '98'];
  for (let i = 0; i < Math.min(4, inputs.length); i++) {
    await inputs[i].fill(fillVals[i]);
  }
  await page.screenshot({ path: '/home/z/my-project/work/image-rev5/qa-save-filled.png' });
  await page.click('text=Save my measurements');
  await page.waitForTimeout(900);
  await page.screenshot({ path: '/home/z/my-project/work/image-rev5/qa-save-done.png' });
  // verify localStorage
  const stored = await page.evaluate(() => window.localStorage.getItem('kozy-saved-measurements-v1'));
  console.log('localStorage:', stored);
  const parsed = JSON.parse(stored || 'null');
  if (!parsed || parsed.values.neck !== '39' || parsed.values.chest !== '102') {
    console.error('FAIL: saved values incorrect'); process.exit(1);
  }
  console.log('STEP1 PASS: measurements saved to localStorage');

  // 2) booking wizard — add alteration item
  await page.goto('http://localhost:3000/book', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  // find the alteration item button by its name
  const alterBtn = await page.$('text=Alteration / Repair (per garment)');
  if (!alterBtn) { console.error('FAIL: alteration item not found in wizard'); await page.screenshot({ path: '/home/z/my-project/work/image-rev5/qa-wizard-fail.png' }); process.exit(1); }
  await alterBtn.scrollIntoViewIfNeeded();
  await alterBtn.click();
  await page.waitForTimeout(800);
  // the alterations note panel should appear — check attach button
  const attachBtn = await page.$('text=Attach my saved measurements');
  if (!attachBtn) { console.error('FAIL: attach button not shown'); await page.screenshot({ path: '/home/z/my-project/work/image-rev5/qa-wizard-noattach.png' }); process.exit(1); }
  console.log('STEP2 PASS: attach button visible');
  // click chips first, then attach
  const chip = await page.$('text=+ Waist taken in');
  if (chip) { await chip.click(); await page.waitForTimeout(300); }
  await attachBtn.click();
  await page.waitForTimeout(600);
  const noteVal = await page.evaluate(() => {
    const ta = document.querySelector('textarea');
    return ta ? ta.value : null;
  });
  console.log('note value:', JSON.stringify(noteVal));
  if (!noteVal || !noteVal.includes('My measurements (men,') || !noteVal.includes('neck 39cm') || !noteVal.includes('chest 102cm')) {
    console.error('FAIL: note does not contain measurements'); process.exit(1);
  }
  console.log('STEP3 PASS: measurements attached to seamstress note');
  // verify the attached state shows
  const attachedState = await page.$('text=Measurements attached to your note');
  console.log('attached state chip:', attachedState ? 'visible' : 'MISSING');
  await page.screenshot({ path: '/home/z/my-project/work/image-rev5/qa-wizard-attached.png' });
  await browser.close();
  console.log('ALL E2E PASS');
})().catch(e => { console.error('ERROR', e); process.exit(1); });
