// Phase 53 EMAIL SYSTEM TEST — the owner watches the whole email pipeline
// land in ONE inbox (practiceprosystems@gmail.com), via EMAIL_OVERRIDE_TO.
//
// What the owner sees in their inbox, in order:
//   1. Booking confirmation (10th order)          — what a customer sees
//   2. New order alert (admin)                     — what the admins see
//   3. Delivered — how did we do? (feedback ask)   — fires on "received"
//   4. Ten services — your next one is on us       — milestone + loyalty
//   5. New review alert (admin)                    — feedback saved + emailed
//   6. Milestone-page feedback alert (admin)       — relationship feedback
//   7. Booking confirmed — with our compliments    — the 11th, FREE (₦0)
//   8. New order alert, complimentary (admin)
//   9. Delivered — feedback ask (the complimentary order)
//
// Hard guarantees asserted:
//   - EVERY [brevo] sent line targets practiceprosystems@gmail.com ONLY
//   - no "Brevo send failed" / notify-failed lines in the dev log
//   - the review + milestone feedback are SAVED in the DB (Review / Feedback
//     rows) and their NotificationEvents are emailStatus=SENT
//   - loyalty arithmetic: 10 paid washes → unlocked; the 11th order is ₦0
//     with loyaltyFree; after its delivery the card resets (hidden below 5)
//   - silence rules: nothing visible below 5 paid washes; zero 'referral'
//     or offline-receipt mentions anywhere
//
// Run: node scripts/p53_email_test.js  (dev server must be running with
// EMAIL_OVERRIDE_TO=practiceprosystems@gmail.com + BREVO_API_KEY — see
// scripts/p53_run_email_test.sh)
const { chromium } = require('playwright');
const { execSync } = require('child_process');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const fs = require('fs');

const BASE = 'http://localhost:3000';
const PSQL = '/home/z/my-project/work/pgvenv/lib/python3.12/site-packages/pgserver/pginstall/bin/psql';
const LOG = '/home/z/my-project/work/p53-dev.log';
const MANIFEST = '/home/z/my-project/work/p53-email-manifest.txt';
const OVERRIDE_INBOX = 'practiceprosystems@gmail.com';
const TOKEN_SECRET = 'kozy-dev-secret-local-052'; // .env.local NEXTAUTH_SECRET

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

/** All [brevo] sent lines so far: [{ subject, target }] */
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

/** Every send must land in the override inbox — checked continuously. */
function onlyOverrideInbox() {
  return sentEmails().every((e) => e.target === OVERRIDE_INBOX);
}

/** Log must contain no send failures. */
function noSendFailures() {
  try {
    const text = fs.readFileSync(LOG, 'utf8');
    return !/Brevo send failed|notify\w* failed|Post-booking notifications failed/.test(text);
  } catch { return true; }
}

/** Wait until the send count reaches n (or timeout). */
async function waitForSends(n, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (sentCount() >= n) return true;
    await sleep(500);
  }
  return sentCount() >= n;
}

// HMAC milestone token — same recipe as src/lib/referrals.ts
function milestoneToken(userId) {
  const payload = Buffer.from(JSON.stringify({ u: userId })).toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}


// Seeded order ids — MUST match the SQL template below exactly.
// (The trailing semicolon is load-bearing: without it the (async…) IIFE
// below parses as a call on the template literal and silently never runs.)
const seedOrderId = (n) => `qa53a${String(n).padStart(3, '0')}0000000000`;

(async () => {
  const errors = [];
  const browser = await chromium.launch();

  // ================= SETUP: Amaka (9 delivered + 1 requested) + Chidi (5) =================
  const amakaHash = bcrypt.hashSync('Phase53!Amaka2026', 10);
  const chidiHash = bcrypt.hashSync('Phase53!Chidi2026', 10);
  sql(`
    DELETE FROM "Review" WHERE "userId" IN (SELECT id FROM "User" WHERE email IN ('amaka53@kozy-test.example','chidi53@kozy-test.example'));
    DELETE FROM "Feedback" WHERE email IN ('amaka53@kozy-test.example','chidi53@kozy-test.example');
    DELETE FROM "Order" WHERE "userId" IN (SELECT id FROM "User" WHERE email IN ('amaka53@kozy-test.example','chidi53@kozy-test.example'));
    DELETE FROM "NotificationEvent" WHERE type IN ('REVIEW','FEEDBACK','NEW_ORDER');
    DELETE FROM "User" WHERE email IN ('amaka53@kozy-test.example','chidi53@kozy-test.example');
    INSERT INTO "User" (id, email, name, phone, role, "passwordHash", "emailVerified", "signupDiscountUsed", "lastMilestoneSent", "referralCredit", "createdAt", "updatedAt")
    VALUES ('amaka53id0000000000000000', 'amaka53@kozy-test.example', 'Amaka Test', '+2348030000053', 'B2C', '${amakaHash}', now(), true, 0, 0, now(), now()),
           ('chidi53id0000000000000000', 'chidi53@kozy-test.example', 'Chidi Test', '+2348030000054', 'B2C', '${chidiHash}', now(), true, 0, 0, now(), now())
    ON CONFLICT (email) DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash", name = EXCLUDED.name;
  `);
  // Amaka: 9 delivered history + 1 REQUESTED (the 10th — the admin delivers it live)
  const baseOrder = (n, status, user) => `
    INSERT INTO "Order" (id, "orderNumber", "userId", status, type, "guaranteeActive", "serviceSpeed", "itemsManifest", "pickupAddress", "pickupDate", "pickupTimeSlot", "totalPrice", "deliveredAt", "createdAt", "updatedAt")
    VALUES ('qa53a${String(n).padStart(3, '0')}0000000000', 'KZ-53000${n}', '${user}', '${status}', 'ITEM', false, 'STANDARD', '[]', '12 Alexander Ave, Ikoyi', now(), '09:00 - 10:00', 5000, ${status === 'DELIVERED' ? 'now()' : 'NULL'}, now(), now());`;
  let seedSql = '';
  for (let i = 1; i <= 9; i++) seedSql += baseOrder(i, 'DELIVERED', 'amaka53id0000000000000000');
  seedSql += baseOrder(10, 'REQUESTED', 'amaka53id0000000000000000');
  // Chidi: exactly 5 delivered — the countdown state ("5/10")
  for (let i = 1; i <= 5; i++) seedSql += baseOrder(20 + i, 'DELIVERED', 'chidi53id0000000000000000');
  sql(seedSql);

  // ================= browser contexts =================
  const admCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const adm = await admCtx.newPage();
  adm.on('pageerror', (e) => errors.push('adm: ' + String(e)));
  await adm.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await sleep(1500);
  await adm.fill('#email', 'admin40@kozy-test.example');
  await adm.fill('#password', 'Phase40!Admin2026');
  await adm.click('button[type="submit"]');
  for (let i = 0; i < 40 && adm.url().includes('/login'); i++) await sleep(500);
  log('admin logged in', !adm.url().includes('/login'), adm.url());

  const amaCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const ama = await amaCtx.newPage();
  ama.on('pageerror', (e) => errors.push('ama: ' + String(e)));
  await ama.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await sleep(1500);
  await ama.fill('#email', 'amaka53@kozy-test.example');
  await ama.fill('#password', 'Phase53!Amaka2026');
  await ama.click('button[type="submit"]');
  for (let i = 0; i < 40 && ama.url().includes('/login'); i++) await sleep(500);
  log('customer (Amaka) logged in', !ama.url().includes('/login'), ama.url());

  // ================= A. THE 10th DELIVERY -> FEEDBACK ASK + MILESTONE =================
  const before = sentCount();
  const patch = await adm.evaluate(async (id) => {
    const r = await fetch(`/api/orders/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'DELIVERED' }),
    });
    return r.status;
  }, seedOrderId(10));
  // after(): delivery feedback email + milestone email (2 sends)
  await waitForSends(before + 2, 20000);
  const afterA = sentCount();
  log('A1 10th delivery PATCH ok', patch === 200, `status ${patch}`);
  log('A2 delivery feedback email + milestone email sent (+2)',
    afterA >= before + 2, `${before} -> ${afterA}`);
  log('A3 milestone subject mentions "your next one is on us"',
    sentEmails().some((e) => /next one is on us/i.test(e.subject)),
    sentEmails().filter((e) => /services with Kozy/i.test(e.subject)).map((e) => e.subject).join(' | ') || 'none');
  log('A4 delivery feedback email sent ("how did we do?")',
    sentEmails().some((e) => /how did we do/i.test(e.subject)));

  const lastMs = sql(`SELECT "lastMilestoneSent" FROM "User" WHERE id='amaka53id0000000000000000';`);
  log('A5 lastMilestoneSent=1 (once-only guard set)', lastMs === '1', lastMs);

  // repeat PATCH must NOT re-send anything
  const beforeRepeat = sentCount();
  await adm.evaluate(async (id) => {
    await fetch(`/api/orders/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'DELIVERED' }),
    });
  }, seedOrderId(10));
  await sleep(4000);
  log('A6 repeat DELIVERED patch: no re-send', sentCount() === beforeRepeat, `${beforeRepeat} -> ${sentCount()}`);

  // ================= B. REVIEW -> SAVED + ADMIN EMAIL =================
  const bBefore = sentCount();
  const review = await fetch(`${BASE}/api/reviews`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderId: seedOrderId(10),
      rating: 5,
      comment: 'Immaculate finish and the rider was right on time. This is how dry cleaning should feel.',
    }),
  });
  await waitForSends(bBefore + 1, 15000);
  log('B1 review submitted (201)', review.status === 201, `status ${review.status}`);
  const savedReview = sql(`SELECT rating, "isApproved" FROM "Review" WHERE "orderId"='${seedOrderId(10)}';`);
  log('B2 review SAVED in the database (5 stars, auto-approved)', savedReview.startsWith('5|t'), savedReview);
  const revEv = sql(`SELECT type, "emailStatus" FROM "NotificationEvent" WHERE type='REVIEW' ORDER BY "createdAt" DESC LIMIT 1;`);
  log('B3 REVIEW admin event recorded, emailStatus=SENT', revEv === 'REVIEW|SENT', revEv);
  log('B4 review admin email sent (what the admins see)',
    sentEmails().some((e) => /New review/i.test(e.subject)),
    sentEmails().filter((e) => /review/i.test(e.subject)).map((e) => e.subject).join(' | ') || 'none');

  // ================= C. PORTAL: LOYALTY UNLOCKED =================
  await ama.goto(`${BASE}/portal`, { waitUntil: 'domcontentloaded' });
  await sleep(2500);
  log('C1 portal: unlocked loyalty card visible',
    (await ama.locator('text=Your next service is on the house').count()) === 1);
  log('C2 portal: no referral traces (the program is dormant)',
    (await ama.locator('text=/referral|personal code|friends get/i').count()) === 0);

  // ================= D. MILESTONE PAGE -> RELATIONSHIP FEEDBACK -> ADMIN EMAIL =================
  const token = milestoneToken('amaka53id0000000000000000');
  const mileCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const mile = await mileCtx.newPage();
  mile.on('pageerror', (e) => errors.push('milestone: ' + String(e)));
  await mile.goto(`${BASE}/milestone?token=${encodeURIComponent(token)}`, { waitUntil: 'domcontentloaded' });
  await sleep(2000);
  log('D1 milestone page: heading "Ten services."',
    (await mile.locator('h1:has-text("Ten services.")').count()) === 1);
  log('D2 loyalty reveal: "The next one is on us"',
    (await mile.locator('text=The next one is on us').count()) >= 1);
  log('D3 general feedback form present',
    (await mile.locator('text=How has the whole experience felt?').count()) === 1);
  log('D4 no referral code anywhere on the page',
    (await mile.locator('text=/referral|personal code/i').count()) === 0);

  const dBefore = sentCount();
  await mile.locator('button[aria-label="Rate 5 stars"]').click();
  await mile.fill('#standout', 'The consistency. Ten services in and every shirt comes back the same — impeccable.');
  await mile.click('button:has-text("Share your thoughts")');
  for (let i = 0; i < 20 && (await mile.locator('h1:has-text("Thank you — truly.")').count()) === 0; i++) await sleep(500);
  await waitForSends(dBefore + 1, 15000);
  log('D5 milestone feedback submitted', (await mile.locator('h1:has-text("Thank you — truly.")').count()) === 1);
  const fb = sql(`SELECT type, reference, rating FROM "Feedback" WHERE email='amaka53@kozy-test.example' ORDER BY "createdAt" DESC LIMIT 1;`);
  log('D6 Feedback row SAVED (REVIEW / Milestone — 10 services / 5)',
    fb.startsWith('REVIEW|Milestone — 10 services|5'), fb);
  const fbEv = sql(`SELECT "emailStatus" FROM "NotificationEvent" WHERE type='FEEDBACK' ORDER BY "createdAt" DESC LIMIT 1;`);
  log('D7 FEEDBACK admin event, emailStatus=SENT', fbEv === 'SENT', fbEv);
  log('D8 feedback admin email sent',
    sentEmails().some((e) => /new (review|feedback) from amaka/i.test(e.subject)),
    sentEmails().filter((e) => /amaka/i.test(e.subject)).map((e) => e.subject).join(' | ') || 'none');

  // ================= E. THE 11th ORDER — FREE =================
  const eBefore = sentCount();
  const booked = await ama.evaluate(async () => {
    const r = await fetch('/api/orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'ITEM',
        items: [{ id: 'blazer', name: 'Blazer', quantity: 2 }],
        modeOfWash: 'MACHINE',
        serviceSpeed: 'STANDARD',
        pickupAddress: '12 Alexander Ave, Ikoyi',
        pickupDate: '2026-09-26',
        pickupTimeSlot: '09:00 - 10:00',
        paymentMethod: 'PAYSTACK',
      }),
    });
    return { status: r.status, data: await r.json() };
  });
  // after(): complimentary booking confirmation (1) + admin new-order alert (1)
  await waitForSends(eBefore + 2, 20000);
  const freeOrder = booked.data.order;
  log('E1 the 11th order placed', booked.status === 201 || booked.status === 200, `status ${booked.status}`);
  log('E2 priced at ZERO (loyalty free wash)',
    freeOrder && freeOrder.totalPrice === 0, `total ${freeOrder && freeOrder.totalPrice}`);
  log('E3 flagged loyaltyFree on the order',
    freeOrder && freeOrder.loyaltyFree === true, `loyaltyFree ${freeOrder && freeOrder.loyaltyFree}`);
  log('E4 complimentary confirmation email ("with our compliments")',
    sentEmails().some((e) => /with our compliments/i.test(e.subject)),
    sentEmails().filter((e) => /booking is confirmed/i.test(e.subject)).map((e) => e.subject).join(' | ') || 'none');
  log('E5 admin alerted the new order is on the house',
    sentEmails().some((e) => /new order #kz/i.test(e.subject)),
    sentEmails().filter((e) => /new order/i.test(e.subject)).map((e) => e.subject).join(' | ') || 'none');
  const noPayment = sql(`SELECT count(*) FROM "Payment" p JOIN "Order" o ON o.id=p."orderId" WHERE o.id='${freeOrder.id}';`);
  log('E6 no payment record (nothing to collect)', noPayment === '0', noPayment);

  // ================= F. THE FREE ORDER DELIVERED -> CARD RESETS =================
  const fBefore = sentCount();
  const fPatch = await adm.evaluate(async (id) => {
    const r = await fetch(`/api/orders/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'DELIVERED' }),
    });
    return r.status;
  }, freeOrder.id);
  await waitForSends(fBefore + 1, 20000);
  log('F1 complimentary order DELIVERED', fPatch === 200, `status ${fPatch}`);
  log('F2 delivery feedback email sent for it (+1)',
    sentCount() >= fBefore + 1, `${fBefore} -> ${sentCount()}`);
  log('F3 milestone NOT re-fired (one per card)',
    sentEmails().filter((e) => /next one is on us/i.test(e.subject)).length === 1);

  // after the free wash is delivered: paidWashes=10, freeWashes=1 → card reset
  await ama.goto(`${BASE}/portal`, { waitUntil: 'domcontentloaded' });
  await sleep(2500);
  log('F4 portal: loyalty card gone after the free service is used',
    (await ama.locator('text=Your next service is on the house').count()) === 0 &&
    (await ama.locator('text=The eleventh is on the house').count()) === 0);

  // ================= G. COUNTDOWN (5/10) + SILENCE BELOW 5 =================
  const chiCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const chi = await chiCtx.newPage();
  chi.on('pageerror', (e) => errors.push('chi: ' + String(e)));
  await chi.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await sleep(1500);
  await chi.fill('#email', 'chidi53@kozy-test.example');
  await chi.fill('#password', 'Phase53!Chidi2026');
  await chi.click('button[type="submit"]');
  for (let i = 0; i < 40 && chi.url().includes('/login'); i++) await sleep(500);
  await chi.goto(`${BASE}/portal`, { waitUntil: 'domcontentloaded' });
  await sleep(2500);
  log('G1 5 paid washes: countdown card visible ("The eleventh is on the house")',
    (await chi.locator('text=The eleventh is on the house').count()) === 1);
  log('G2 shows 5/10',
    (await chi.locator('text=Service 5 of 10').count()) === 1);
  log('G3 ten progress dots rendered',
    (await chi.locator('div[aria-hidden="true"] > span').count()) === 10);

  // below 5 (customer40: 0 delivered): nothing at all
  const smallCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const small = await smallCtx.newPage();
  small.on('pageerror', (e) => errors.push('small: ' + String(e)));
  await small.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await sleep(1500);
  await small.fill('#email', 'customer40@kozy-test.example');
  await small.fill('#password', 'Phase40!Customer2026');
  await small.click('button[type="submit"]');
  for (let i = 0; i < 40 && small.url().includes('/login'); i++) await sleep(500);
  await small.goto(`${BASE}/portal`, { waitUntil: 'domcontentloaded' });
  await sleep(2500);
  log('G4 below 5 washes: no loyalty card, no hint of any offer',
    (await small.locator('text=/eleventh|on the house|of 10|loyalty/i').count()) === 0);
  log('G5 no referral traces on the portal',
    (await small.locator('text=/referral|personal code/i').count()) === 0);

  // public site silence: home mentions neither the loyalty offer, the dormant
  // referral program, nor the OFFLINE handwritten-receipt offer
  await small.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await sleep(2000);
  const homeMentions = await small.locator('text=/eleventh|referral|refer a friend|handwritten|10 washes|tenth.*(free|compliment)/i').count();
  log('G6 public home: zero mentions of the offer (it stays private)', homeMentions === 0, `${homeMentions}`);

  // ================= H. THE ONE-INBOX GUARANTEE =================
  const all = sentEmails();
  log('H1 every single email went ONLY to ' + OVERRIDE_INBOX,
    all.length > 0 && onlyOverrideInbox(), `${all.length} emails`);
  log('H2 no send failures in the dev log', noSendFailures());
  log('H3 zero page errors', errors.length === 0, errors.slice(0, 4).join(' | '));

  // ================= manifest for the owner =================
  const lines = all.map((e, i) => `${String(i + 1).padStart(2, '0')}. ${e.subject}  →  ${e.target}`);
  fs.writeFileSync(MANIFEST, `Kozy Care — email system test (phase 53)\nEvery email below landed in ${OVERRIDE_INBOX}\n\n${lines.join('\n')}\n`);
  console.log('\n===== EMAIL MANIFEST (all → ' + OVERRIDE_INBOX + ') =====');
  console.log(lines.join('\n'));
  console.log('(saved to ' + MANIFEST + ')');

  console.log(`\n===== ${pass} PASS / ${fail} FAIL =====`);
  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => {
  console.error('Email test crashed:', e);
  process.exit(2);
});
