// Verify the Detty December calendar fix in the UI — the exact dialog the
// client screenshotted (Marketing tab → "Browse the 52-week plan").
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

  // ---- Marketing tab ----
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.click('text=Marketing');
  await page.waitForTimeout(3000);

  // ---- Open the 52-week plan dialog (the client's screenshot view) ----
  await page.click('button:has-text("Browse the 52-week plan")');
  await page.waitForTimeout(2500);

  const dialog = page.locator('.max-h-\\[420px\\]');
  const dialogText = () => page.textContent('body');

  // ---- Scroll to show weeks ~36-46 (W38 + W45 rows) ----
  await dialog.evaluate((el) => { el.scrollTop = el.scrollHeight * 0.72; });
  await page.waitForTimeout(600);
  await page.screenshot({ path: '/home/z/my-project/work/detty-fix/sept-nov-rows.png' });

  // ---- Scroll to the bottom (December rows 48-52) ----
  await dialog.evaluate((el) => { el.scrollTop = el.scrollHeight; });
  await page.waitForTimeout(600);
  await page.screenshot({ path: '/home/z/my-project/work/detty-fix/december-rows.png' });

  // ---- Assertions on the full dialog text ----
  const text = await dialogText();

  // W38: no more "One month till Detty December"
  log('W38 wrong subject gone', !text.includes('One month till Detty December'));
  log('W38 new subject present', text.includes('The end-of-year circuit starts in October. Start now.'));

  // W45: explicit start date
  log('W45 old subject gone', !text.includes('Detty December is loading'));
  log('W45 names December 15', text.includes('Detty December starts December 15. One month to prepare.'));

  // W49/W50 swap: thank-you BEFORE the 15th, Express AT the 15th-week
  const w49Idx = text.indexOf('Week 49');
  const w50Idx = text.indexOf('Week 50');
  const thankIdx = text.indexOf('A short thank-you');
  const expressIdx = text.indexOf('Detty December: event tonight, outfit ready tomorrow');
  log('both weeks present in dialog', w49Idx > 0 && w50Idx > w49Idx);
  log('W49 is now the thank-you (before the 15th)',
    w49Idx > 0 && thankIdx > w49Idx && (w50Idx < 0 || thankIdx < w50Idx),
    `w49@${w49Idx} thank@${thankIdx} w50@${w50Idx}`);
  log('W50 is now Express during Detty December',
    w50Idx > 0 && expressIdx > w50Idx && (expressIdx < text.indexOf('Week 51')));

  // December season labels sequence
  log('W49 season Early December', /Week 49[\s\S]{0,80}Early December/.test(text));
  log('W50 season Mid December', /Week 50[\s\S]{0,80}Mid December/.test(text));

  await browser.close();
  console.log(`\nUI RESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
