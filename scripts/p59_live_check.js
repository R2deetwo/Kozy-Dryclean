// Phase 59 live check — the rider app's stop clarity + 3-step guide + the
// /maps/dir/ navigation fix, and the people-list separation, LIVE on
// kozycare.ng.
//
// Strategy (no customer-facing side effects):
//   - Admin persona inspects the CRM (customers only — no driver/admin rows,
//     checked against the REAL user list) and the roster API (new fields).
//   - The parked TEST stop (KZ-75691751 / KZ-55555001 — customers are the
//     owner's own test accounts) is temporarily reassigned to the battery's
//     rider persona. A driverId-only PATCH sends NO email (notifications
//     fire on status changes only), the rider UI is verified against the
//     live stop, and the original rider gets the stop back.
//   - No statuses are advanced → the customer email cadence can't fire.
const { chromium } = require('playwright');

const BASE = 'https://kozycare.ng';
const ADMIN = { email: 'vk5m2w8t4a@woosh.dpdns.org', password: 'KozyE2EAdmin!56' };
const RIDER = { email: 'kozy-a-rider@woosh.dpdns.org', password: 'KozyAutoRider!56' };

let pass = 0, fail = 0;
function log(name, ok, extra) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra !== undefined ? `  (${extra})` : ''}`);
  ok ? pass++ : fail++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function signIn(page, creds) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await sleep(1000);
  await page.fill('input[type="email"]', creds.email);
  await page.fill('input[type="password"]', creds.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/admin|driver|portal/, { timeout: 30000 }).catch(() => {});
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];

  // ---------- pages up ----------
  const probe = await browser.newPage();
  probe.on('pageerror', (e) => errors.push(String(e)));
  for (const p of ['/', '/login', '/join-riders']) {
    const r = await probe.goto(BASE + p, { waitUntil: 'domcontentloaded' });
    log(`${p} HTTP ${r.status()}`, r.status() === 200);
  }
  await probe.close();

  // ---------- admin: users + a borrowable test stop ----------
  const admin = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  admin.on('pageerror', (e) => errors.push(String(e)));
  await signIn(admin, ADMIN);
  log('admin login lands in console', /admin/.test(admin.url()), admin.url());

  const users = await admin.evaluate(async () => {
    const out = [];
    let cursor = null;
    do {
      const url = '/api/users?limit=100' + (cursor ? `&cursor=${cursor}` : '');
      const r = await fetch(url, { cache: 'no-store' }).then((x) => x.json());
      const items = r.items ?? r.users ?? [];
      out.push(...items);
      cursor = r.nextCursor ?? null;
    } while (cursor);
    return out;
  });
  const drivers = users.filter((u) => u.role === 'DRIVER');
  const admins = users.filter((u) => u.role === 'ADMIN');
  log('user list fetched', users.length > 0, `${users.length} users · ${drivers.length} drivers · ${admins.length} admins`);

  // Roster API — the new driver-grade fields:
  const roster = await admin.evaluate(async () => {
    const r = await fetch('/api/rider-applications', { cache: 'no-store' }).then((x) => x.json());
    return r.roster ?? [];
  });
  log('roster API returns entries', roster.length > 0, `${roster.length} riders`);
  log('roster entries carry todayCompleted', roster.every((r) => typeof r.todayCompleted === 'number'));
  log('roster entries carry unresolvedIncidents', roster.every((r) => typeof r.unresolvedIncidents === 'number'));
  const batteryRider = roster.find((r) => r.email === RIDER.email);
  log('battery rider persona on the roster', !!batteryRider, batteryRider ? `open=${batteryRider.openAssignments} done=${batteryRider.todayCompleted}` : '');

  // Find a borrowable TEST stop (never a real customer's order):
  const orders = await admin.evaluate(async () => {
    const r = await fetch('/api/orders?limit=100', { cache: 'no-store' }).then((x) => x.json());
    return (r.items ?? []).map((o) => ({
      id: o.id, num: o.orderNumber, status: o.status, driverId: o.driverId,
      customer: o.user?.email, address: o.pickupAddress, delivery: o.deliveryAddress,
    }));
  });
  const TEST_CUSTOMERS = ['practiceprosystems@gmail.com', 'kozy-a-customer@woosh.dpdns.org'];
  const borrowable = orders.find(
    (o) => TEST_CUSTOMERS.includes(o.customer) &&
      (o.status === 'PAYMENT_VERIFIED' || o.status === 'OUT_FOR_DELIVERY') &&
      o.driverId && o.driverId !== batteryRider?.id
  );
  const borrowedFor = orders.find((o) => o.id === borrowable?.id);
  const originalDriverId = borrowable?.driverId ?? null;
  log('borrowable test stop found', !!borrowable, borrowable ? `#${borrowable.num} · ${borrowable.status}` : 'none parked');

  if (borrowable && batteryRider) {
    // Lend the stop to the battery rider (driverId-only PATCH — no email).
    await admin.evaluate(async ([id, driverId]) => {
      await fetch(`/api/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId }),
      });
    }, [borrowable.id, batteryRider.id]);
  }

  // ---------- rider: the live stop UI ----------
  const rider = await browser.newPage({ viewport: { width: 390, height: 844 } });
  rider.on('pageerror', (e) => errors.push(String(e)));
  await signIn(rider, RIDER);
  log('rider login lands on /driver', /driver/.test(rider.url()), rider.url());
  await rider.waitForSelector('text=Your route today', { timeout: 20000 }).catch(() => {});
  await sleep(2500);

  if (borrowable) {
    const routeText = await rider.textContent('body');
    log('borrowed stop appears on the live route', routeText.includes(borrowable.num));
    const isPickup = borrowable.status === 'PAYMENT_VERIFIED';
    log(`stop type badge (${isPickup ? 'Pickup' : 'Delivery'}) on card`, routeText.includes(isPickup ? 'Pickup' : 'Delivery'));

    // Open the stop — the 3-step guide + navigation deep link:
    await rider.locator(`text=${borrowable.num}`).first().click();
    await rider.waitForSelector('text=At this stop', { timeout: 15000 });
    await sleep(800);
    const detailText = await rider.textContent('body');
    log('type banner states the mission', /PICKUP — COLLECT FROM CUSTOMER|DELIVERY — HAND OVER TO CUSTOMER/.test(detailText));
    log('"At this stop — in this order" guide present', /At this stop — in this order/.test(detailText));
    log('step 1 ride / step 2 count / step 3 swipe all present',
      /Ride to the (pickup|delivery) address/.test(detailText) &&
      (isPickup ? /Count the items with the customer/.test(detailText) : /Hand over and count together/.test(detailText)) &&
      /Swipe to confirm (pickup|delivery)/.test(detailText));

    const navHref = await rider.locator('a:has-text("Navigate")').first().getAttribute('href');
    log('Navigate is the /maps/dir/ deep link (seeds the address)', /google\.com\/maps\/dir\/\?api=1/.test(navHref || ''), (navHref || '').slice(0, 60));
    const wantAddr = (isPickup ? borrowable.address : (borrowable.delivery || borrowable.address) || '').split(',')[0].trim();
    log('Navigate seeds THIS stop\u2019s address', decodeURIComponent(navHref || '').includes(wantAddr), wantAddr);
    log('Call button beside Navigate', (await rider.locator('a:has-text("Call")').count()) >= 1);

    await rider.screenshot({ path: '/home/z/my-project/work/p59-live-stop.png', fullPage: true });
  } else {
    const routeText = await rider.textContent('body');
    log('rider app renders with no active stops (structure check)', /Your route today/.test(routeText));
  }
  log('rider Rules button present', (await rider.locator('button:has-text("Rules")').count()) === 1);
  log('no phantom new-stop banner on load', (await rider.locator('text=New stop assigned').count()) === 0);
  await rider.close();

  // ---------- return the borrowed stop ----------
  if (borrowable && originalDriverId) {
    await admin.evaluate(async ([id, driverId]) => {
      await fetch(`/api/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId }),
      });
    }, [borrowable.id, originalDriverId]);
    const back = await admin.evaluate(async (id) => {
      const r = await fetch(`/api/orders/${id}`, { cache: 'no-store' }).then((x) => x.json());
      const o = r.order ?? r;
      return { driverId: o.driverId, status: o.status };
    }, borrowable.id);
    log('borrowed stop returned to its rider (status untouched)', back.driverId === originalDriverId, JSON.stringify(back));
  }

  // ---------- CRM: customers only ----------
  await admin.locator('aside nav button:has-text("Customers")').first().click();
  await admin.waitForSelector('h1:has-text("Customers (CRM)")', { timeout: 15000 });
  await sleep(1800);
  const tableText = await admin.locator('table').first().textContent();
  const driverLeak = drivers.some((d) => tableText.includes(d.name) || tableText.includes(d.email));
  const adminLeak = admins.some((a) => tableText.includes(a.name) || tableText.includes(a.email));
  log('CRM table contains NO driver rows', !driverLeak, `${drivers.length} drivers in system`);
  log('CRM table contains NO admin rows', !adminLeak, `${admins.length} admins in system`);
  log('no Drivers tab on the CRM', (await admin.locator('button[role="tab"]:has-text("Drivers")').count()) === 0);
  const crmText = await admin.textContent('body');
  log('subtitle points to Riders/Staff tabs', /Riders/.test(crmText) && /Staff/.test(crmText));
  await admin.screenshot({ path: '/home/z/my-project/work/p59-live-crm.png', fullPage: true });

  // ---------- roster tiles ----------
  await admin.locator('aside nav button:has-text("Riders")').first().click();
  await admin.waitForSelector('text=Rider roster', { timeout: 15000 });
  await sleep(1800);
  const rosterText = await admin.textContent('body');
  log('roster tiles live (done today / open issues)', /done today/.test(rosterText) && /open issues/.test(rosterText));
  await admin.screenshot({ path: '/home/z/my-project/work/p59-live-roster.png', fullPage: true });

  await admin.close();
  await browser.close();

  log('zero page errors across all sessions', errors.length === 0, errors.slice(0, 2).join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
})();
