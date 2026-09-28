// Phase 68 fix: capture the ACTUAL per-kg navy card (previous locator missed).
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('https://kozycare.ng/memberships', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.getByRole('tab', { name: /corporate/i }).first().click();
  await page.waitForTimeout(800);
  // The navy card is the one containing the "per kilogram" label
  const label = page.getByText(/per kilogram/i).first();
  await label.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  // walk up to the card-sized ancestor (the Card div with p-6 padding)
  const card = page.locator('div.bg-navy-gradient').filter({ hasText: /per kilogram/i }).first();
  if (await card.count()) {
    await card.screenshot({ path: 'work/p68-perkg-card.png' });
    console.log('card screenshot OK (bg-navy-gradient filtered)');
  } else {
    // fallback: viewport screenshot with label centered
    await page.screenshot({ path: 'work/p68-perkg-card.png' });
    console.log('viewport screenshot fallback');
  }
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
