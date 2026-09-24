// Phase 57 live check — pacing colours live on kozycare.ng.
// READ-ONLY: logs in as the phase-56 E2E admin persona and inspects the
// board. No status changes → no emails can fire.
const { chromium } = require('playwright');

const BASE = 'https://kozycare.ng';
const ADMIN = { email: 'vk5m2w8t4a@woosh.dpdns.org', password: 'KozyE2EAdmin!56' };

let pass = 0, fail = 0;
function log(name, ok, extra) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra !== undefined ? `  (${extra})` : ''}`);
  ok ? pass++ : fail++;
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  // pages up
  for (const p of ['/', '/login', '/join-riders']) {
    const r = await page.goto(BASE + p, { waitUntil: 'domcontentloaded' });
    log(`${p} HTTP ${r.status()}`, r.status() === 200);
  }

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"]', ADMIN.email);
  await page.fill('input[type="password"]', ADMIN.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/admin|driver|portal/, { timeout: 25000 }).catch(() => {});
  log('admin login lands in console', /admin/.test(page.url()), page.url());

  await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
  await page.click('aside nav button:has-text("Orders")');
  await page.waitForSelector('h1:has-text("Orders")', { timeout: 20000 });
  await page.waitForSelector('[class*="cursor-grab"]', { timeout: 25000 }).catch(() => {});

  const header = await page.locator('h1:has-text("Orders")').locator('xpath=ancestor::div[2]').innerText();
  log('legend live (on track / due soon / overdue)',
    /on track/.test(header) && /due soon/.test(header) && /overdue/.test(header));

  const cardCount = await page.locator('[class*="cursor-grab"]').count();
  log('cards render on live board', cardCount > 0, `${cardCount} cards`);
  const pacingLines = await page.locator('[class*="cursor-grab"] [title*="window"], [class*="cursor-grab"] [title*="promised"]').count();
  log('pacing lines on live cards', pacingLines > 0, `${pacingLines} paced`);

  // The parked test order KZ-75691751 must carry a pacing line.
  const parked = page.locator('text=#KZ-75691751').locator('xpath=ancestor::*[contains(@class,"cursor-grab")][1]');
  if ((await parked.count()) > 0) {
    const txt = await parked.first().innerText();
    log('parked test order shows its promise', /Due|overdue/i.test(txt),
      (txt.match(/(Due[^\n]*|\d+\S* overdue)/) || [''])[0]);
  } else {
    log('parked test order on board', false, 'KZ-75691751 not found');
  }

  await page.screenshot({ path: '/home/z/my-project/work/p57-live-board.png' });
  log('zero page errors', errors.length === 0, errors.slice(0, 2).join(' | '));

  console.log(`\n${pass}/${pass + fail} PASS`);
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})();
