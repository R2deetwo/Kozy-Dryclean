// Task 86 — prod card debug: console + network + longer waits.
const { chromium } = require('playwright');
const BASE = 'https://kozycare.ng';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
  const logs = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text().slice(0, 150)}`));
  page.on('requestfailed', (r) => logs.push(`[net-FAIL] ${r.url().slice(0, 110)} ${r.failure()?.errorText}`));
  page.on('response', (r) => { if (r.url().includes('/api/')) logs.push(`[api] ${r.status()} ${r.url().slice(0, 100)}`); });

  await page.goto(`${BASE}/book`, { waitUntil: 'networkidle', timeout: 90000 });
  await sleep(2500);
  // 6 suits: at prod's live catalog price (₦4,000) that's ₦24,000 — solidly
  // in the ESSENTIALS band even if a click or two lands oddly.
  const ADD = 'button[aria-label="Add one Suit (3-Piece)"]';
  for (let attempt = 0; attempt < 6; attempt++) {
    for (let i = 0; i < 6; i++) { await page.click(ADD).catch(() => {}); await sleep(200); }
    const qty = await page.evaluate(() => {
      const row = Array.from(document.querySelectorAll('button[aria-label^="Add one"]'))
        .find(b => b.getAttribute('aria-label').includes('Suit (3-Piece)'))
      return row ? row.closest('div,li,span')?.textContent || '' : ''
    })
    if (/6/.test(qty)) break
    await sleep(900)
  }
  await page.click('button:has-text("Machine Wash")'); await sleep(400);
  await page.click('button:has-text("Continue")'); await sleep(1800);
  for (let i = 0; i < 5; i++) { if ((await page.locator('button:has-text("Skip for now")').count()) > 0) break; await sleep(500); }
  await page.click('button:has-text("Skip for now")'); await sleep(1800);
  await page.fill('#pickup-address', '1 Kozy Test Close, Lekki Phase 1, Lagos');
  await page.fill('#guest-name', 'Prod Card Check');
  await page.fill('#guest-email', 't86guest@woosh.dpdns.org');
  await page.fill('#guest-phone', '0803 000 1111');
  await page.click('button:has-text("Continue")'); await sleep(1000);

  // Poll for the card for up to 12 seconds (cold lambda + query settle).
  let visible = false;
  for (let i = 0; i < 12; i++) {
    visible = await page.locator('text=basket could be your first').isVisible().catch(() => false);
    if (visible) break;
    await sleep(1000);
  }
  console.log('CARD VISIBLE (12s poll):', visible);
  const summary = (await page.locator('body').textContent()) || '';
  console.log('summary has 6× Suit:', /6×\s*Suit \(3-Piece\)|6 × Suit/.test(summary));
  const suitLine = summary.match(/\d+\u00d7\s*Suit \(3-Piece\)/) || summary.match(/\d+ x Suit/);
  console.log('summary suit line:', suitLine ? suitLine[0] : '(not found)');
  const cardText = (await page.locator('div.bg-navy').filter({ hasText: 'first Kozy Bag' }).first().textContent().catch(() => '')) || '';
  console.log('card text:', cardText.replace(/\s+/g, ' ').slice(0, 200));
  await page.screenshot({ path: '/home/z/my-project/work/t86-shots/prod-card-retry.png', fullPage: false });

  // React Query state probe — what does the plans cache hold?
  const state = await page.evaluate(() => {
    const out = { localStorageDraft: !!localStorage.getItem('kozy.booking.draft.v1') };
    return out;
  });
  console.log('state:', JSON.stringify(state));
  console.log('--- logs ---');
  logs.filter((l) => !/\[api\] 200/.test(l)).slice(0, 20).forEach((l) => console.log(l));
  console.log('api calls:', logs.filter((l) => l.startsWith('[api]')).join(' | ') || 'none');
  await browser.close();
})();
