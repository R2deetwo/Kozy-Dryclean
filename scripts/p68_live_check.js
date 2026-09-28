// Phase 68 LIVE check on kozycare.ng — READ-ONLY, public pages only.
// Verifies the per-kg "From" positioning shipped in commit 5a805a9:
//   1. Landing services grid: "From ₦800 per kg" (Corporate & hotels card)
//   2. /memberships pricing tables → Corporate tab: "From, per kilogram" + ₦800 + minimum
//   3. /memberships tier cards: Essentials / Household / Whole Home (no Concierge/Atelier)
//   4. /services Couture Care section present
// Run: node scripts/p68_live_check.js
const { chromium } = require('playwright');

const BASE = 'https://kozycare.ng';
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

  // ---- 1. Landing page: Corporate & hotels card ----
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const landing = await page.textContent('body');
  log('landing shows "From ₦800 per kg"', /From ₦800 per kg/.test(landing));
  log('landing has no "on the dot" flat "₦800 per kg"', !/(^|[^m])₦800 per kg/.test(landing.replace('From ₦800 per kg', '')));

  // ---- 2. /memberships: plans + pricing tables ----
  await page.goto(`${BASE}/memberships`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  const memb = await page.textContent('body');
  log('3 kit-sized tiers present', /Essentials/.test(memb) && /Household/.test(memb) && /Whole Home/.test(memb));
  log('no Concierge tier', !/Concierge/.test(memb));
  log('no Atelier tier', !/Atelier/.test(memb.replace(/Atelier-grade/g, '')));

  // Click the Corporate tab in the pricing tables
  const corpTab = page.getByRole('tab', { name: /corporate/i }).first();
  if (await corpTab.count()) {
    await corpTab.click();
    await page.waitForTimeout(800);
    const corp = await page.textContent('body');
    log('corporate tab: "From, per kilogram"', /From, per kilogram/i.test(corp));
    log('corporate tab: ₦800 rate shown', /₦800/.test(corp));
    log('corporate tab: minimum charge line', /Minimum charge/i.test(corp) && /10kg minimum billable weight/i.test(corp));
    // Screenshot the navy per-kg card
    const navyCard = page.locator('div.bg-navy-gradient, .bg-navy-gradient').first();
    if (await navyCard.count()) {
      await navyCard.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      await navyCard.screenshot({ path: 'work/p68-perkg-card.png' });
      log('per-kg card screenshot saved', true);
    } else {
      await page.screenshot({ path: 'work/p68-perkg-card.png', fullPage: false });
      log('per-kg card screenshot saved (full page fallback)', true);
    }
  } else {
    log('corporate tab found', false, 'no tab role matched');
  }

  // ---- 3. /services: Couture Care ----
  await page.goto(`${BASE}/services`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const svc = await page.textContent('body');
  log('Couture Care section present', /Couture Care/.test(svc));
  log('quote-first pricing copy', /Quoted, never flat-priced/.test(svc));

  log('no page errors', errors.length === 0, errors.join('; ').slice(0, 200));
  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
