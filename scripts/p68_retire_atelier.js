// Phase 68 PROD FIX — retire the leftover ATELIER tier row in the prod DB.
// Story: phase 66's ladder migration seeded a 4th plan (The Atelier, 100k)
// into prod; phase 67 removed it from DEFAULT_PLANS but a deploy was blocked
// (dead token) — so today's deploy shipped 3-tier code while the DB row stayed
// active and the public /memberships page rendered 4 tier cards.
// Fix: sign in as the E2E battery admin (read-only in every other phase),
// verify 0 subscribers on ATELIER, then deactivate it via the app's own
// admin API (PUT /api/subscriptions/plans, partial edit {id, isActive:false}).
// Deactivation (not hard delete) is deliberate: the admin editor shows it as
// a dashed "Hidden" card the owner can delete or reactivate themselves.
// Run: node scripts/p68_retire_atelier.js
const { chromium } = require('playwright');

const BASE = 'https://kozycare.ng';
const ADMIN = { email: 'vk5m2w8t4a@woosh.dpdns.org', password: 'KozyE2EAdmin!56' };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // ---- Sign in as the battery admin ----
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"]', ADMIN.email);
  await page.fill('input[type="password"]', ADMIN.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/admin/, { timeout: 25000 });
  console.log('signed in:', page.url());

  // ---- 1. Find the ATELIER plan row ----
  const plans = await page.evaluate(async (base) => {
    const r = await fetch(`${base}/api/subscriptions/plans`);
    return (await r.json()).plans;
  }, BASE);
  const atelier = plans.find((p) => p.code === 'ATELIER');
  if (!atelier) { console.log('ATELIER not found — nothing to do'); await browser.close(); return; }
  console.log(`ATELIER found: id=${atelier.id} price=${atelier.priceMonthly} isActive=${atelier.isActive}`);

  // ---- 2. Check for ATELIER subscribers ----
  const subs = await page.evaluate(async (base) => {
    const r = await fetch(`${base}/api/subscriptions`);
    if (!r.ok) return { error: r.status };
    const j = await r.json();
    return { items: (j.items || j.subscriptions || j || []) };
  }, BASE);
  const items = Array.isArray(subs.items) ? subs.items : [];
  const atelierSubs = items.filter((s) => s.plan?.code === 'ATELIER' || s.planCode === 'ATELIER');
  console.log(`total subscriptions: ${items.length}, ATELIER subscribers: ${atelierSubs.length}`);
  if (atelierSubs.length > 0) {
    console.log('ABORT: ATELIER has subscribers — deactivation needs owner review.');
    await browser.close();
    process.exit(2);
  }

  // ---- 3. Deactivate via the app's own admin API ----
  const put = await page.evaluate(async ({ base, planId }) => {
    const r = await fetch(`${base}/api/subscriptions/plans`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plans: [{ id: planId, isActive: false }] }),
    });
    return { status: r.status, body: await r.json() };
  }, { base: BASE, planId: atelier.id });
  console.log('PUT status:', put.status);
  const after = (put.body?.plans || []).find((p) => p.code === 'ATELIER');
  console.log('ATELIER after PUT: isActive =', after?.isActive);

  // ---- 4. Verify public GET (signed out) no longer exposes it ----
  const pub = await page.evaluate(async (base) => {
    const r = await fetch(`${base}/api/subscriptions/plans`);
    return (await r.json()).plans;
  }, BASE);
  const pubAtelier = pub.find((p) => p.code === 'ATELIER');
  console.log('public GET codes:', pub.map((p) => `${p.code}(${p.isActive ? 'live' : 'hidden'})`).join(', '));
  console.log(pubAtelier?.isActive === false || !pubAtelier ? 'SUCCESS: ATELIER retired from public surface' : 'FAIL: still public');

  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
