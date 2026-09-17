// Verify the seasonal promo plan in the Coupons tab: card renders with the
// Dec-15-keyed windows, "Create this coupon" prefills the form, and the
// coupon is created end-to-end (with window + rules).
const { chromium } = require('playwright');

const BASE = 'http://localhost:3000';
let pass = 0, fail = 0;
function log(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  ok ? pass++ : fail++;
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  // ---- Admin login ----
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'admin40@kozy-test.example');
  await page.fill('input[type="password"]', 'Phase40!Admin2026');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);

  // ---- Marketing → Coupons ----
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.click('text=Marketing');
  await page.waitForTimeout(2500);
  await page.click('button:has-text("Coupons")');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '/home/z/my-project/work/detty-fix/promo-plan-card.png', fullPage: false });

  const text = () => page.textContent('body');

  // ---- The plan card ----
  let t = await text();
  log('plan card title', t.includes('The seasonal promo plan'));
  log('Dec-15 rule stated in card', t.includes('Detty December starts December 15') && t.includes('never December 1'));
  log('DETTY15 row present', t.includes('DETTY15'));
  log('Detty window shows 15 Dec – 5 Jan', /15 Dec – 5 Jan/.test(t));
  log('announce-with pointer present', t.includes('Announce with:'));
  log('live/upcoming badges present', t.includes('Live now') && t.includes('Upcoming'));
  log('prefill is opt-in copy', t.includes('nothing is created until you confirm'));

  // ---- Click "Create this coupon" on the Detty December row ----
  const dettyRow = page.locator('div:has(> div > div > span:text-is("Detty December"))').first();
  await dettyRow.locator('button:has-text("Create this coupon")').click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '/home/z/my-project/work/detty-fix/detty15-prefilled-form.png', fullPage: false });

  // ---- The form is prefilled ----
  const nameVal = await page.inputValue('input[name="name"]');
  const codeVal = await page.inputValue('input[name="code"]');
  const descVal = await page.inputValue('input[name="description"]');
  const valueVal = await page.inputValue('input[name="value"]');
  const startVal = await page.inputValue('input[name="startDate"]');
  const endVal = await page.inputValue('input[name="endDate"]');
  const capVal = await page.inputValue('input[name="maxDiscount"]');
  const appliesVal = await page.$eval('select[name="appliesTo"]', (el) => el.value);
  log('name prefilled', nameVal === 'Detty December Ready', nameVal);
  log('code prefilled', codeVal === 'DETTY15', codeVal);
  log('description prefilled', /December 15/.test(descVal));
  log('value prefilled (15%)', valueVal === '15', valueVal);
  log('start prefilled 2026-12-15T00:00', startVal === '2026-12-15T00:00', startVal);
  log('end prefilled 2027-01-05T23:59', endVal === '2027-01-05T23:59', endVal);
  log('cap prefilled 5000', capVal === '5000', capVal);
  log('applies to B2C', appliesVal === 'B2C', appliesVal);
  t = await text();
  log('prefill hint banner', t.includes('Prefilled from the seasonal promo plan'));

  // ---- Submit — the owner's approval press ----
  await page.click('button:has-text("Create coupon")');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/home/z/my-project/work/detty-fix/detty15-created.png', fullPage: false });
  t = await text();
  log('creation toast', t.includes('Coupon created'));
  log('coupon card lists DETTY15', t.includes('DETTY15'));
  log('coupon card shows the window', /15 Dec/.test(t) && /5 Jan/.test(t) || /Dec 15/.test(t));

  // ---- Verify in the DB: window + rules persisted ----
  // (checked after browser closes via psql in the shell)

  await browser.close();
  console.log(`\nUI RESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
