// Phase 59 live check, part 2 — verify the rider stop UI (badges, 3-step
// guide, the /maps/dir/ navigation deep link) against a REAL stop on
// kozycare.ng, created end-to-end through the battery's own personas:
//   kozy-a-customer books (bank transfer) → admin verifies → kozy-a-rider
//   assigned → the rider app shows the pickup stop with the new UI.
// The order is left parked at PAYMENT_VERIFIED on the battery rider's
// route (the phase-55/56 precedent — also handy for future live checks).
// Emails that fire: the customer's payment-confirmed email lands in the
// battery's own inbox; the admin alert goes to the standard alert
// recipients — exactly the phase-56 E2E pattern the owner signed off on.
const { chromium } = require('playwright');

const BASE = 'https://kozycare.ng';
const ADMIN = { email: 'vk5m2w8t4a@woosh.dpdns.org', password: 'KozyE2EAdmin!56' };
const CUSTOMER = { email: 'kozy-a-customer@woosh.dpdns.org', password: 'KozyAutoCust!56' };
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

  // ---------- 1. customer books a Lekki pickup ----------
  const cust = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  cust.on('pageerror', (e) => errors.push(String(e)));
  await signIn(cust, CUSTOMER);
  log('customer login lands in portal', /portal/.test(cust.url()), cust.url());

  const tomorrow = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' })
    .format(new Date(Date.now() + 24 * 3600 * 1000));

  const booked = await cust.evaluate(async (pickupDate) => {
    const r = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'ITEM',
        items: [
          { id: 'shirt', name: 'White shirt', quantity: 2 },
          { id: 'trouser', name: 'Trouser', quantity: 1 },
        ],
        modeOfWash: 'MACHINE',
        serviceSpeed: 'STANDARD',
        pickupAddress: '12 Admiralty Way, Lekki Phase 1, Lagos',
        deliveryAddress: '12 Admiralty Way, Lekki Phase 1, Lagos',
        pickupDate,
        pickupTimeSlot: '09:00 - 10:00',
        paymentMethod: 'BANK_TRANSFER',
      }),
    });
    return { status: r.status, data: await r.json().catch(() => ({})) };
  }, tomorrow);
  const order = booked.data?.order ?? booked.data;
  log('test order booked', booked.status === 201 || booked.status === 200, `#${order?.orderNumber} · ₦${order?.totalPrice ?? '?'}`);
  await cust.close();

  // ---------- 2. admin verifies the payment → PAYMENT_VERIFIED ----------
  const admin = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  admin.on('pageerror', (e) => errors.push(String(e)));
  await signIn(admin, ADMIN);
  log('admin login lands in console', /admin/.test(admin.url()), admin.url());

  const verified = await admin.evaluate(async (orderId) => {
    const full = await fetch(`/api/orders/${orderId}`, { cache: 'no-store' }).then((x) => x.json());
    const o = full.order ?? full;
    const paymentId = o?.payments?.[0]?.id;
    if (!paymentId) return { ok: false, why: 'no payment row' };
    const v = await fetch(`/api/payments/${paymentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'VERIFIED' }),
    });
    return { ok: v.ok, status: v.status };
  }, order.id);
  log('payment verified by admin', verified.ok, JSON.stringify(verified));

  // ---------- 3. assign the battery rider (driverId-only — no email) ----------
  const assigned = await admin.evaluate(async ([orderId]) => {
    const roster = await fetch('/api/rider-applications', { cache: 'no-store' }).then((x) => x.json());
    const rider = (roster.roster ?? []).find((r) => r.email === 'kozy-a-rider@woosh.dpdns.org');
    if (!rider) return { ok: false, why: 'rider not on roster' };
    const p = await fetch(`/api/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driverId: rider.id }),
    });
    return { ok: p.ok, riderId: rider.id };
  }, [order.id]);
  log('battery rider assigned to the stop', assigned.ok, JSON.stringify(assigned));
  await admin.close();

  // ---------- 4. the rider app sees the new pickup stop ----------
  const rider = await browser.newPage({ viewport: { width: 390, height: 844 } });
  rider.on('pageerror', (e) => errors.push(String(e)));
  await signIn(rider, RIDER);
  log('rider login lands on /driver', /driver/.test(rider.url()), rider.url());
  await rider.waitForSelector('text=Your route today', { timeout: 20000 }).catch(() => {});
  await sleep(2500);

  const routeText = await rider.textContent('body');
  log('the new stop appears on the live route', routeText.includes(order.orderNumber));
  log('gold Pickup badge on the card', routeText.includes('Pickup'));
  log('pickup slot shown on the card', /Slot/.test(routeText));

  // The new-stop banner: assignment happened before sign-in, so the route
  // baseline swallows it — no phantom alert (this is the intended quiet).
  log('no phantom banner on fresh load', (await rider.locator('text=New stop assigned').count()) === 0);

  await rider.locator(`text=${order.orderNumber}`).first().click();
  await rider.waitForSelector('text=At this stop', { timeout: 15000 });
  await sleep(800);
  const detailText = await rider.textContent('body');

  log('banner: PICKUP — COLLECT FROM CUSTOMER', /PICKUP — COLLECT FROM CUSTOMER/.test(detailText));
  log('"At this stop — in this order" guide present', /At this stop — in this order/.test(detailText));
  log('step 1 / 2 / 3 all present',
    /Ride to the pickup address/.test(detailText) &&
    /Count the items with the customer/.test(detailText) &&
    /Swipe to confirm pickup/.test(detailText));
  log('manifest count in step 2 (3 items)', /3 items on the list/.test(detailText));

  const navHref = await rider.locator('a:has-text("Navigate")').first().getAttribute('href');
  log('Navigate = /maps/dir/ deep link', /google\.com\/maps\/dir\/\?api=1/.test(navHref || ''), (navHref || '').slice(0, 70));
  log('Navigate seeds the Lekki address + Lagos', decodeURIComponent(navHref || '').includes('12 Admiralty Way') && decodeURIComponent(navHref || '').includes('Lagos, Nigeria'));
  log('travelmode=driving present', /travelmode=driving/.test(navHref || ''));
  log('Call button beside Navigate', (await rider.locator('a:has-text("Call")').count()) >= 1);
  log('swipe slider label correct', /Swipe to confirm pickup/.test(detailText));

  await rider.screenshot({ path: '/home/z/my-project/work/p59-live-stop.png', fullPage: true });
  await rider.close();

  await browser.close();
  log('zero page errors across all sessions', errors.length === 0, errors.slice(0, 2).join(' | '));
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(`parked for future checks: #${order.orderNumber} at PAYMENT_VERIFIED on kozy-a-rider's route`);
  process.exit(fail > 0 ? 1 : 0);
})();
