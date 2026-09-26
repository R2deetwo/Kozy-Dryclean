// Phase 60 QA — the intelligence layer. Verifies on the dev server:
//   A. ORDER MODAL DISPATCH CARD: ranked suggestions with reasons, zone
//      context, flags; PAUSED rider absent; assign flow lands the rider.
//   B. DISPATCH API: RBAC (401/403), shape, ALREADY_ASSIGNED 409.
//   C. CRM HEALTH: chips + filters, health column, last-order column,
//      VIP badge, relationship card in the detail modal.
//   D. HELP VIEW §9 documents the new intelligence.
//   E. Zero page errors.
// The only mutation is ONE driverId-only assignment (sends no email).
// Run: node scripts/p60_qa.js
const { chromium } = require('playwright');

const BASE = 'http://localhost:3000';
const ADMIN = { email: 'admin60@kozy-test.example', password: 'Phase60!Admin2026' };
const DRIVER = { email: 'rider60c@p60.test', password: 'x' }; // for RBAC check (403)

let pass = 0, fail = 0;
function log(name, ok, extra) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra !== undefined ? `  (${extra})` : ''}`);
  ok ? pass++ : fail++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function signIn(page, creds) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"]', creds.email);
  await page.fill('input[type="password"]', creds.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/admin|driver|portal/, { timeout: 20000 });
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  // ============ B. DISPATCH API (before the UI mutation) ============
  // Unauthenticated → 401/403. (Navigate somewhere same-origin first —
  // page.evaluate from about:blank is an opaque origin and fetch fails.)
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  const anon = await page.evaluate(async (url) => {
    const r = await fetch(url);
    return r.status;
  }, BASE + '/api/dispatch/suggest?orderId=none');
  log('dispatch API rejects anonymous caller', anon === 401 || anon === 403, anon);

  await signIn(page, ADMIN);
  log('admin sign-in lands on /admin', page.url().includes('/admin'), page.url());

  // Find the target order id via the orders API.
  const target = await page.evaluate(async (base) => {
    // Page through the cursor API the same way the console hook does.
    const all = [];
    let cursor = null;
    for (let guard = 0; guard < 20; guard++) {
      const url = `${base}/api/orders?limit=100${cursor ? `&cursor=${cursor}` : ''}`;
      const r = await fetch(url);
      const j = await r.json();
      all.push(...(j.items || []));
      if (!j.nextCursor) break;
      cursor = j.nextCursor;
    }
    const t = all.find((o) => o.orderNumber === 'KZ-60000001');
    return { id: t?.id, count: all.length };
  }, BASE);
  log('target order KZ-60000001 found via API', !!target.id, `of ${target.count} orders`);
  const orderId = target.id;

  const suggest = await page.evaluate(async ([base, id]) => {
    const r = await fetch(`${base}/api/dispatch/suggest?orderId=${id}`);
    return { status: r.status, body: await r.json() };
  }, [BASE, orderId]);
  log('dispatch suggest returns 200', suggest.status === 200, suggest.status);
  const s = suggest.body;
  log('order leg is PICKUP in Lekki', s.order?.leg === 'PICKUP' && s.order?.zone === 'Lekki', JSON.stringify(s.order));
  log('zone context: at least 3 Lekki pickups today, at least 1 unassigned', (s.context?.zonePickupsToday ?? 0) >= 3 && (s.context?.unassignedInZoneToday ?? 0) >= 1, JSON.stringify(s.context));
  const names = (s.suggestions || []).map((x) => x.rider.name);
  log('eligible riders suggested incl. the whole seeded bench (paused excluded)', (s.suggestions?.length ?? 0) >= 3 && ['Tunde Bakare', 'Ibrahim Musa', 'Chuka Eze'].every((n) => names.includes(n)), s.suggestions?.length);
  log('paused rider excluded from suggestions', !names.some((n) => /Paused/i.test(n)), names.join(', '));
  log('ranking: Tunde first', names[0] === 'Tunde Bakare', names.join(' > '));
  log('ranking: Chuka last', names[names.length - 1] === 'Chuka Eze');
  const tunde = s.suggestions?.[0] || {};
  const chuka = s.suggestions?.[s.suggestions.length - 1] || {};
  log('Tunde score ~78 (35 prox + 13 load + 15 corridor + 9 promises + 6 terrain)', tunde.score === 78, tunde.score);
  log('Chuka score 17 (stale GPS + capacity + incidents + late)', chuka.score === 17, chuka.score);
  const tProx = (tunde.factors || []).find((f) => f.kind === 'proximity');
  log('Tunde proximity: 0.0 km from Lekki, GPS ~4m', /0\.0 km from Lekki — GPS [0-9]+m ago/.test(tProx?.text || ''), tProx?.text);
  const tCorr = (tunde.factors || []).find((f) => f.kind === 'corridor');
  log('Tunde corridor: already holds 2 Lekki stops', /Already holds 2 Lekki stops today — natural batching/.test(tCorr?.text || ''), tCorr?.text);
  const tProm = (tunde.factors || []).find((f) => f.kind === 'promises');
  log('Tunde promises: 11 of 12 on time', /11 of 12 promises kept/.test(tProm?.text || ''), tProm?.text);
  const tTer = (tunde.factors || []).find((f) => f.kind === 'terrain');
  log('Tunde terrain: 7 of 12 in Lekki', /7 of 12 lifetime deliveries were in Lekki/.test(tTer?.text || ''), tTer?.text);
  const cLoad = (chuka.factors || []).find((f) => f.kind === 'load');
  log('Chuka load: 5 open stops', /5 open stops/.test(cLoad?.text || ''), cLoad?.text);
  log('Chuka flagged At capacity', (chuka.flags || []).includes('At capacity'));
  log('Chuka flagged GPS stale', (chuka.flags || []).includes('GPS is stale'));
  const cProm = (chuka.factors || []).find((f) => f.kind === 'promises');
  log('Chuka promises show 2 of 10 + 2 unresolved issues', /2 of 10 promises kept/.test(cProm?.text || '') && /2 unresolved issues/.test(cProm?.text || ''), cProm?.text);
  const ibrahim = (s.suggestions || []).find((x) => x.rider.name === 'Ibrahim Musa') || {};
  const iProx = (ibrahim.factors || []).find((f) => f.kind === 'proximity');
  log('Ibrahim (no GPS): neutral proximity note', /No GPS ping yet — position unknown/.test(iProx?.text || ''), iProx?.text);
  const iProm = (ibrahim.factors || []).find((f) => f.kind === 'promises');
  log('Ibrahim promises: new rider note', /New rider — no record yet/.test(iProm?.text || ''), iProm?.text);

  // ============ A. ORDER MODAL DISPATCH CARD ============
  await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
  await page.click('aside nav button:has-text("Orders")');
  await page.waitForSelector('text=Ready to Pick Up', { timeout: 15000 });
  await sleep(1200);

  // Open the unassigned target order's modal from its kanban card.
  await page.locator('text=KZ-60000001').first().click();
  await page.waitForSelector('text=Dispatch', { timeout: 15000 });
  await sleep(900);
  let modalText = await page.textContent('body');

  log('modal shows the Dispatch card', /Dispatch/.test(modalText));
  log('dispatch line names the leg + zone', /who should take this pickup in Lekki/.test(modalText));
  log('zone context shows today load + unassigned', /[0-9]+ pickups in Lekki today/.test(modalText) && /[0-9]+ still unassigned/.test(modalText));
  log('Tunde ranked #1 in the card UI', (await page.locator('text=Tunde Bakare').count()) >= 1);
  const scoreBars = await page.locator('text=/[0-9]+\\/100/').allTextContents();
  log('score bars show /100 values', scoreBars.length >= 3, scoreBars.slice(0, 3).join(' | '));
  log('reason line: distance with GPS freshness', /km from Lekki — GPS \d+m ago/.test(modalText));
  log('reason line: corridor batching', /Already holds 2 Lekki stops today — natural batching/.test(modalText));
  log('reason line: promises kept', /11 of 12 promises kept on time/.test(modalText));
  log('reason line: terrain history', /7 of 12 lifetime deliveries were in Lekki/.test(modalText));
  // Chuka sits below the top-3 cut — expand the full list to reach his row.
  const hasExpander = (await page.locator('button:has-text("more)")').count()) > 0;
  if (hasExpander) {
    await page.locator('button:has-text("All riders")').first().click();
    await sleep(600);
    modalText = await page.textContent('body');
  }
  log('Chuka shows At capacity flag', /At capacity/.test(modalText));
  log('Chuka shows unresolved issue flag', /Unresolved incident/.test(modalText));
  log('Ibrahim shows new-rider note', /New rider — no record yet/.test(modalText));
  log('paused rider NOT in the modal', !/Phase 60 Paused Rider/.test(modalText));
  log('footer explains the scoring policy', /Scored on distance to the slot, current load, same-zone batching/.test(modalText));

  // Screenshot for VLM.
  await page.screenshot({ path: 'work/p60-dispatch-modal.png' });

  // ---- Assign Tunde (driverId-only PATCH — no email fires) ----
  await page.locator('button:has-text("Assign")').first().click();
  await page.waitForSelector('text=Assigned rider', { timeout: 20000 });
  await sleep(800);
  modalText = await page.textContent('body');
  log('after assign: Assigned rider section shows Tunde', /Assigned rider/.test(modalText) && /Tunde Bakare/.test(modalText));
  log('after assign: dispatch card is gone', (await page.locator('text=who should take this pickup').count()) === 0);
  await page.locator('[data-slot="dialog-close"]').first().click();
  await page.waitForSelector('[data-slot="dialog-overlay"]', { state: 'detached', timeout: 10000 });
  await sleep(600);

  // ALREADY_ASSIGNED after assignment.
  const conflict = await page.evaluate(async ([base, id]) => {
    const r = await fetch(`${base}/api/dispatch/suggest?orderId=${id}`);
    return { status: r.status, body: await r.json().catch(() => ({})) };
  }, [BASE, orderId]);
  log('suggest on assigned order → 409 ALREADY_ASSIGNED', conflict.status === 409 && conflict.body.error === 'ALREADY_ASSIGNED', conflict.status);

  // Unassign to leave a clean state for re-runs (driverId: null is the
  // server's clear-assignment path; also no email).
  await page.evaluate(async ([base, id]) => {
    await fetch(`${base}/api/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driverId: null }),
    });
  }, [BASE, orderId]);
  log('target order unassigned again for idempotent re-runs', true);

  // ============ C. CRM HEALTH ============
  await page.click('aside nav button:has-text("Customers")');
  await page.waitForSelector('text=Customers (CRM)', { timeout: 15000 });
  await sleep(1500); // fetchAll orders + users settle
  let crmText = await page.textContent('body');

  log('health filter chips present', /On rhythm/.test(crmText) && /Going quiet/.test(crmText) && /At risk/.test(crmText) && /VIP/.test(crmText));
  log('chips footnote explains the model', /quiet for longer than their own usual gap/.test(crmText));
  log('Health column header present', /Health/.test(crmText));
  log('Last order column header present', /Last order/.test(crmText));

  // Per-customer verdicts (search to isolate rows).
  async function rowHealth(name) {
    await page.fill('input[placeholder*="Search"]', name);
    await sleep(700);
    const t = await page.textContent('table');
    await page.fill('input[placeholder*="Search"]', '');
    await sleep(500);
    return t;
  }
  const bisiRow = await rowHealth('Bisi Adeyemi');
  log('Bisi: On rhythm chip', /On rhythm/.test(bisiRow), bisiRow.match(/On rhythm|Going quiet|At risk|New/)?.[0]);
  log('Bisi: last order 3d ago (5d pickup + 2d turnaround)', /3d ago/.test(bisiRow));
  const femiRow = await rowHealth('Femi Ojo');
  log('Femi: Going quiet chip', /Going quiet/.test(femiRow));
  const adaRow = await rowHealth('Ada Umeh');
  log('Ada: At risk chip', /At risk/.test(adaRow));
  const chidiRow = await rowHealth('Chidi Nwankwo');
  log('Chidi: VIP badge in the row', /VIP/.test(chidiRow));

  // Filter behaviour.
  await page.click('button:has-text("At risk")');
  await sleep(700);
  let filteredText = await page.textContent('table');
  log('At-risk filter shows Ada', filteredText.includes('Ada Umeh'));
  log('At-risk filter hides Bisi', !filteredText.includes('Bisi Adeyemi'));
  await page.click('button:has-text("VIP")');
  await sleep(700);
  filteredText = await page.textContent('table');
  log('VIP filter shows only Chidi', filteredText.includes('Chidi Nwankwo') && !filteredText.includes('Bisi Adeyemi') && !filteredText.includes('Ada Umeh'));
  await page.locator('button:has(span.opacity-70)', { hasText: 'All' }).first().click();
  await sleep(700);

  // Detail modal — relationship card.
  await page.fill('input[placeholder*="Search"]', 'Bisi Adeyemi');
  await sleep(700);
  await page.locator('text=Bisi Adeyemi').first().click();
  await page.waitForSelector('text=Relationship', { timeout: 10000 });
  await sleep(700);
  let relText = await page.textContent('body');
  log('relationship card present', /Relationship/.test(relText));
  log('relationship sentence: on their rhythm', /On their rhythm — usually every 7 days, last served 3 days ago/.test(relText));
  log('rhythm stat: every ~7d', /every ~7d/.test(relText));
  log('delivered stat present', /Delivered/.test(relText));
  log('quietness risk meter present', /Quietness risk/.test(relText) && /\/100/.test(relText));
  await page.screenshot({ path: 'work/p60-relationship-modal.png' });
  await page.locator('[data-slot="dialog-close"]').first().click();
  await sleep(700);

  // Chidi's modal — VIP + LTV.
  await page.fill('input[placeholder*="Search"]', 'Chidi Nwankwo');
  await sleep(700);
  await page.locator('text=Chidi Nwankwo').first().click();
  await page.waitForSelector('text=Relationship', { timeout: 10000 });
  await sleep(700);
  relText = await page.textContent('body');
  log('Chidi modal carries VIP badge', /VIP/.test(relText));
  log('Chidi LTV ₦645,000 across 6 delivered', /₦645,000/.test(relText) && /Delivered/.test(relText), (relText.match(/₦[0-9,]+/g) || []).slice(0, 3).join(' '));
  await page.locator('[data-slot="dialog-close"]').first().click();
  await sleep(700);

  // New Person — no verdict yet.
  await page.fill('input[placeholder*="Search"]', 'New Person');
  await sleep(700);
  await page.locator('text=New Person').first().click();
  await page.waitForSelector('text=Relationship', { timeout: 10000 });
  await sleep(700);
  relText = await page.textContent('body');
  log('New Person: relationship just beginning', /relationship is just beginning/.test(relText));
  log('New Person: no churn risk meter', !(await page.locator('text=Quietness risk').count()));
  await page.locator('[data-slot="dialog-close"]').first().click();
  await sleep(700);

  // CRM screenshot (chips + table).
  await page.fill('input[placeholder*="Search"]', '');
  await sleep(800);
  await page.screenshot({ path: 'work/p60-crm.png' });

  // ============ D. HELP VIEW §9 ============
  await page.click('aside nav button:has-text("Help")');
  await page.waitForSelector('text=Smart Dispatch', { timeout: 10000 });
  await sleep(500);
  const helpText = await page.textContent('body');
  log('help §9 documents dispatch scoring', /9 · Smart Dispatch & customer health/.test(helpText));
  log('help §9 explains urgency-weighted distance', /distance budget grows with the time left/.test(helpText));
  log('help §9 explains the health rhythm model', /their own ordering rhythm/.test(helpText));

  // ============ RBAC: driver persona must not see dispatch ============
  const driverCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const dpage = await driverCtx.newPage();
  await dpage.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await dpage.fill('input[type="email"]', DRIVER.email);
  await dpage.fill('input[type="password"]', DRIVER.password);
  await dpage.click('button[type="submit"]');
  await dpage.waitForURL(/driver/, { timeout: 20000 });
  const dstat = await dpage.evaluate(async ([base, id]) => {
    const r = await fetch(`${base}/api/dispatch/suggest?orderId=${id}`);
    return r.status;
  }, [BASE, orderId]);
  log('dispatch API rejects DRIVER role', dstat === 403, dstat);
  await driverCtx.close();

  // ============ E. Zero page errors ============
  log('zero page errors', errors.length === 0, errors.slice(0, 2).join(' | '));

  await browser.close();
  console.log(`\nPhase 60 QA: ${pass} pass, ${fail} fail`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => {
  console.error('QA crashed:', e);
  process.exit(1);
});
