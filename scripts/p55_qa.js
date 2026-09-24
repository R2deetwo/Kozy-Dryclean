// Phase 55 QA — WhatsApp deep links, rider incident pipeline, rider rules,
// new-stop alert, join-riders validation, email-trigger hints.
// Dev server must be running with EMAIL_OVERRIDE_TO=practiceprosystems@gmail.com
// + BREVO creds (scripts/p55_run_qa.sh) — every send lands in the owner's
// inbox only. TERMII is deliberately NOT set, so SMS is skipped safely.
//
// Coverage:
//   A. VALIDATION — /join-riders: server rejects bad phone/name/year/licence;
//      client shows inline errors + the self-explaining experience question;
//      a clean application still lands with a KZR- reference.
//   B. INCIDENTS — driver reports damage: RiderIncident row + StatusEvent
//      timeline note + RIDER_INCIDENT NotificationEvent + admin alert email.
//      RBAC (staff 403, anon 401, non-assigned driver 403), validation,
//      admin resolution closes the ledger + a second timeline note.
//   C. RIDER APP  — Rules button + care& safety dialog; Report-a-problem
//      dialog; NEW-STOP ALERT lights up when a new pickup is assigned live.
//   D. ADMIN MODAL — customer contact card with Call + WhatsApp (wa.me,
//      international digits); the email-trigger hint under Set status;
//      WhatsApp option inside the Ask-the-customer composer.
//
// Run: node scripts/p55_qa.js   (after p55_run_qa.sh has booted the server)
const { chromium } = require('playwright');
const { execSync } = require('child_process');
const bcrypt = require('bcryptjs');
const fs = require('fs');

const BASE = 'http://localhost:3000';
const PSQL = '/home/z/my-project/work/pgvenv/lib/python3.12/site-packages/pgserver/pginstall/bin/psql';
const LOG = '/home/z/my-project/work/p55-dev.log';
const OVERRIDE_INBOX = 'practiceprosystems@gmail.com';

function sql(statement) {
  return execSync(`${PSQL} -h 127.0.0.1 -p 54329 -U postgres -d kozy -tA`, {
    input: statement,
    env: { ...process.env, PGPASSWORD: 'postgres' },
  }).toString().trim();
}

let pass = 0, fail = 0;
function log(name, ok, extra) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra !== undefined ? `  (${extra})` : ''}`);
  ok ? pass++ : fail++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function sentEmails() {
  try {
    const text = fs.readFileSync(LOG, 'utf8');
    const out = [];
    for (const m of text.matchAll(/\[brevo\] sent: (.*) -> (.*)/g)) {
      out.push({ subject: m[1], target: m[2].trim() });
    }
    return out;
  } catch { return []; }
}
const sentCount = () => sentEmails().length;
const onlyOverrideInbox = () => sentEmails().every((e) => e.target === OVERRIDE_INBOX);
async function waitForSends(n, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (sentCount() >= n) return true;
    await sleep(500);
  }
  return sentCount() >= n;
}

// Seed ids
const ORDER_D1 = 'qa55d0010000000000'; // driver's delivery stop (incident)
const ORDER_D2 = 'qa55d0020000000000'; // new-stop alert pickup
const ORDER_M = 'qa55m0010000000000'; // admin modal checks
const RIDER2_EMAIL = 'rider55b@kozy-test.example'; // non-assigned driver (RBAC)
const APPLICANT_EMAIL = 'applicant55@kozy-test.example';

(async () => {
  const errors = [];

  // ================= SETUP =================
  const staffHash = bcrypt.hashSync('Phase55!Staff2026', 10);
  const rider2Hash = bcrypt.hashSync('Phase55!Rider22026', 10);
  sql(`
    DELETE FROM "RiderIncident" WHERE "orderId" IN ('${ORDER_D1}','${ORDER_D2}','${ORDER_M}');
    DELETE FROM "StatusEvent" WHERE "orderId" IN ('${ORDER_D1}','${ORDER_D2}','${ORDER_M}');
    DELETE FROM "Order" WHERE id IN ('${ORDER_D1}','${ORDER_D2}','${ORDER_M}');
    DELETE FROM "RiderApplication" WHERE email = '${APPLICANT_EMAIL}';
    DELETE FROM "User" WHERE email IN ('${RIDER2_EMAIL}','staff55@kozy-test.example');
    DELETE FROM "NotificationEvent" WHERE type = 'RIDER_INCIDENT';
    INSERT INTO "User" (id, email, name, phone, role, "passwordHash", "emailVerified", "accessStatus", "createdAt", "updatedAt")
    VALUES ('staff55id0000000000000000', 'staff55@kozy-test.example', 'Staff Fiftyfive', '08035550001', 'STAFF', '${staffHash}', now(), 'ACTIVE', now(), now()),
           ('rider55bid000000000000000', '${RIDER2_EMAIL}', 'Other Rider', '08035550002', 'DRIVER', '${rider2Hash}', now(), 'ACTIVE', now(), now())
    ON CONFLICT (email) DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash";
  `);
  const custId = sql(`SELECT id FROM "User" WHERE email='customer40@kozy-test.example';`);
  const custPhone = sql(`SELECT phone FROM "User" WHERE email='customer40@kozy-test.example';`);
  const driverId = sql(`SELECT id FROM "User" WHERE email='driver44@kozy-test.example';`);
  sql(`
    INSERT INTO "Order" (id, "orderNumber", "userId", "driverId", status, type, "guaranteeActive", "serviceSpeed", "itemsManifest", "pickupAddress", "deliveryAddress", "pickupDate", "pickupTimeSlot", "totalPrice", "lastNotifiedStage", "createdAt", "updatedAt")
    VALUES ('${ORDER_D1}', 'KZ-550001', '${custId}', '${driverId}', 'OUT_FOR_DELIVERY', 'ITEM', false, 'STANDARD', '[{"id":"i1","name":"Navy suit","quantity":1}]', '12 Alexander Ave, Ikoyi', '12 Alexander Ave, Ikoyi', now(), '09:00 - 10:00', 5000, 6, now(), now()),
           ('${ORDER_M}', 'KZ-550002', '${custId}', NULL, 'REQUESTED', 'ITEM', false, 'STANDARD', '[]', '12 Alexander Ave, Ikoyi', NULL, now(), '09:00 - 10:00', 5000, -1, now(), now());
  `);

  const browser = await chromium.launch();

  async function login(email, password) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`${email}: ` + String(e)));
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    await sleep(1200);
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.click('button[type="submit"]');
    for (let i = 0; i < 40 && page.url().includes('/login'); i++) await sleep(500);
    return { ctx, page };
  }
  const api = (page, fixedHeaders = {}) => ({
    async call(method, path, body, headers = {}) {
      return page.evaluate(async ({ method, path, body, headers }) => {
        const r = await fetch(path, {
          method,
          headers: { 'Content-Type': 'application/json', ...headers },
          body: body ? JSON.stringify(body) : undefined,
        });
        let data = null;
        try { data = await r.json(); } catch {}
        return { status: r.status, data };
      }, { method, path, body, headers: { ...fixedHeaders, ...headers } });
    },
  });

  const adm = await login('admin40@kozy-test.example', 'Phase40!Admin2026');
  const stf = await login('staff55@kozy-test.example', 'Phase55!Staff2026');
  const drv = await login('driver44@kozy-test.example', 'Phase44!Driver2026');
  const drv2 = await login(RIDER2_EMAIL, 'Phase55!Rider22026');
  log('setup: admin/staff/driver/non-assigned-driver logged in',
    !adm.page.url().includes('/login') && !stf.page.url().includes('/login') &&
    !drv.page.url().includes('/login') && !drv2.page.url().includes('/login'));
  const admApi = api(adm.page);
  const stfApi = api(stf.page);
  const drvApi = api(drv.page);
  const drv2Api = api(drv2.page);

  // Anon context for unauthenticated probes. Each probe carries a distinct
  // x-forwarded-for so the public 3-per-hour application rate limit (per IP)
  // never trips during the battery — the limit itself is production behaviour
  // we do NOT want to weaken.
  const anon = await browser.newContext();
  const anonPage = await anon.newPage();
  await anonPage.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  const anonApi = api(anonPage, { 'x-forwarded-for': '10.55.0.1' });
  const ip = (n) => ({ 'x-forwarded-for': `10.55.0.${n}` });

  // ================= A. JOIN-RIDERS VALIDATION =================
  console.log('\n--- A. join-riders: validation + clarity ---');
  let r = await anonApi.call('POST', '/api/rider-applications', {
    fullName: 'Bad Phone', phone: 'nice', altPhone: '08035550003',
    address: '12 Alexander Ave, Ikoyi', lga: 'Ikoyi', bikeModel: 'Bajaj Boxer',
    bikeYear: '2022', licenseNumber: 'ABC123456', availability: 'full-time', consent: true,
  });
  log('A1 server rejects non-numeric phone (400)', r.status === 400, `status ${r.status}`);

  r = await anonApi.call('POST', '/api/rider-applications', {
    fullName: 'Bad Prefix', phone: '01234567890', altPhone: '08035550003',
    address: '12 Alexander Ave, Ikoyi', lga: 'Ikoyi', bikeModel: 'Bajaj Boxer',
    bikeYear: '2022', licenseNumber: 'ABC123456', availability: 'full-time', consent: true,
  }, ip(2));
  log('A2 server rejects wrong-prefix phone (400)', r.status === 400, `status ${r.status}`);

  r = await anonApi.call('POST', '/api/rider-applications', {
    fullName: 'Future Bike', phone: '08035550004', altPhone: '08035550003',
    address: '12 Alexander Ave, Ikoyi', lga: 'Ikoyi', bikeModel: 'Bajaj Boxer',
    bikeYear: '2050', licenseNumber: 'ABC123456', availability: 'full-time', consent: true,
  }, ip(3));
  log('A3 server rejects future bike year (400)', r.status === 400, `status ${r.status}`);

  r = await anonApi.call('POST', '/api/rider-applications', {
    fullName: 'Short Licence', phone: '08035550004', altPhone: '08035550003',
    address: '12 Alexander Ave, Ikoyi', lga: 'Ikoyi', bikeModel: 'Bajaj Boxer',
    bikeYear: '2022', licenseNumber: 'AB', availability: 'full-time', consent: true,
  }, ip(4));
  log('A4 server rejects too-short licence (400)', r.status === 400, `status ${r.status}`);

  // UI: the form shows inline errors and the clarified experience question.
  const joinPage = await anon.newPage();
  await joinPage.goto(`${BASE}/join-riders`, { waitUntil: 'domcontentloaded' });
  await joinPage.waitForSelector('#fullName', { timeout: 15000 });
  const experienceLabel = await joinPage.textContent('label[for="experience"]').catch(() => '');
  log('A5 experience question is self-explaining (jobs, not a ride)',
    /worked as a rider or driver/i.test(experienceLabel || ''), (experienceLabel || '').slice(0, 60));
  const helpText = await joinPage.textContent('form').catch(() => '');
  log('A6 experience help says "None" is a fine answer',
    /None — this would be my first|this would be my first/i.test(helpText));

  await joinPage.fill('#fullName', 'Ade The Applicant');
  await joinPage.fill('#phone', '0803 222 4455');
  await joinPage.fill('#altPhone', 'not-a-phone');
  await joinPage.fill('#address', '12 Alexander Ave, Ikoyi');
  await joinPage.fill('#lga', 'Ikoyi');
  await joinPage.fill('#bikeModel', 'Bajaj Boxer');
  await joinPage.fill('#bikeYear', '2022');
  await joinPage.fill('#licenseNumber', 'ABC123456');
  await joinPage.click('button[type="submit"]');
  await sleep(800);
  const inlineError = await joinPage.textContent('body').catch(() => '');
  log('A7 client blocks submit with inline emergency-contact error',
    /Emergency contact:.*Nigerian mobile/i.test(inlineError));
  const appsBefore = sql(`SELECT count(*) FROM "RiderApplication" WHERE email='${APPLICANT_EMAIL}';`);
  log('A8 nothing stored on a failed validation', appsBefore === '0', `rows: ${appsBefore}`);

  // Clean submit through the UI (email provided -> confirmation email to the
  // override inbox). The contract consent box must be ticked — the QA's first
  // run missed it, which is itself proof the gate works.
  await joinPage.fill('#email', APPLICANT_EMAIL);
  await joinPage.fill('#altPhone', '0803 555 0003');
  const consentBox = joinPage.locator('#consent, [role="checkbox"]').first();
  if (await joinPage.locator('button[role="checkbox"]').count() > 0) {
    await joinPage.locator('button[role="checkbox"]').first().click();
  } else {
    await consentBox.click().catch(() => {});
  }
  await sleep(300);
  let mark = sentCount();
  await joinPage.click('button[type="submit"]');
  await joinPage.waitForSelector('text=Application received!', { timeout: 15000 }).catch(() => {});
  await waitForSends(mark + 2); // applicant confirmation + admin alert
  const refShown = await joinPage.textContent('body').catch(() => '');
  log('A9 clean application succeeds with a KZR- reference shown',
    /KZR-[A-Z0-9]{4}/.test(refShown), (refShown.match(/KZR-[A-Z0-9]{4}/) || [''])[0]);
  log('A10 confirmation + admin alert emails sent', sentCount() >= mark + 2, `${mark}->${sentCount()}`);
  const storedPhone = sql(`SELECT phone FROM "RiderApplication" WHERE email='${APPLICANT_EMAIL}';`);
  log('A11 phone stored exactly as typed (0803 222 4455)', storedPhone === '0803 222 4455', storedPhone);

  // ================= B. RIDER INCIDENT PIPELINE =================
  console.log('\n--- B. rider incidents ---');
  mark = sentCount();
  r = await anonApi.call('POST', `/api/orders/${ORDER_D1}/incident`, {
    kind: 'DAMAGE', description: 'The navy suit got oil-stained while riding.',
  });
  log('B1 anon cannot report (401)', r.status === 401, `status ${r.status}`);

  r = await stfApi.call('POST', `/api/orders/${ORDER_D1}/incident`, {
    kind: 'DAMAGE', description: 'Staff should not be the reporting channel.',
  });
  log('B2 staff cannot report (403)', r.status === 403, `status ${r.status}`);

  r = await drv2Api.call('POST', `/api/orders/${ORDER_D1}/incident`, {
    kind: 'DAMAGE', description: 'This order is not assigned to this rider.',
  });
  log('B3 non-assigned driver refused (403)', r.status === 403, `status ${r.status}`);

  r = await drvApi.call('POST', `/api/orders/${ORDER_D1}/incident`, {
    kind: 'BROKEN', description: 'Whatever this is, it is not a valid kind.',
  });
  log('B4 invalid kind rejected (400)', r.status === 400, `status ${r.status}`);

  r = await drvApi.call('POST', `/api/orders/${ORDER_D1}/incident`, {
    kind: 'DAMAGE', description: 'too short',
  });
  log('B5 too-short description rejected (400)', r.status === 400, `status ${r.status}`);

  r = await drvApi.call('POST', `/api/orders/${ORDER_D1}/incident`, {
    kind: 'DAMAGE',
    description: 'The navy suit has a fresh oil stain down the sleeve — spotted while counting items at the gate.',
    atStop: 'delivery',
  });
  log('B6 assigned driver report accepted (201)', r.status === 201, `status ${r.status}`);
  await waitForSends(mark + 1);
  log('B7 urgent admin alert email fired', sentCount() >= mark + 1, `${mark}->${sentCount()}`);

  const inc = sql(`SELECT count(*) FROM "RiderIncident" WHERE "orderId"='${ORDER_D1}' AND kind='DAMAGE';`);
  log('B8 RiderIncident row stored', inc === '1', `rows: ${inc}`);
  const note = sql(`SELECT count(*) FROM "StatusEvent" WHERE "orderId"='${ORDER_D1}' AND note LIKE 'RIDER INCIDENT%';`);
  log('B9 timeline note written', note === '1', `rows: ${note}`);
  const ev = sql(`SELECT count(*) FROM "NotificationEvent" WHERE type='RIDER_INCIDENT';`);
  log('B10 RIDER_INCIDENT feed event stored', ev === '1', `rows: ${ev}`);

  // Resolve (admin only).
  const incId = sql(`SELECT id FROM "RiderIncident" WHERE "orderId"='${ORDER_D1}';`);
  r = await stfApi.call('POST', `/api/rider-incidents/${incId}`, { resolution: 'Staff cannot resolve.' });
  log('B11 staff cannot resolve (403)', r.status === 403, `status ${r.status}`);
  r = await admApi.call('POST', `/api/rider-incidents/${incId}`, { resolution: 'ok' });
  log('B12 too-short resolution rejected (400)', r.status === 400, `status ${r.status}`);
  r = await admApi.call('POST', `/api/rider-incidents/${incId}`, {
    resolution: 'Suit re-cleaned and re-delivered same evening; customer called and apologised to; rider coached on securing the load.',
  });
  log('B13 admin resolution accepted', r.status === 200, `status ${r.status}`);
  const resolved = sql(`SELECT "resolution" IS NOT NULL AND "resolvedAt" IS NOT NULL FROM "RiderIncident" WHERE id='${incId}';`);
  log('B14 incident marked resolved with outcome', resolved === 't');
  const note2 = sql(`SELECT count(*) FROM "StatusEvent" WHERE "orderId"='${ORDER_D1}' AND note LIKE 'Incident resolved%';`);
  log('B15 resolution copied to the order timeline', note2 === '1', `rows: ${note2}`);

  r = await admApi.call('GET', '/api/rider-applications');
  const incidentsInApi = r.data?.incidents ?? [];
  const ours = incidentsInApi.find((i) => i.orderNumber === 'KZ-550001');
  log('B16 incidents list in the riders API (resolved, with resolution text)',
    !!ours && !!ours.resolvedAt && /re-cleaned/i.test(ours.resolution || ''));

  // ================= C. RIDER APP UI =================
  console.log('\n--- C. rider app: rules, report, new-stop alert ---');
  await drv.page.goto(`${BASE}/driver`, { waitUntil: 'domcontentloaded' });
  await sleep(2000);
  const rulesBtn = await drv.page.locator('button:has-text("Rules")').count();
  log('C1 Rules button in the rider header', rulesBtn >= 1, `count: ${rulesBtn}`);
  await drv.page.click('button:has-text("Rules")').catch(() => {});
  await sleep(600);
  const rulesBody = await drv.page.textContent('body').catch(() => '');
  log('C2 care & safety dialog renders all three sections',
    /Care of the garments/.test(rulesBody) && /Ride by the law/.test(rulesBody) && /Money & honesty/.test(rulesBody));
  log('C3 law section covers helmet + licence + no-cash',
    /Helmet/.test(rulesBody) && /licence on you/.test(rulesBody) && /never handle cash/.test(rulesBody));
  await drv.page.keyboard.press('Escape');
  await sleep(400);

  // Open the delivery stop -> report a problem. (Ada Customer is the seeded
  // customer on order KZ-550001; the stop card shows her name.)
  await drv.page.locator('text=Ada Customer').first().click().catch(() => {});
  await sleep(1000);
  const reportBtn = await drv.page.locator('button:has-text("Report a problem with this stop")').count();
  log('C4 Report-a-problem button on the stop screen', reportBtn === 1, `count: ${reportBtn}`);
  await drv.page.click('button:has-text("Report a problem with this stop")').catch(() => {});
  await sleep(700);
  const dlgBody = await drv.page.textContent('body').catch(() => '');
  log('C5 report dialog offers damage/loss/theft/accident/other',
    /Damaged/.test(dlgBody) && /Lost \/ missing/.test(dlgBody) && /Theft/.test(dlgBody) && /Accident/.test(dlgBody) && /Other/.test(dlgBody));
  await drv.page.keyboard.press('Escape');
  await sleep(400);

  // NEW-STOP ALERT: create + assign a new pickup while the rider app is open.
  sql(`
    INSERT INTO "Order" (id, "orderNumber", "userId", "driverId", status, type, "guaranteeActive", "serviceSpeed", "itemsManifest", "pickupAddress", "pickupDate", "pickupTimeSlot", "totalPrice", "lastNotifiedStage", "createdAt", "updatedAt")
    VALUES ('${ORDER_D2}', 'KZ-550003', '${custId}', '${driverId}', 'PAYMENT_VERIFIED', 'ITEM', false, 'STANDARD', '[]', '5 Admiralty Way, Lekki Phase 1', now(), '11:00 - 12:00', 4000, 2, now(), now());
  `);
  let alertSeen = false;
  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    const banner = await drv.page.locator('text=New stop assigned').count();
    if (banner > 0) { alertSeen = true; break; }
  }
  log('C6 new-stop alert lights up within ~30s of assignment', alertSeen);
  if (alertSeen) {
    await drv.page.locator('text=New stop assigned').first().click().catch(() => {});
    await sleep(800);
    const detail = await drv.page.textContent('body').catch(() => '');
    log('C7 tapping the alert opens the new stop', /COLLECT FROM CUSTOMER|5 Admiralty/.test(detail));
  }

  // ----- First-sign-in password change -----
  sql(`UPDATE "User" SET "mustChangePassword" = true WHERE email='${RIDER2_EMAIL}';`);
  await drv2.page.goto(`${BASE}/driver`, { waitUntil: 'domcontentloaded' });
  await sleep(2500);
  let pwDialog = await drv2.page.locator('text=Set your own password').count();
  log('C8 forced password dialog appears on first sign-in', pwDialog >= 1, `count: ${pwDialog}`);
  if (pwDialog >= 1) {
    const inputs = drv2.page.locator('[role="dialog"] input[type="password"]');
    await inputs.nth(0).fill('Phase55!Rider22026');
    await inputs.nth(1).fill('Phase55!Rider2New9');
    await inputs.nth(2).fill('Phase55!Rider2New9');
    await drv2.page.locator('button:has-text("Set my password")').click();
    await sleep(1500);
    pwDialog = await drv2.page.locator('text=Set your own password').count();
    const flagCleared = sql(`SELECT "mustChangePassword" FROM "User" WHERE email='${RIDER2_EMAIL}';`);
    log('C9 password change accepted + flag cleared', pwDialog === 0 && flagCleared === 'f', `dialog: ${pwDialog}, flag: ${flagCleared}`);
    const relog = await login(RIDER2_EMAIL, 'Phase55!Rider2New9');
    log('C10 sign-in works with the new password', !relog.page.url().includes('/login'));
  }

  // ================= D. ADMIN MODAL =================
  console.log('\n--- D. admin order modal: customer card + WhatsApp + hints ---');
  await adm.page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
  await sleep(1500);
  // The board lives in the ORDERS tab (the dashboard lists recent orders
  // statically — clicking those does nothing).
  await adm.page.locator('button:has-text("Orders")').first().click().catch(() => {});
  await adm.page.waitForSelector('text=KZ-550002', { timeout: 20000 }).catch(() => {});
  await adm.page.locator('text=KZ-550002').first().click().catch(() => {});
  let modalOpened = false;
  for (let i = 0; i < 10; i++) {
    await sleep(700);
    if ((await adm.page.locator('[role="dialog"]').count()) > 0) { modalOpened = true; break; }
    await adm.page.locator('text=KZ-550002').first().click().catch(() => {});
  }
  log('D0 the order modal opens from the board', modalOpened);
  await sleep(700);
  const modalBody = await adm.page.textContent('[role="dialog"]').catch(() => '');
  log('D1 customer contact card shows Call + WhatsApp',
    /Customer/.test(modalBody) && /Call/.test(modalBody) && /WhatsApp/.test(modalBody));

  const waHref = await adm.page.locator('[role="dialog"] a[href*="wa.me"]').first().getAttribute('href').catch(() => null);
  const custDigits = (custPhone || '').replace(/\D/g, '');
  const intl = custDigits.startsWith('0') ? '234' + custDigits.slice(1) : custDigits.replace(/^234/, '234');
  log('D2 WhatsApp deep link targets the customer (wa.me/<intl digits>)',
    !!waHref && waHref.includes(`wa.me/${intl}`) && waHref.includes('text='), (waHref || '').slice(0, 80));
  log('D3 prefilled WhatsApp text references the order number',
    !!waHref && decodeURIComponent(waHref).includes('KZ-550002'));

  log('D4 email-trigger hint shown under Set status',
    /Emails go out at/.test(modalBody) && /only advance the status when that stage has/i.test(modalBody));

  // Ask-the-customer composer with the WhatsApp alternative.
  await adm.page.locator('button:has-text("Ask the customer")').first().click().catch(() => {});
  await sleep(800);
  const askTextarea = adm.page.locator('[role="dialog"] textarea').last();
  await askTextarea.fill('Which gate should the rider call at for the pickup?').catch(() => {});
  await sleep(500);
  const askDialog = await adm.page.textContent('body').catch(() => '');
  log('D5 Ask dialog offers "Send this on WhatsApp instead"',
    /Send this on WhatsApp instead/.test(askDialog));
  const askWaHref = await adm.page.locator('[role="dialog"] a[href*="wa.me"]').last().getAttribute('href').catch(() => null);
  log('D6 WhatsApp option carries the question in the prefilled text',
    !!askWaHref && decodeURIComponent(askWaHref).includes('Which gate should the rider call at'));

  // ================= GLOBAL SAFETY =================
  console.log('\n--- global safety ---');
  log('Z1 every send targeted the override inbox only', onlyOverrideInbox(), `${sentCount()} sends`);
  const sendFailures = (() => {
    try { return /Brevo send failed|Rider-incident notification failed|notifyRiderIncident failed/.test(fs.readFileSync(LOG, 'utf8')); }
    catch { return false; }
  })();
  log('Z2 zero send failures', !sendFailures);
  log('Z3 zero page errors', errors.length === 0, errors.slice(0, 3).join(' | ') || 'clean');

  // Screenshots for VLM
  try {
    await joinPage.screenshot({ path: 'work/p55-join-riders.png', fullPage: true });
    await drv.page.screenshot({ path: 'work/p55-rider-app.png', fullPage: false });
    await adm.page.screenshot({ path: 'work/p55-admin-modal.png', fullPage: false });
    console.log('\n[screenshots] work/p55-join-riders.png, work/p55-rider-app.png, work/p55-admin-modal.png');
  } catch {}

  await browser.close();
  console.log(`\n${pass}/${pass + fail} PASS, ${fail} FAIL`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
