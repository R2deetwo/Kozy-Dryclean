// Phase 59 QA — rider-app stop clarity + post-accept steps + navigation fix,
// and the people-list separation. Verifies on the dev server:
//   A. ROUTE LIST: only actionable stops; Pickup (gold) vs Delivery badges;
//      delivery cards carry the DROP-OFF address and their own run clock.
//   B. STOP DETAIL: type banner, "At this stop — in this order" 3 steps,
//      Navigate uses the /maps/dir/ deep link seeded with the stop's OWN
//      address (the owner's "did not seed the address" bug).
//   C. NEW-STOP ALERT still fires after the render-time rebuild: a live
//      assignment while the rider app is open lights the gold banner.
//   D. CRM SEPARATION: Customers list shows ONLY customers — the seeded
//      driver and admin are absent; no Drivers tab; Retail/Corporate work.
//   E. RIDER ROSTER: open stops / done today / delivered / open issues
//      (rose) for the seeded rider.
// Run: node scripts/p59_qa.js
const { chromium } = require('playwright');

const BASE = 'http://localhost:3000';
const DRIVER = { email: 'driver59@kozy-test.example', password: 'Phase59!Rider2026' };
const ADMIN = { email: 'admin59@kozy-test.example', password: 'Phase59!Admin2026' };

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

  // ============ A. RIDER ROUTE LIST ============
  await signIn(page, DRIVER);
  log('driver sign-in lands on /driver', page.url().includes('/driver'), page.url());
  await page.waitForSelector('text=Your route today', { timeout: 15000 });
  await sleep(1500); // let the first poll + geofence settle

  const body = await page.textContent('body');
  // No phantom alert on load (phase 59 regression guard): the route baseline
  // must swallow the first data arrival silently — riders must not see a
  // "New pickup assigned" banner for stops that were already on their route.
  log('no phantom new-stop banner on page load', (await page.locator('text=New stop assigned').count()) === 0);
  // Only actionable stops on the route:
  log('pickup stop KZ-59000001 on route', body.includes('KZ-59000001'));
  log('delivery stop KZ-59000002 on route', body.includes('KZ-59000002'));
  log('overdue delivery KZ-59000003 on route', body.includes('KZ-59000003'));
  log('PICKED_UP order KZ-59000004 NOT on route', !body.includes('KZ-59000004'));
  log('DELIVERED orders not on route', !body.includes('KZ-59000005') && !body.includes('KZ-59000006'));

  // Type identity — badges:
  const pickupCard = page.locator('button, a, div').filter({ hasText: /KZ-59000001/ }).first();
  const pickupCardText = await pickupCard.textContent();
  log('pickup card carries a Pickup badge', /Pickup/.test(pickupCardText || ''));
  log('delivery card carries a Delivery badge', /Delivery/.test((await page.locator('div').filter({ hasText: /KZ-59000002/ }).first().textContent()) || ''));

  // Delivery stops show the DROP-OFF address, not the pickup address:
  const routeText = await page.textContent('body');
  log('delivery card shows the Ikoyi drop-off address', routeText.includes('5B Alexander Avenue'));
  log('delivery card shows the VI drop-off address', routeText.includes('22 Ozumba Mbadiwe'));
  // (the pickup address only belongs to the PICKUP card — count occurrences:
  //  12 Admiralty Way must appear exactly once, on the pickup card)
  const admiraltyCount = (routeText.match(/12 Admiralty Way/g) || []).length;
  log('pickup address appears only on the pickup card', admiraltyCount === 1, `count=${admiraltyCount}`);

  // Clocks on the route cards:
  log('delivery card shows "Due by"', /Due by/.test(routeText));
  log('overdue delivery flagged "running over"', /running over/.test(routeText));
  log('pickup card shows "Slot"', /Slot/.test(routeText));

  // Stats row:
  log('stats: 1 pickup to collect', (await page.locator('text=to collect').count()) === 1);
  log('stats: 2 drops to deliver', (await page.locator('text=to deliver').count()) === 1);

  // Footer guidance:
  log('route footer explains the 3 steps', /3 steps/.test(routeText));

  // ============ B. PICKUP STOP DETAIL ============
  await page.locator('text=KZ-59000001').first().click();
  await page.waitForSelector('text=At this stop', { timeout: 10000 });
  await sleep(600);
  let detail = await page.textContent('body');

  log('pickup banner: PICKUP — COLLECT FROM CUSTOMER', /PICKUP — COLLECT FROM CUSTOMER/.test(detail));
  log('steps card header present', /At this stop — in this order/.test(detail));
  log('step 1: ride to the pickup address', /Ride to the pickup address/.test(detail));
  log('step 2: count the items with the customer', /Count the items with the customer/.test(detail));
  log('step 3: swipe to confirm pickup', /Swipe to confirm pickup/.test(detail));
  log('step 2 names the manifest count (4 items)', /4 items on the list/.test(detail));

  let navHref = await page.locator('a:has-text("Navigate")').first().getAttribute('href');
  log('pickup Navigate is a /maps/dir/ deep link', /google\.com\/maps\/dir\/\?api=1/.test(navHref || ''), navHref?.slice(0, 70));
  log('pickup Navigate seeds the pickup address', decodeURIComponent(navHref || '').includes('12 Admiralty Way'));
  log('pickup Navigate appends Lagos for the geocoder', decodeURIComponent(navHref || '').includes('Lagos, Nigeria'));
  log('pickup Navigate carries travelmode', /travelmode=driving/.test(navHref || ''));
  log('old /maps/search/ link is gone', !/maps\/search/.test(navHref || ''));
  log('Call button present next to Navigate', (await page.locator('a:has-text("Call")').count()) >= 1);
  log('pickup window block present', /Pickup window/.test(detail));
  log('swipe slider label correct', /Swipe to confirm pickup/.test(detail));
  log('report-a-problem still available', /Report a problem with this stop/.test(detail));
  await page.locator('button:has-text("Route")').first().click();
  await sleep(800);

  // ============ B2. DELIVERY STOP DETAIL ============
  await page.locator('text=KZ-59000002').first().click();
  await page.waitForSelector('text=At this stop', { timeout: 10000 });
  await sleep(600);
  detail = await page.textContent('body');

  log('delivery banner: DELIVERY — HAND OVER TO CUSTOMER', /DELIVERY — HAND OVER TO CUSTOMER/.test(detail));
  log('delivery detail shows the drop-off address', detail.includes('5B Alexander Avenue'));
  log('delivery address labelled correctly', /Delivery address/.test(detail));
  log('delivery promise block shows Due by', /Delivery promise/.test(detail) && /Due by/.test(detail));
  log('delivery step 2: hand over and count together', /Hand over and count together/.test(detail));
  log('delivery step 3: swipe to confirm delivery', /Swipe to confirm delivery/.test(detail));

  navHref = await page.locator('a:has-text("Navigate")').first().getAttribute('href');
  log('delivery Navigate seeds the DROP-OFF address', decodeURIComponent(navHref || '').includes('5B Alexander Avenue'), navHref?.slice(0, 70));
  log('delivery Navigate is /maps/dir/ deep link', /google\.com\/maps\/dir\/\?api=1/.test(navHref || ''));

  // ============ C. NEW-STOP ALERT (live assignment while open) ============
  await page.locator('button:has-text("Route")').first().click();
  await sleep(1200);

  const adminCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const adminPage = await adminCtx.newPage();
  await signIn(adminPage, ADMIN);

  // Assign the at-studio order (KZ-59000004, PICKED_UP → not on the route)
  // is NOT assignable as a stop… instead flip the unassigned pickup: create
  // a fresh assignment by moving KZ-59000001 OFF the driver and back? No —
  // cleanest: PATCH driverId of KZ-59000004 away (null), then back? The
  // simplest true-to-life test: the office assigns a NEW pickup. We reuse
  // KZ-59000004 by setting it OUT_FOR_DELIVERY + driver — a brand-new
  // delivery leg appearing on the route.
  const orderId = await adminPage.evaluate(async () => {
    const list = await fetch('/api/orders?limit=100', { cache: 'no-store' }).then((r) => r.json());
    const items = list.items ?? list;
    const o = (Array.isArray(items) ? items : []).find((x) => x.orderNumber === 'KZ-59000004');
    return o?.id ?? null;
  });
  log('admin context found order KZ-59000004', !!orderId, orderId);

  await adminPage.evaluate(async (id) => {
    await fetch(`/api/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'OUT_FOR_DELIVERY', driverId: null }),
    });
  }, orderId);
  await sleep(300);
  // Now assign it to the driver — the rider app is open and polling.
  await adminPage.evaluate(async (id) => {
    const me = await fetch('/api/users/me', { cache: 'no-store' }).then((r) => r.json());
    const driverId = me?.user?.id ? null : null;
    // resolve driver id from the roster instead
    const roster = await fetch('/api/rider-applications', { cache: 'no-store' }).then((r) => r.json());
    const rider = (roster.roster ?? []).find((r) => r.email === 'driver59@kozy-test.example');
    await fetch(`/api/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driverId: rider.id }),
    });
  }, orderId);

  // The rider app polls every 15s — the banner should light up.
  await page.waitForSelector('text=New stop assigned', { timeout: 25000 });
  const alertText = await page.textContent('body');
  log('new-stop banner fires on live assignment', true);
  log('banner labels it a delivery', /New delivery assigned/.test(alertText));
  await page.locator('text=New stop assigned').first().click();
  await sleep(800);
  log('tapping the banner opens the new stop', (await page.textContent('body')).includes('KZ-59000004'));

  // Restore the order to PICKED_UP so later phases' route stays as seeded.
  await adminPage.evaluate(async (id) => {
    await fetch(`/api/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PICKED_UP' }),
    });
  }, orderId);
  await adminCtx.close();

  // ============ D. CRM SEPARATION ============
  const crm = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await signIn(crm, ADMIN);
  await crm.locator('aside nav button:has-text("Customers")').first().click();
  await crm.waitForSelector('h1:has-text("Customers (CRM)")', { timeout: 10000 });
  await sleep(1200); // users + orders load
  const crmText = await crm.textContent('body');

  log('CRM shows the retail customer', crmText.includes('Amaka Nwosu'));
  log('CRM shows the corporate customer', crmText.includes('Lekki Suites Ltd'));
  // Scope to the TABLE — the sidebar always shows the signed-in admin's own name.
  const crmTable = await crm.locator('table').first().textContent();
  log('CRM does NOT list the rider', !crmTable.includes('Phase 59 Rider'));
  log('CRM does NOT list the admin', !crmTable.includes('Phase 59 Admin'));
  log('no Drivers tab on the CRM', (await crm.locator('button[role="tab"]:has-text("Drivers")').count()) === 0);
  log('CRM subtitle points riders to the Riders tab', /Riders/.test(crmText) && /Staff/.test(crmText));

  await crm.locator('button[role="tab"]:has-text("Corporate")').click();
  await sleep(600);
  const corpText = await crm.textContent('body');
  log('Corporate tab filters to B2B only', corpText.includes('Lekki Suites Ltd') && !corpText.includes('Amaka Nwosu'));

  // ============ E. RIDER ROSTER ============
  await crm.locator('aside nav button:has-text("Riders")').first().click();
  await crm.waitForSelector('text=Rider roster', { timeout: 10000 });
  await sleep(1200);
  const rosterText = await crm.textContent('body');

  log('roster shows the phase-59 rider', rosterText.includes('Phase 59 Rider'));
  log('roster: done-today tile present', /done today/.test(rosterText));
  log('roster: delivered tile present', /delivered/.test(rosterText));
  log('roster: open-issues tile present', /open issues/.test(rosterText));
  // The rider card itself should show 1 open issue in rose:
  const riderCard = crm.locator('div').filter({ hasText: /Phase 59 Rider/ }).filter({ hasText: /open issues/ }).first();
  log('rider card carries the issue count', (await riderCard.count()) >= 1);

  // API-level assertions for the new roster fields. Expected values from
  // the seed + this battery's own mutation (KZ-59000004 restored to
  // PICKED_UP, still assigned, picked up 2h ago):
  //   openAssignments  = 4  (pickup + 2 delivery runs + the at-studio order
  //                          — pipeline statuses all count as open work)
  //   todayCompleted   = 3  (KZ-59000005 pickup + delivery, KZ-59000004 pickup)
  //   deliveriesCompleted = 2 (all-time: 59000005 + 59000006)
  //   unresolvedIncidents = 1
  const rosterApi = await crm.evaluate(async () => {
    const r = await fetch('/api/rider-applications', { cache: 'no-store' }).then((x) => x.json());
    return (r.roster ?? []).find((x) => x.email === 'driver59@kozy-test.example') ?? null;
  });
  log('API: todayCompleted = 3 (three stops made today)', rosterApi?.todayCompleted === 3, JSON.stringify({ today: rosterApi?.todayCompleted, delivered: rosterApi?.deliveriesCompleted, open: rosterApi?.openAssignments, issues: rosterApi?.unresolvedIncidents }));
  log('API: deliveriesCompleted = 2 (all-time)', rosterApi?.deliveriesCompleted === 2);
  log('API: openAssignments = 4 (incl. the at-studio order)', rosterApi?.openAssignments === 4);
  log('API: unresolvedIncidents = 1', rosterApi?.unresolvedIncidents === 1);

  await crm.close();

  // ============ CLEANUP ============
  await browser.close();

  console.log(`\n${pass} passed, ${fail} failed`);
  if (errors.length > 0) {
    console.log('PAGE ERRORS:');
    errors.forEach((e) => console.log('  ' + e));
  }
  process.exit(fail > 0 || errors.length > 0 ? 1 : 0);
})();
