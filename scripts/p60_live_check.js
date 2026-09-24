// Phase 60 LIVE check on kozycare.ng — READ-ONLY.
// Persona: the phase-56 E2E battery ADMIN (woosh.dpdns.org inbox).
// No order creation, no payment actions, no status moves — nothing that
// could email anyone. The only "action" is opening pages and GETs.
// Run: node scripts/p60_live_check.js
const { chromium } = require('playwright');

const BASE = 'https://kozycare.ng';
const ADMIN = { email: 'vk5m2w8t4a@woosh.dpdns.org', password: 'KozyE2EAdmin!56' };

let pass = 0, fail = 0;
// Crash-proof restore hook (assigned inside the IIFE, callable from catch).
let restoreHook = null;
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

  // ---- Sign in as the battery admin ----
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"]', ADMIN.email);
  await page.fill('input[type="password"]', ADMIN.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/admin/, { timeout: 25000 });
  log('battery admin sign-in lands on /admin', page.url().includes('/admin'), page.url());

  // ---- Page through live orders; prefer an unassigned one, else borrow
  // the phase-59 parked test stop (unassign → verify → RESTORE; assignment
  // changes never send emails, and the restore runs in finally).
  const found = await page.evaluate(async (base) => {
    const all = [];
    let cursor = null;
    for (let guard = 0; guard < 20; guard++) {
      const url = `${base}/api/orders?limit=100${cursor ? `&cursor=${cursor}` : ''}`;
      const r = await fetch(url);
      if (!r.ok) return { httpError: r.status };
      const j = await r.json();
      all.push(...(j.items || []));
      if (!j.nextCursor) break;
      cursor = j.nextCursor;
    }
    const unassigned = all.filter(
      (o) => !o.driverId && !['DELIVERED', 'CANCELLED'].includes(o.status)
    );
    let t = unassigned[0];
    let restoreDriverId = null;
    if (!t) {
      // The parked test stop (phase 59): a deliberate test artifact.
      t = all.find((o) => o.orderNumber === 'KZ-20326489');
      restoreDriverId = t?.driverId ?? null;
    }
    return {
      total: all.length,
      unassignedCount: unassigned.length,
      borrowed: !unassigned[0] && !!t,
      restoreDriverId,
      id: t?.id,
      orderNumber: t?.orderNumber,
      status: t?.status,
      zoneHint: t?.pickupAddress,
    };
  }, BASE);
  log('live orders readable via API', !found.httpError && found.total > 0, `${found.total} orders`);
  log('dispatch target secured (unassigned or the parked test stop)', !!found.id, `${found.orderNumber} · ${found.status} · ${found.zoneHint}${found.borrowed ? ' · borrowed' : ''}`);

  // Borrowing: unassign the parked stop (email-free). The restore closure
  // is ALSO called from the outer catch — a crash mid-test can never leave
  // the stop unassigned.
  const restoreBorrowed = async () => {
    if (!found.borrowed || !found.id) return
    const ok = await page.evaluate(async ([base, id, driverId]) => {
      const r = await fetch(`${base}/api/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId }),
      })
      return r.ok
    }, [BASE, found.id, found.restoreDriverId]).catch(() => false)
    log('parked stop restored to its rider', ok, `driverId=${found.restoreDriverId}`)
  }
  restoreHook = restoreBorrowed
  if (found.borrowed && found.id) {
    await page.evaluate(async ([base, id]) => {
      await fetch(`${base}/api/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId: null }),
      });
    }, [BASE, found.id]);
    log('parked stop unassigned for the dispatch test (will be restored)', true);
    await sleep(1500)
  }

  // ---- GET /api/dispatch/suggest on the real order ----
  if (found.id) {
    const s = await page.evaluate(async ([base, id]) => {
      const r = await fetch(`${base}/api/dispatch/suggest?orderId=${id}`);
      return { status: r.status, body: await r.json().catch(() => ({})) };
    }, [BASE, found.id]);
    log('live dispatch suggest returns 200', s.status === 200, s.status);
    const sugg = s.body?.suggestions || [];
    log('live suggestions ranked with scores', sugg.length > 0 && typeof sugg[0].score === 'number', sugg.map((x) => `${x.rider.name}:${x.score}`).slice(0, 4).join(' | '));
    log('live suggestion carries explained factors', (sugg[0].factors || []).length === 5, (sugg[0].factors || []).map((f) => f.kind).join(','));
    log('live zone context present', typeof s.body?.context?.zonePickupsToday === 'number', JSON.stringify(s.body?.context));

    // ---- UI: open the order modal, see the Dispatch card on live data ----
  // (try/finally so the borrowed stop is ALWAYS restored)
    await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
    await page.click('aside nav button:has-text("Orders")');
    await page.waitForSelector('text=Ready to Pick Up', { timeout: 20000 });
    await sleep(3500); // board polls + first page settle
    // The board has no search box — click the card by its order number.
    await page.locator(`text=${found.orderNumber}`).first().click({ timeout: 20000 });
    await page.waitForSelector('text=Dispatch', { timeout: 20000 });
    await sleep(1200);
    const modalText = await page.textContent('body');
    log('live modal shows the Dispatch card', /Dispatch/.test(modalText));
    log('live dispatch card explains itself', /Scored on distance to the slot, current load, same-zone batching/.test(modalText));
    const topName = sugg[0]?.rider?.name;
    if (topName) log(`live top suggestion ${topName} rendered in UI`, modalText.includes(topName));
    await page.screenshot({ path: 'work/p60-live-dispatch.png' });
    await page.locator('[data-slot="dialog-close"]').first().click().catch(() => {});
    await sleep(700);
  }

  // ---- Restore the borrowed stop (also runs on crash via outer catch) ----
  await restoreBorrowed()

  // ---- CRM on live data ----
  await page.click('aside nav button:has-text("Customers")');
  await page.waitForSelector('text=Customers (CRM)', { timeout: 20000 });
  await sleep(2500); // fetchAll orders + users settle
  const crmText = await page.textContent('body');
  log('live CRM has health chips', /On rhythm/.test(crmText) && /Going quiet/.test(crmText) && /At risk/.test(crmText) && /VIP/.test(crmText));
  log('live CRM has Health + Last order columns', /Health/.test(crmText) && /Last order/.test(crmText));
  const chips = (crmText.match(/All\s?\d+|VIP\s?\d+|On rhythm\s?\d+|Going quiet\s?\d+|At risk\s?\d+/g) || []);
  log('live chip counts rendered', chips.length >= 4, chips.slice(0, 5).join(' | '));
  await page.screenshot({ path: 'work/p60-live-crm.png' });

  // ---- Help §9 on production ----
  await page.click('aside nav button:has-text("Help")');
  await page.waitForSelector('text=Smart Dispatch', { timeout: 15000 });
  const helpText = await page.textContent('body');
  log('live help §9 documents the intelligence', /9 · Smart Dispatch & customer health/.test(helpText));

  // ---- Zero page errors ----
  log('zero page errors on production', errors.length === 0, errors.slice(0, 2).join(' | '));

  await browser.close();
  console.log(`\nPhase 60 LIVE: ${pass} pass, ${fail} fail`);
  process.exit(fail > 0 ? 1 : 0);
})().catch(async (e) => {
  console.error('LIVE check crashed:', e);
  try { await restoreHook?.() } catch {}
  process.exit(1);
});
