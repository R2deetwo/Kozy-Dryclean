// Task 86 — PROD verification of the checkout conversion card, as a GUEST
// (zero footprint: no account, no order, no submit — build a ₦22,000
// basket, see the card, leave).
const { chromium } = require('playwright');
const BASE = 'https://kozycare.ng';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 120)));
  await page.goto(`${BASE}/book`, { waitUntil: 'networkidle', timeout: 90000 });
  await sleep(2000);

  const ADD = 'button[aria-label="Add one Suit (3-Piece)"]';
  for (let attempt = 0; attempt < 5; attempt++) {
    for (let i = 0; i < 4; i++) {
      await page.click(ADD).catch(() => {});
      await sleep(150);
    }
    if ((await page.locator('button[aria-label="Remove one Suit (3-Piece)"]').count()) >= 1) break;
    await sleep(800);
  }
  console.log('basket registered:', (await page.locator('button[aria-label="Remove one Suit (3-Piece)"]').count()) >= 1);
  await page.click('button:has-text("Machine Wash")');
  await sleep(400);
  await page.click('button:has-text("Continue")');
  await sleep(1500);
  for (let i = 0; i < 5; i++) {
    if ((await page.locator('button:has-text("Skip for now")').count()) > 0) break;
    await sleep(400);
  }
  await page.click('button:has-text("Skip for now")');
  await sleep(1500);
  await page.fill('#pickup-address', '1 Kozy Test Close, Lekki Phase 1, Lagos');
  await page.fill('#guest-name', 'Prod Card Check');
  await page.fill('#guest-email', 't86guest@woosh.dpdns.org');
  await page.fill('#guest-phone', '0803 000 1111');
  await page.click('button:has-text("Continue")');
  await sleep(2500);

  const card = (await page.locator('div.bg-navy').filter({ hasText: 'first Kozy Bag' }).first().textContent().catch(() => '')) || '';
  console.log('CARD RENDERED:', /basket could be your first Kozy Bag/.test(card));
  console.log('card text:', card.replace(/\s+/g, ' ').slice(0, 260));
  console.log('plan + price from live row:', /The Essentials/.test(card) && /₦30,000/.test(card));
  console.log('accept + dismiss present:',
    (await page.locator('button:has-text("Make this my first")').count()) >= 1 &&
    (await page.locator('button:has-text("No thanks")').count()) >= 1);
  await page.screenshot({ path: '/home/z/my-project/work/t86-shots/prod-card.png', fullPage: true });
  console.log('page errors:', errors.length ? errors : 'none');
  await browser.close();
})();
