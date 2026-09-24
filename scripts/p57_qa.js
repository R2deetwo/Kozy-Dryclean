// Phase 57 QA — Kanban pacing colours (the "stay ahead" clocks).
// Verifies on the dev server (scripts/p57_run_qa.sh boots it):
//   1. Card pacing lines exist for every ACTIVE order and NONE for delivered.
//   2. The three states render with the right classes:
//        overdue  → rose left edge + rose dot + faint rose tint
//        watch    → amber left edge + amber dot, no tint
//        onTrack  → no edge, sage dot, calm text
//   3. Header chips count due-soon / overdue correctly (5 due soon, 4 overdue
//      with the seed — 3 watch + 2 overdue pre/turnaround... computed live).
//   4. The legend row renders (on track / due soon / overdue).
//   5. List view: Due column renders + sorts urgent-first.
//   6. Modal: pacing sentence under Set status matches the card's state.
//   7. Timing unit checks (pure function sanity via page.evaluate).
// Run: node scripts/p57_qa.js
const { chromium } = require('playwright');

const BASE = 'http://localhost:3000';
const ADMIN = { email: 'admin57@kozy-test.example', password: 'Phase57!Admin2026' };

let pass = 0, fail = 0;
function log(name, ok, extra) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra !== undefined ? `  (${extra})` : ''}`);
  ok ? pass++ : fail++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  // ---------- login ----------
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"]', ADMIN.email);
  await page.fill('input[type="password"]', ADMIN.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/admin|driver|portal/, { timeout: 20000 }).catch(() => {});
  await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
  // The console lands on the Dashboard tab — open the Orders (Kanban) tab.
  await page.click('aside nav button:has-text("Orders")');
  await page.waitForSelector('h1:has-text("Orders")', { timeout: 20000 });

  // ---------- board ready (cards with order numbers) ----------
  await page.waitForFunction(
    () => document.body.innerText.includes('KZ-5700000'),
    null,
    { timeout: 20000 }
  );
  await page.waitForSelector('[class*="cursor-grab"]', { timeout: 20000 });
  await sleep(1500); // let the query settle + cards render

  // ---------- per-card pacing assertions ----------
  // Card = the draggable element containing the order number.
  const cardFor = async (num) => {
    return page.locator(`text=#KZ-${num}`).locator('xpath=ancestor::*[contains(@class,"cursor-grab")][1]');
  };

  const expected = {
    // order → expected state
    '57000001': 'overdue', // pickup slot ended 3h ago
    '57000002': 'watch',   // pickup slot running now
    '57000003': 'onTrack', // pickup tomorrow
    '57000004': 'overdue', // express 24, picked up 25h ago
    '57000005': 'watch',   // express 48, picked up 40h ago
    '57000006': 'watch',   // standard, day 3.5
    '57000007': 'onTrack', // standard, day 1
    '57000008': 'overdue', // out for delivery 70m ago
    '57000009': 'watch',   // out for delivery 50m ago
  };

  for (const [num, want] of Object.entries(expected)) {
    const card = await cardFor(num);
    const cls = (await card.getAttribute('class')) || '';
    const hasOverdue = cls.includes('border-l-rose-300') && cls.includes('bg-rose-50/60');
    const hasWatch = cls.includes('border-l-amber-300') && !cls.includes('bg-rose-50');
    const hasOnTrack = !cls.includes('border-l-amber-300') && !cls.includes('border-l-rose-300');
    const got = hasOverdue ? 'overdue' : hasWatch ? 'watch' : hasOnTrack ? 'onTrack' : '??';
    log(`card KZ-${num} state=${want}`, got === want, `got=${got}`);
  }

  // Pacing text lines: overdue shows "overdue", watch shows "Due in".
  const t1 = await (await cardFor('57000001')).innerText();
  log('overdue card text has "overdue"', /overdue/i.test(t1), t1.split('\n')[2] || '');
  const t5 = await (await cardFor('57000005')).innerText();
  log('watch card text has "Due in"', /Due in/.test(t5), t5.split('\n')[2] || '');
  const t3 = await (await cardFor('57000003')).innerText();
  log('on-track card shows a Due date', /Due/.test(t3), t3.split('\n')[2] || '');

  // Delivered card (shown via toggle) must carry NO pacing line.
  await page.click('button:has-text("Completed")').catch(() => {});
  await sleep(800);
  const deliveredRow = page.locator('text=#KZ-57000010').locator('xpath=ancestor::*[contains(@class,"cursor-grab")][1]');
  if ((await deliveredRow.count()) > 0) {
    const dt = await deliveredRow.first().innerText();
    const cls = (await deliveredRow.first().getAttribute('class')) || '';
    log('delivered card has no pacing line', !/overdue|Due in/.test(dt));
    log('delivered card has no colour edge', !cls.includes('border-l-rose-300') && !cls.includes('border-l-amber-300'));
  } else {
    log('delivered card visible after toggle', false, 'not found');
  }
  await page.click('button:has-text("Delivered shown")').catch(() => {});
  await sleep(500);

  // ---------- header chips + legend ----------
  // Seed expectation: 4 due soon (running pickup slot, express-48 @40h,
  // standard day 3.5, delivery run @50m) and 3 overdue (missed pickup
  // slot, express-24 @25h, delivery run @70m).
  // div[2] = the left header column: title row (chips) + subtitle + legend.
  const headerText = await page.locator('h1:has-text("Orders")').locator('xpath=ancestor::div[2]').innerText();
  const dueSoonChip = headerText.match(/(\d+) due soon/);
  const overdueChip = headerText.match(/(\d+) overdue/);
  log('header "due soon" chip = 4', dueSoonChip?.[1] === '4', dueSoonChip?.[1]);
  log('header "overdue" chip = 3', overdueChip?.[1] === '3', overdueChip?.[1]);
  log('legend renders on track / due soon / overdue',
    /on track/.test(headerText) && /due soon/.test(headerText) && /overdue/.test(headerText));

  // ---------- pure timing unit checks (module logic via a page bundle eval) ----------
  // Evaluated indirectly through the DOM: create fake times by checking a
  // known card's title tooltip, which states the clock kind.
  const title1 = await (await cardFor('57000001')).locator('div[title*="Pickup slot"]').first().getAttribute('title');
  log('pickup clock tooltip present', /Pickup slot/.test(title1 || ''), title1 || '');
  const title4 = await (await cardFor('57000004')).locator('div[title*="turnaround"]').first().getAttribute('title');
  log('turnaround clock tooltip present', /24h turnaround/.test(title4 || ''), title4 || '');
  const title8 = await (await cardFor('57000008')).locator('div[title*="Delivery run"]').first().getAttribute('title');
  log('delivery-run clock tooltip present', /Delivery run/.test(title8 || ''), title8 || '');

  // ---------- list view ----------
  await page.click('button:has-text("List")');
  await page.waitForSelector('th:has-text("Due")', { timeout: 10000 });
  // The sort fires on the button INSIDE the th — clicking the th alone is a no-op.
  await page.click('th:has-text("Due") button');
  await sleep(600);
  const firstRow = await page.locator('tbody tr').first().innerText();
  const firstNum = firstRow.match(/KZ-(\d+)/)?.[1];
  // Urgent-first: the two most overdue orders are 57000001 (3h) / 57000008 (10m)
  // vs 57000004 (1h)... 57000001 ends 2h ago → most overdue is 01.
  log('list sorts urgent-first (KZ-57000001 on top)', firstNum === '57000001', firstNum);
  const dueCell = await page.locator('tbody tr').first().locator('td:nth-child(5)').innerText();
  log('list due cell shows overdue text', /overdue/i.test(dueCell), dueCell);

  // ---------- modal pacing line ----------
  await page.locator('tbody tr').first().click();
  await page.waitForSelector('text=Set status', { timeout: 10000 }).catch(() => {});
  await sleep(800);
  const modalText = await page.locator('[role="dialog"]').last().innerText().catch(() => '');
  log('modal pacing sentence present', /turnaround|Pickup slot|Delivery run/.test(modalText),
    (modalText.match(/(Pickup slot|24h turnaround|48h turnaround|3–5 day turnaround|Delivery run)[^\n]*/) || [''])[0]);
  // Order 57000001 is an overdue pickup → sentence ends "overdue"
  log('modal states overdue for the urgent order', /overdue/.test(modalText));
  await page.keyboard.press('Escape').catch(() => {});

  // ---------- screenshot ----------
  await page.click('button:has-text("Kanban")').catch(() => {});
  await sleep(800);
  await page.screenshot({ path: '/home/z/my-project/work/p57-board.png', fullPage: false });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '/home/z/my-project/work/p57-board-mobile.png', fullPage: false });

  // ---------- wrap up ----------
  log('zero page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  console.log(`\n${pass}/${pass + fail} PASS`);
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})();
