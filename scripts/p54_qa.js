// Phase 54 QA — rider onboarding pipeline + curated customer email cadence
// + the staff "Ask the customer" channel. Dev server must be running with
// EMAIL_OVERRIDE_TO=practiceprosystems@gmail.com + BREVO creds (see
// scripts/p54_run_qa.sh) — every send lands in the owner's inbox only.
//
// Coverage:
//   A. CADENCE  — walking an order down the Kanban emails the customer at
//                 EXACTLY: ready-to-pick-up, finishing, out-for-delivery,
//                 delivered. Picked up / at station / processing are QUIET
//                 (asserted via the [notify] quiet-stage log lines).
//   B. ASK      — staff/admin question -> email + SMS(best-effort) + a
//                 StatusEvent timeline note; RBAC (driver 403, anon 401,
//                 staff allowed); validation; per-order rate limit.
//   C. RIDERS   — application -> refCode + applicant confirmation + admin
//                 alert; admin review list; approve creates DRIVER account
//                 + welcome email (+ collision guard vs customer emails);
//                 reject stays quiet; roster with delivery stats.
//   D. UI       — /join-riders "how onboarding works" strip + live submit;
//                 console Riders tab (admin sees, staff doesn't); the
//                 application card + roster; the order modal's Ask-the-
//                 customer composer.
//
// Run: node scripts/p54_qa.js   (after p54_run_qa.sh has booted the server)
const { chromium } = require('playwright');
const { execSync } = require('child_process');
const bcrypt = require('bcryptjs');
const fs = require('fs');

const BASE = 'http://localhost:3000';
const PSQL = '/home/z/my-project/work/pgvenv/lib/python3.12/site-packages/pgserver/pginstall/bin/psql';
const LOG = '/home/z/my-project/work/p54-dev.log';
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
function onlyOverrideInbox() {
  return sentEmails().every((e) => e.target === OVERRIDE_INBOX);
}
function noSendFailures() {
  try {
    const text = fs.readFileSync(LOG, 'utf8');
    return !/Brevo send failed|notify\w* failed|Customer-question notification failed|Rider welcome email failed/.test(text);
  } catch { return true; }
}
function quietStageLines() {
  try {
    const text = fs.readFileSync(LOG, 'utf8');
    return {
      PICKED_UP: /\[notify\] quiet stage[^\n]*PICKED_UP/.test(text),
      AT_STATION: /\[notify\] quiet stage[^\n]*AT_STATION/.test(text),
      PROCESSING: /\[notify\] quiet stage[^\n]*PROCESSING/.test(text),
    };
  } catch { return {}; }
}
async function waitForSends(n, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (sentCount() >= n) return true;
    await sleep(500);
  }
  return sentCount() >= n;
}

// Seed ids (>= 10 chars — zod min on orderId).
const ORDER_A = 'qa54a0010000000000'; // cadence + question
const ORDER_B = 'qa54a0020000000000'; // modal UI question (stays REQUESTED)
const ORDER_C = 'qa54a0030000000000'; // rate-limit exhaustion
const RIDER_EMAIL = 'tunde54@kozy-test.example';

(async () => {
  const errors = [];

  // ================= SETUP =================
  const staffHash = bcrypt.hashSync('Phase54!Staff2026', 10);
  sql(`
    DELETE FROM "StatusEvent" WHERE "orderId" IN ('${ORDER_A}','${ORDER_B}','${ORDER_C}');
    DELETE FROM "Order" WHERE id IN ('${ORDER_A}','${ORDER_B}','${ORDER_C}');
    DELETE FROM "RiderApplication" WHERE email IN ('${RIDER_EMAIL}','seedrider54@kozy-test.example') OR "refCode" LIKE 'KZR-%';
    DELETE FROM "User" WHERE email IN ('${RIDER_EMAIL}','staff54@kozy-test.example');
    DELETE FROM "NotificationEvent" WHERE type IN ('RIDER_APPLICATION','RIDER_DECISION');
    INSERT INTO "User" (id, email, name, phone, role, "passwordHash", "emailVerified", "accessStatus", "createdAt", "updatedAt")
    VALUES ('staff54id0000000000000000', 'staff54@kozy-test.example', 'Staff Fiftyfour', '+2348030000055', 'STAFF', '${staffHash}', now(), 'ACTIVE', now(), now())
    ON CONFLICT (email) DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash";
  `);
  const custId = sql(`SELECT id FROM "User" WHERE email='customer40@kozy-test.example';`);
  const baseOrder = (n) => `
    INSERT INTO "Order" (id, "orderNumber", "userId", status, type, "guaranteeActive", "serviceSpeed", "itemsManifest", "pickupAddress", "pickupDate", "pickupTimeSlot", "totalPrice", "lastNotifiedStage", "createdAt", "updatedAt")
    VALUES ('qa54a${String(n).padStart(3, '0')}0000000000', 'KZ-54000${n}', '${custId}', 'REQUESTED', 'ITEM', false, 'STANDARD', '[]', '12 Alexander Ave, Ikoyi', now(), '09:00 - 10:00', 5000, -1, now(), now());`;
  sql(baseOrder(1) + baseOrder(2) + baseOrder(3));

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
  const adm = await login('admin40@kozy-test.example', 'Phase40!Admin2026');
  const stf = await login('staff54@kozy-test.example', 'Phase54!Staff2026');
  const drv = await login('driver44@kozy-test.example', 'Phase44!Driver2026');
  log('setup: admin/staff/driver logged in',
    !adm.page.url().includes('/login') && !stf.page.url().includes('/login') && !drv.page.url().includes('/login'),
    `${adm.page.url()} | ${stf.page.url()} | ${drv.page.url()}`);

  const api = (page) => ({
    async call(method, path, body) {
      return page.evaluate(async ({ method, path, body }) => {
        const r = await fetch(path, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: body ? JSON.stringify(body) : undefined,
        });
        let data = null;
        try { data = await r.json(); } catch {}
        return { status: r.status, data };
      }, { method, path, body });
    },
  });
  const admApi = api(adm.page);
  const stfApi = api(stf.page);
  const drvApi = api(drv.page);

  // ================= A. EMAIL CADENCE =================
  console.log('\n--- A. curated status emails (order A walks the Kanban) ---');
  let mark = sentCount();
  let r = await admApi.call('PATCH', `/api/orders/${ORDER_A}`, { status: 'PAYMENT_VERIFIED' });
  await waitForSends(mark + 1);
  log('A1 ready-to-pick-up EMAILS the customer', r.status === 200 && sentCount() === mark + 1, `status ${r.status}, ${mark}->${sentCount()}`);

  mark = sentCount();
  r = await admApi.call('PATCH', `/api/orders/${ORDER_A}`, { status: 'PICKED_UP' });
  await sleep(3000);
  log('A2 picked-up is QUIET', r.status === 200 && sentCount() === mark, `status ${r.status}, sends ${mark}->${sentCount()}`);

  mark = sentCount();
  r = await admApi.call('PATCH', `/api/orders/${ORDER_A}`, { status: 'AT_STATION' });
  await sleep(3000);
  log('A3 at-station is QUIET', r.status === 200 && sentCount() === mark, `status ${r.status}, sends ${mark}->${sentCount()}`);

  mark = sentCount();
  r = await admApi.call('PATCH', `/api/orders/${ORDER_A}`, { status: 'PROCESSING' });
  await sleep(3000);
  log('A4 processing is QUIET', r.status === 200 && sentCount() === mark, `status ${r.status}, sends ${mark}->${sentCount()}`);

  mark = sentCount();
  r = await admApi.call('PATCH', `/api/orders/${ORDER_A}`, { status: 'FINISHING' });
  await waitForSends(mark + 1);
  log('A5 finishing EMAILS the customer', r.status === 200 && sentCount() === mark + 1, `status ${r.status}, ${mark}->${sentCount()}`);

  mark = sentCount();
  r = await admApi.call('PATCH', `/api/orders/${ORDER_A}`, { status: 'OUT_FOR_DELIVERY' });
  await waitForSends(mark + 1);
  log('A6 out-for-delivery EMAILS the customer', r.status === 200 && sentCount() === mark + 1, `status ${r.status}, ${mark}->${sentCount()}`);

  mark = sentCount();
  r = await admApi.call('PATCH', `/api/orders/${ORDER_A}`, { status: 'DELIVERED' });
  await waitForSends(mark + 1);
  log('A7 delivered EMAILS the feedback ask', r.status === 200 && sentCount() === mark + 1, `status ${r.status}, ${mark}->${sentCount()}`);

  const quiet = quietStageLines();
  log('A8 quiet-stage gate logged for all three silent stages',
    quiet.PICKED_UP && quiet.AT_STATION && quiet.PROCESSING, JSON.stringify(quiet));

  // ================= B. ASK THE CUSTOMER =================
  console.log('\n--- B. staff question to the customer ---');
  mark = sentCount();
  r = await admApi.call('POST', `/api/orders/${ORDER_A}/message`, {
    question: 'Our rider is nearby for the delivery — which gate should he call at?',
  });
  await waitForSends(mark + 1);
  const lastSend = sentEmails()[sentCount() - 1];
  log('B1 question EMAILS the customer', r.status === 200 && sentCount() === mark + 1, `status ${r.status}, subject "${lastSend?.subject}"`);
  const note = sql(`SELECT note FROM "StatusEvent" WHERE "orderId"='${ORDER_A}' AND note LIKE 'Question to customer:%' ORDER BY "createdAt" DESC LIMIT 1;`);
  log('B2 timeline note recorded', note.includes('which gate should he call'), note.slice(0, 70));

  r = await admApi.call('POST', `/api/orders/${ORDER_A}/message`, { question: 'too short' });
  log('B3 short question rejected', r.status === 400, `status ${r.status}`);

  r = await drvApi.call('POST', `/api/orders/${ORDER_A}/message`, { question: 'A driver trying to message the customer here.' });
  log('B4 drivers are blocked', r.status === 403, `status ${r.status}`);

  const anon = await fetch(`${BASE}/api/orders/${ORDER_A}/message`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: 'Anonymous probe of the message endpoint.' }),
  });
  log('B5 unauthenticated blocked', anon.status === 401, `status ${anon.status}`);

  mark = sentCount();
  r = await stfApi.call('POST', `/api/orders/${ORDER_A}/message`, {
    question: 'Quick check from the studio — should we fold or hang the shirts?',
  });
  await waitForSends(mark + 1);
  log('B6 STAFF can ask (email sent)', r.status === 200 && sentCount() === mark + 1, `status ${r.status}`);

  // ================= C. RIDER PIPELINE =================
  console.log('\n--- C. rider onboarding pipeline ---');
  mark = sentCount();
  r = await admApi.call('POST', '/api/rider-applications', {
    fullName: 'Tunde Balogun', email: RIDER_EMAIL, phone: '+2348031230054',
    altPhone: '+2348055550000', address: '5 Bourdillon Rd, Ikoyi', lga: 'Ikoyi',
    bikeModel: 'Bajaj Boxer', bikeYear: '2022', licenseNumber: 'LAG-8871234',
    availability: 'full-time', experience: 'Two years with a pharmacy delivery service.',
    consent: true,
  });
  const refCode = r.data?.refCode;
  await waitForSends(mark + 2);
  log('C1 application accepted with refCode', r.status === 201 && /^KZR-[A-Z2-9]{4}$/.test(refCode || ''), `status ${r.status}, ref ${refCode}`);
  const c1Subjects = sentEmails().slice(mark).map((e) => e.subject);
  log('C2 applicant confirmation + admin alert emailed (+2)',
    sentCount() === mark + 2, c1Subjects.join(' | '));

  r = await admApi.call('GET', '/api/rider-applications');
  const appRow = (r.data?.applications || []).find((a) => a.email === RIDER_EMAIL);
  log('C3 admin sees the application', r.status === 200 && !!appRow, `status ${r.status}`);

  // anon GET (no cookies)
  const anonGet = await fetch(`${BASE}/api/rider-applications`);
  log('C4 unauthenticated GET blocked', anonGet.status === 401, `status ${anonGet.status}`);
  const custCtx = await browser.newContext();
  const custPage = await custCtx.newPage();
  // login as a real customer, then probe — the point is 403 (not the old 500)
  await custPage.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await sleep(1200);
  await custPage.fill('#email', 'customer40@kozy-test.example');
  await custPage.fill('#password', 'Phase40!Customer2026');
  await custPage.click('button[type="submit"]');
  for (let i = 0; i < 40 && custPage.url().includes('/login'); i++) await sleep(500);
  const custGet = await custPage.evaluate(async () => {
    const res = await fetch('/api/rider-applications');
    return res.status;
  });
  log('C5 customer GET blocked (403, not 500)', custGet === 403, `status ${custGet}`);
  await custCtx.close();

  // collision guard: approving with a CUSTOMER's email must be refused
  r = await admApi.call('POST', `/api/rider-applications/${appRow.id}/decision`, {
    action: 'approve', email: 'customer40@kozy-test.example',
  });
  log('C6 customer-email approval refused', r.status === 409 && /customer account/i.test(r.data?.error || ''), `status ${r.status}`);

  mark = sentCount();
  r = await admApi.call('POST', `/api/rider-applications/${appRow.id}/decision`, {
    action: 'approve', email: RIDER_EMAIL,
    note: 'Come by the studio on Saturday to pick up your Kozy shirt.',
  });
  await waitForSends(mark + 1);
  const welcome = sentEmails()[sentCount() - 1];
  log('C7 approval sends the WELCOME email', r.status === 200 && sentCount() === mark + 1,
    `status ${r.status}, subject "${welcome?.subject}"`);

  const riderRow = sql(`SELECT u.id, u.role, u."mustChangePassword", a.status AS app_status, a."userId", a."reviewedAt" IS NOT NULL AS reviewed
                        FROM "User" u, "RiderApplication" a WHERE u.email='${RIDER_EMAIL}' AND a.email='${RIDER_EMAIL}';`);
  log('C8 DRIVER account created + application APPROVED + linked',
    riderRow.includes('|DRIVER|t|APPROVED|') && riderRow.endsWith('|t'), riderRow.replace(/\s+/g, ' '));
  const ev = sql(`SELECT count(*) FROM "NotificationEvent" WHERE type='RIDER_DECISION';`);
  log('C9 RIDER_DECISION audit event recorded', Number(ev) >= 1, `${ev} events`);

  r = await admApi.call('GET', '/api/rider-applications');
  const roster = (r.data?.roster || []).find((x) => x.email === RIDER_EMAIL);
  log('C10 rider appears in the roster', !!roster && roster.accessStatus === 'ACTIVE',
    roster ? `${roster.openAssignments} open / ${roster.deliveriesCompleted} delivered` : 'absent');

  // reject flow — quiet
  mark = sentCount();
  const rej = await admApi.call('POST', '/api/rider-applications', {
    fullName: 'Seed Rider Fiftyfour', email: 'seedrider54@kozy-test.example', phone: '+2348031230055',
    address: '1 Falomo Bridge Rd', lga: 'Lekki', bikeModel: 'Honda Ace', bikeYear: '2020',
    licenseNumber: 'LAG-1122334', availability: 'part-time', consent: true,
  });
  await waitForSends(mark + 2); // confirmation + admin alert for the new application
  const rejRow = (await admApi.call('GET', '/api/rider-applications')).data.applications.find((a) => a.email === 'seedrider54@kozy-test.example');
  mark = sentCount();
  r = await admApi.call('POST', `/api/rider-applications/${rejRow.id}/decision`, {
    action: 'reject', note: 'Licence expired — reapply once renewed.',
  });
  await sleep(3000);
  log('C11 rejection is QUIET (no email to applicant)', r.status === 200 && sentCount() === mark, `status ${r.status}, sends ${mark}->${sentCount()}`);
  const rejStatus = sql(`SELECT status, "decisionNote" FROM "RiderApplication" WHERE email='seedrider54@kozy-test.example';`);
  log('C12 rejection stored with internal note', rejStatus.includes('REJECTED') && rejStatus.includes('Licence expired'), rejStatus);

  // the new rider is assignable — appears in the users list the order modal uses
  r = await admApi.call('GET', '/api/users?fetchAll=true');
  const inUsers = (r.data?.items || r.data || []).some?.((u) => u.email === RIDER_EMAIL && u.role === 'DRIVER');
  log('C13 new rider visible to driver-assignment dropdown', !!inUsers);

  // ================= D. UI =================
  console.log('\n--- D. UI surfaces ---');
  const anonCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const pub = await anonCtx.newPage();
  pub.on('pageerror', (e) => errors.push('pub: ' + String(e)));
  await pub.goto(`${BASE}/join-riders`, { waitUntil: 'domcontentloaded' });
  await sleep(1000);
  const stepCount = await pub.locator('text=How onboarding works').count();
  const applyStep = await pub.locator('text=Apply').count();
  const welcomeStep = await pub.locator('text=Welcome email').count();
  log('D1 /join-riders shows the 4-step onboarding strip',
    stepCount === 1 && applyStep >= 1 && welcomeStep >= 1, `strip=${stepCount}`);

  // live submit through the real form
  mark = sentCount();
  await pub.fill('#fullName', 'Ifeoma Eze');
  await pub.fill('#phone', '+2348031230056');
  await pub.fill('#email', 'ifeoma54@kozy-test.example');
  await pub.fill('#altPhone', '+2348055550001');
  await pub.fill('#address', '3B Fola Osibo, Lekki Phase 1');
  await pub.fill('#lga', 'Lekki');
  await pub.fill('#bikeModel', 'TVS Star');
  await pub.fill('#bikeYear', '2021');
  await pub.fill('#licenseNumber', 'LAG-9988776');
  await pub.locator('label:has-text("Contract Agreement")').first().click();
  await pub.click('button:has-text("Submit Application")');
  const successH = pub.locator('text=Application received!');
  for (let i = 0; i < 20 && (await successH.count()) === 0; i++) await sleep(500);
  const refChip = await pub.locator('.font-mono').first().textContent().catch(() => '');
  await waitForSends(mark + 2);
  log('D2 form submits end-to-end with visible refCode',
    (await successH.count()) === 1 && /^KZR-/.test((refChip || '').trim()) && sentCount() === mark + 2,
    `ref ${(refChip || '').trim()}, ${mark}->${sentCount()}`);
  await anonCtx.close();

  // admin console: Riders tab
  await adm.page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
  const ridersTab = adm.page.locator('button:has-text("Riders")').first();
  for (let i = 0; i < 30 && (await ridersTab.count()) === 0; i++) await sleep(500);
  log('D3 admin console has the Riders tab', (await ridersTab.count()) >= 1);
  await ridersTab.click();
  const appHeading = adm.page.locator('text=Applications').first();
  for (let i = 0; i < 30 && (await appHeading.count()) === 0; i++) await sleep(500);
  const tundeCard = adm.page.locator('text=Tunde Balogun').first();
  const rosterHeading = adm.page.locator('text=Rider roster').first();
  for (let i = 0; i < 30 && (await rosterHeading.count()) === 0; i++) await sleep(500);
  log('D4 Riders tab renders pipeline + roster',
    (await appHeading.count()) >= 1 && (await tundeCard.count()) >= 1 && (await rosterHeading.count()) >= 1);

  // staff console: Riders tab must be ABSENT
  await stf.page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
  await sleep(2500);
  const staffSeesRiders = await stf.page.locator('button:has-text("Riders")').count();
  log('D5 staff does NOT see the Riders tab', staffSeesRiders === 0, `count ${staffSeesRiders}`);

  // order modal: Ask the customer composer (order B, still REQUESTED on the board)
  await adm.page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
  const ordersTab = adm.page.locator('button:has-text("Orders")').first();
  for (let i = 0; i < 40 && (await ordersTab.count()) === 0; i++) await sleep(500);
  await ordersTab.click();
  const orderCard = adm.page.locator('text=#KZ-540002').first();
  for (let i = 0; i < 40 && (await orderCard.count()) === 0; i++) await sleep(500);
  await orderCard.click();
  const askBtn = adm.page.locator('button:has-text("Ask the customer")').first();
  for (let i = 0; i < 30 && (await askBtn.count()) === 0; i++) await sleep(500);
  log('D6 order modal has the Ask button', (await askBtn.count()) >= 1);
  await askBtn.click();
  const composer = adm.page.locator('textarea').first();
  for (let i = 0; i < 20 && (await composer.count()) === 0; i++) await sleep(300);
  mark = sentCount();
  await composer.fill('We found a second white shirt in the bag — is it yours so we include it?');
  await adm.page.click('button:has-text("Send question")');
  const sentToast = adm.page.locator('text=Question sent').first();
  for (let i = 0; i < 20 && (await sentToast.count()) === 0; i++) await sleep(500);
  await waitForSends(mark + 1);
  log('D7 composer sends from the modal (toast + email)',
    (await sentToast.count()) >= 1 && sentCount() === mark + 1, `${mark}->${sentCount()}`);

  // rate limit on order C: five invalid + the sixth blocked, no emails
  const beforeRL = sentCount();
  let rl400 = 0, rl429 = 0;
  for (let i = 0; i < 6; i++) {
    const rr = await admApi.call('POST', `/api/orders/${ORDER_C}/message`, { question: 'short one' });
    if (rr.status === 400) rl400++;
    if (rr.status === 429) rl429++;
  }
  log('D8 per-order rate limit (5 then 429)', rl400 === 5 && rl429 === 1, `400x${rl400}, 429x${rl429}`);
  log('D9 rate-limited probes sent no emails', sentCount() === beforeRL, `${beforeRL}->${sentCount()}`);

  // ================= E. GLOBAL GUARANTEES =================
  console.log('\n--- E. global guarantees ---');
  log('E1 every send targeted the override inbox only', onlyOverrideInbox(), `${sentCount()} sends`);
  log('E2 zero send failures in the dev log', noSendFailures());
  log('E3 zero page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

  // cleanup: detach applications from the rider account first (FK), then
  // remove all QA rows so the DB returns to pristine for the next run.
  sql(`
    UPDATE "RiderApplication" SET "userId" = NULL, "reviewedById" = NULL
      WHERE "userId" IN (SELECT id FROM "User" WHERE email IN ('${RIDER_EMAIL}','staff54@kozy-test.example'))
         OR "reviewedById" IN (SELECT id FROM "User" WHERE email IN ('${RIDER_EMAIL}','staff54@kozy-test.example'));
    DELETE FROM "StatusEvent" WHERE "orderId" IN ('${ORDER_A}','${ORDER_B}','${ORDER_C}');
    DELETE FROM "Order" WHERE id IN ('${ORDER_A}','${ORDER_B}','${ORDER_C}');
    DELETE FROM "RiderApplication" WHERE email IN ('${RIDER_EMAIL}','seedrider54@kozy-test.example','ifeoma54@kozy-test.example');
    DELETE FROM "User" WHERE email IN ('${RIDER_EMAIL}','staff54@kozy-test.example');
    DELETE FROM "NotificationEvent" WHERE type = 'RIDER_DECISION';
  `);

  await browser.close();
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail > 0 ? 1 : 0);
})();
