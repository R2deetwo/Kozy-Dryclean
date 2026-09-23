// Phase 52 QA — milestone feedback + silent referrals + admin feedback alerts:
//   A. /api/referrals contract (401s, token auth)
//   B. 10th DELIVERED -> milestone email fires once, code minted, lastMilestoneSent=1
//   C. Friend redeems the code at checkout (validate preview + POST pricing +
//      ReferralRedemption row + admin REFERRAL_REDEEMED event)
//   D. Friend's order delivered -> referrer credit granted once (+thank-you email)
//   E. Referrer's next order -> credit auto-applied, balance decremented
//   F. Review submitted -> REVIEW admin event + email attempts
//   G. /milestone page: token works, form submits -> Feedback row + FEEDBACK
//      event; bad token handled; portal card silent below 10, visible at 10+
// Dev-mode rules (phase-50 lessons): domcontentloaded + sleep, never networkidle;
// run server + QA in one bash invocation. Email "sends" are counted via the
// dev-log "skipping email send" lines (BREVO_API_KEY unset in dev).
const { chromium } = require('playwright');
const { execSync } = require('child_process');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const BASE = 'http://localhost:3000';
const PSQL = '/home/z/my-project/work/pgvenv/lib/python3.12/site-packages/pgserver/pginstall/bin/psql';
const LOG = '/home/z/my-project/work/p52-dev.log';
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
const emailAttempts = () => {
  try {
    return (require('fs').readFileSync(LOG, 'utf8').match(/skipping email send/g) || []).length;
  } catch { return 0; }
};

// HMAC milestone token — same recipe as src/lib/referrals.ts
function milestoneToken(userId) {
  const payload = Buffer.from(JSON.stringify({ u: userId })).toString('base64url');
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

(async () => {
  const errors = [];
  const browser = await chromium.launch();

  // ================= SETUP: test users + 10th pending order =================
  const amakaHash = bcrypt.hashSync('Phase52!Amaka2026', 10);
  const friendHash = bcrypt.hashSync('Phase52!Friend2026', 10);
  sql(`
    DELETE FROM "ReferralRedemption"; DELETE FROM "ReferralCode";
    DELETE FROM "Review" WHERE "userId" IN (SELECT id FROM "User" WHERE email IN ('amaka52@kozy-test.example','friend52@kozy-test.example'));
    DELETE FROM "Feedback" WHERE email IN ('amaka52@kozy-test.example','friend52@kozy-test.example');
    DELETE FROM "Order" WHERE "userId" IN (SELECT id FROM "User" WHERE email IN ('amaka52@kozy-test.example','friend52@kozy-test.example'));
    DELETE FROM "User" WHERE email IN ('amaka52@kozy-test.example','friend52@kozy-test.example');
    INSERT INTO "User" (id, email, name, phone, role, "passwordHash", "emailVerified", "signupDiscountUsed", "lastMilestoneSent", "referralCredit", "createdAt", "updatedAt")
    VALUES ('amaka52id0000000000000000', 'amaka52@kozy-test.example', 'Amaka Test', '+2348030000052', 'B2C', '${amakaHash}', now(), true, 0, 0, now(), now()),
           ('friend52id0000000000000000', 'friend52@kozy-test.example', 'Friend Test', '+2348030000053', 'B2C', '${friendHash}', now(), false, 0, 0, now(), now())
    ON CONFLICT (email) DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash", name = EXCLUDED.name,
      "signupDiscountUsed" = EXCLUDED."signupDiscountUsed", "lastMilestoneSent" = EXCLUDED."lastMilestoneSent",
      "referralCredit" = EXCLUDED."referralCredit";
  `);
  // 9 delivered orders (history) + 1 REQUESTED (the 10th, admin will deliver it)
  const baseOrder = (n, status) => `
    INSERT INTO "Order" (id, "orderNumber", "userId", status, type, "guaranteeActive", "serviceSpeed", "itemsManifest", "pickupAddress", "pickupDate", "pickupTimeSlot", "totalPrice", "deliveredAt", "createdAt", "updatedAt")
    VALUES ('qa52ord${String(n).padStart(3, '0')}', 'KZ-52000${n}', 'amaka52id0000000000000000', '${status}', 'ITEM', false, 'STANDARD', '[]', '12 Alexander Ave, Ikoyi', now(), '09:00 - 10:00', 5000, ${status === 'DELIVERED' ? 'now()' : 'NULL'}, now(), now());`;
  let seedSql = '';
  for (let i = 1; i <= 9; i++) seedSql += baseOrder(i, 'DELIVERED');
  seedSql += baseOrder(10, 'REQUESTED');
  sql(seedSql);
  sql(`DELETE FROM "NotificationEvent" WHERE type IN ('REVIEW','REFERRAL_REDEEMED');`);

  const ADMINS = 2; // admin_alerts_email has 2 recipients -> 2 lines per admin alert

  // ================= A. API CONTRACTS =================
  {
    const r1 = await fetch(`${BASE}/api/referrals`);
    log('A1 referrals: no session/token -> 401', r1.status === 401, `status ${r1.status}`);
    const r2 = await fetch(`${BASE}/api/referrals?token=not.a.token`);
    log('A2 referrals: bad token -> 401', r2.status === 401, `status ${r2.status}`);
  }

  // ================= admin + customer browser contexts =================
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
  await ama.fill('#email', 'amaka52@kozy-test.example');
  await ama.fill('#password', 'Phase52!Amaka2026');
  await ama.click('button[type="submit"]');
  for (let i = 0; i < 40 && ama.url().includes('/login'); i++) await sleep(500);
  log('referrer logged in', !ama.url().includes('/login'), ama.url());

  const friCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const fri = await friCtx.newPage();
  fri.on('pageerror', (e) => errors.push('fri: ' + String(e)));
  await fri.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await sleep(1500);
  await fri.fill('#email', 'friend52@kozy-test.example');
  await fri.fill('#password', 'Phase52!Friend2026');
  await fri.click('button[type="submit"]');
  for (let i = 0; i < 40 && fri.url().includes('/login'); i++) await sleep(500);
  log('friend logged in', !fri.url().includes('/login'), fri.url());

  // Silence BEFORE the milestone: Amaka has 9 delivered — not eligible yet
  const preState = await ama.evaluate(async () => {
    const r = await fetch('/api/referrals');
    return { status: r.status, data: await r.json() };
  });
  log('B0 below milestone: eligible=false, no code',
    preState.status === 200 && preState.data.eligible === false && preState.data.code === null,
    JSON.stringify({ eligible: preState.data.eligible, code: preState.data.code, count: preState.data.deliveredCount }));

  // ================= B. THE 10th DELIVERY -> MILESTONE =================
  const before = emailAttempts();
  const patch = await adm.evaluate(async (id) => {
    const r = await fetch(`/api/orders/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'DELIVERED' }),
    });
    return r.status;
  }, 'qa52ord010');
  await sleep(3500); // after(): delivery email + milestone email
  const afterB = emailAttempts();
  log('B1 10th delivery PATCH ok', patch === 200, `status ${patch}`);
  log('B2 delivery + milestone emails fired (+2 attempts)',
    afterB === before + 2, `${before} -> ${afterB}`);

  const lastMs = sql(`SELECT "lastMilestoneSent" FROM "User" WHERE id='amaka52id0000000000000000';`);
  log('B3 lastMilestoneSent=1 (once-only guard set)', lastMs === '1', lastMs);
  const codeRow = sql(`SELECT code FROM "ReferralCode" WHERE "userId"='amaka52id0000000000000000';`);
  log('B4 referral code minted (FIRSTNAME-###)', /^AMAKA-\d{3}$/.test(codeRow), codeRow);
  const deliveredCount = sql(`SELECT count(*) FROM "Order" WHERE "userId"='amaka52id0000000000000000' AND status='DELIVERED';`);
  log('B5 delivered count is now 10', deliveredCount === '10', deliveredCount);

  // repeat PATCH (status already DELIVERED) must NOT re-fire anything
  const beforeRepeat = emailAttempts();
  await adm.evaluate(async (id) => {
    const r = await fetch(`/api/orders/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'DELIVERED' }),
    });
    return r.status;
  }, 'qa52ord010');
  await sleep(2500);
  log('B6 repeat DELIVERED patch: no re-send (deliveredAt guard)',
    emailAttempts() === beforeRepeat, `${beforeRepeat} -> ${emailAttempts()}`);

  // referrals API now reports eligibility + the code (session AND token)
  const amaState = await ama.evaluate(async () => {
    const r = await fetch('/api/referrals');
    return await r.json();
  });
  log('B7 referrals API: eligible, code, credit 0',
    amaState.eligible === true && amaState.code === codeRow && amaState.credit === 0 &&
    amaState.deliveredCount === 10 && amaState.friendDiscountPercent === 10 && amaState.rewardAmount === 2000,
    JSON.stringify({ eligible: amaState.eligible, code: amaState.code, credit: amaState.credit }));

  // ================= C. FRIEND REDEEMS AT CHECKOUT =================
  const subtotal = 1000; // 2 shirts x 500
  const val1 = await fetch(`${BASE}/api/marketing/coupons/validate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: codeRow, serviceSubtotal: subtotal, email: 'friend52@kozy-test.example' }),
  }).then((r) => r.json());
  log('C1 validate: referral preview valid, 10% = 100',
    val1.valid === true && val1.type === 'PERCENTAGE' && val1.value === 10 && val1.discountAmount === 100,
    JSON.stringify(val1));

  const valSelf = await fetch(`${BASE}/api/marketing/coupons/validate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: codeRow, serviceSubtotal: subtotal, email: 'amaka52@kozy-test.example' }),
  }).then((r) => r.json());
  log('C2 validate: own code rejected with a graceful message',
    valSelf.valid === false && /your own code/i.test(valSelf.message || ''),
    JSON.stringify(valSelf));

  // friend books via the API with the code (2 shirts, machine, PAYSTACK)
  const bookBefore = emailAttempts();
  const booked = await fri.evaluate(async (code) => {
    const r = await fetch('/api/orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'ITEM',
        items: [{ id: 'shirt', name: 'Shirt', quantity: 2 }],
        modeOfWash: 'MACHINE',
        serviceSpeed: 'STANDARD',
        pickupAddress: '5 Bourdillon Rd, Ikoyi',
        pickupDate: '2026-09-25',
        pickupTimeSlot: '09:00 - 10:00',
        paymentMethod: 'PAYSTACK',
        promoCode: code,
      }),
    });
    return { status: r.status, data: await r.json() };
  }, codeRow);
  await sleep(3500); // after(): order email + admin alert + referral admin alert
  // expected: service 1000, online 5% -> 950, referral flat 100 -> 850, delivery free
  log('C3 friend order placed with the code',
    booked.status === 201 || booked.status === 200, `status ${booked.status}`);
  log('C4 pricing: 950 - 100 referral = 850',
    booked.data.order && booked.data.order.totalPrice === 850,
    `total ${booked.data.order && booked.data.order.totalPrice}`);
  log('C5 promoCode recorded on the order',
    booked.data.order && booked.data.order.promoCode === codeRow,
    booked.data.order && booked.data.order.promoCode);
  const friendOrderId = booked.data.order && booked.data.order.id;

  const red = sql(`SELECT r."friendDiscountAmount", r."rewardGrantedAt", c.code FROM "ReferralRedemption" r JOIN "ReferralCode" c ON c.id=r."codeId" WHERE r."orderId"='${friendOrderId}';`);
  log('C6 ReferralRedemption row created (100 naira courtesy)',
    red === '100||' + codeRow || /^100\|\|/.test(red), red);

  const ev = sql(`SELECT count(*) FROM "NotificationEvent" WHERE type='REFERRAL_REDEEMED';`);
  log('C7 admin REFERRAL_REDEEMED event recorded', ev === '1', ev);
  // booking emails: order-created (1) + admin new-order (2) + admin referral (2) = 5
  log('C8 booking notifications fired (1 customer + 2 admin alerts x2 recipients = 5)',
    emailAttempts() === bookBefore + 1 + 2 * ADMINS,
    `${bookBefore} -> ${emailAttempts()}`);

  // ================= D. FRIEND'S DELIVERY -> REWARD GRANT =================
  const dBefore = emailAttempts();
  const dPatch = await adm.evaluate(async (id) => {
    const r = await fetch(`/api/orders/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'DELIVERED' }),
    });
    return r.status;
  }, friendOrderId);
  await sleep(3500);
  log('D1 friend order DELIVERED', dPatch === 200, `status ${dPatch}`);
  const credit = sql(`SELECT "referralCredit" FROM "User" WHERE id='amaka52id0000000000000000';`);
  log('D2 referrer credit granted: 2000', credit === '2000', credit);
  const granted = sql(`SELECT "rewardGrantedAt" IS NOT NULL FROM "ReferralRedemption" WHERE "orderId"='${friendOrderId}';`);
  log('D3 redemption marked rewarded (once-only guard)', granted === 't', granted);
  log('D4 delivery email + thank-you email fired (+2)',
    emailAttempts() === dBefore + 2, `${dBefore} -> ${emailAttempts()}`);

  // repeat PATCH: no double grant, no extra emails
  const dBefore2 = emailAttempts();
  await adm.evaluate(async (id) => {
    const r = await fetch(`/api/orders/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'DELIVERED' }),
    });
    return r.status;
  }, friendOrderId);
  await sleep(2500);
  const credit2 = sql(`SELECT "referralCredit" FROM "User" WHERE id='amaka52id0000000000000000';`);
  log('D5 repeat PATCH: no double grant, no extra email',
    credit2 === '2000' && emailAttempts() === dBefore2, `credit ${credit2}, emails ${dBefore2} -> ${emailAttempts()}`);

  // ================= E. REFERRER SPENDS THE CREDIT =================
  // (credit line visible on the portal BEFORE it is spent — balance is 2000 now)
  await ama.goto(`${BASE}/portal`, { waitUntil: 'domcontentloaded' });
  await sleep(2500);
  log('D6 portal card: credit line while balance > 0',
    (await ama.locator('text=/thank-you credit waiting/').count()) === 1);

  const booked2 = await ama.evaluate(async () => {
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
  await sleep(2500);
  // expected: service 5000, online 5% -> 4750, credit 2000 -> 2750, delivery 1500 (not free)
  log('E1 referrer order placed', booked2.status === 201 || booked2.status === 200, `status ${booked2.status}`);
  log('E2 credit auto-applied: 4750 - 2000 + 1500 delivery = 4250',
    booked2.data.order && booked2.data.order.totalPrice === 4250,
    `total ${booked2.data.order && booked2.data.order.totalPrice}`);
  const creditLeft = sql(`SELECT "referralCredit" FROM "User" WHERE id='amaka52id0000000000000000';`);
  log('E3 credit balance back to 0', creditLeft === '0', creditLeft);

  // ================= F. REVIEW -> ADMIN ALERT =================
  const fBefore = emailAttempts();
  const review = await fetch(`${BASE}/api/reviews`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderId: friendOrderId,
      rating: 5,
      comment: 'Immaculate finish and the rider was right on time. This is how dry cleaning should feel.',
    }),
  });
  await sleep(2500);
  log('F1 review submitted (201)', review.status === 201, `status ${review.status}`);
  const revEv = sql(`SELECT count(*) FROM "NotificationEvent" WHERE type='REVIEW';`);
  log('F2 REVIEW admin event recorded', revEv === '1', revEv);
  log('F3 review admin email fired (2 recipients)', emailAttempts() === fBefore + ADMINS,
    `${fBefore} -> ${emailAttempts()}`);

  // ================= G. /milestone PAGE + PORTAL CARD =================
  const token = milestoneToken('amaka52id0000000000000000');
  const mileCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const mile = await mileCtx.newPage();
  mile.on('pageerror', (e) => errors.push('milestone: ' + String(e)));
  await mile.goto(`${BASE}/milestone?token=${encodeURIComponent(token)}`, { waitUntil: 'domcontentloaded' });
  await sleep(2000);
  log('G1 milestone page: heading "Ten orders."',
    (await mile.locator('h1:has-text("Ten orders.")').count()) === 1);
  log('G2 general feedback form present',
    (await mile.locator('text=How has the whole experience felt?').count()) === 1);
  log('G3 referral reveal with the code',
    (await mile.locator(`text=${codeRow}`).count()) >= 1);
  log('G4 copy button present',
    (await mile.locator('button[aria-label="Copy your referral code"]').count()) === 1);

  // submit the milestone feedback
  await mile.locator('button[aria-label="Rate 5 stars"]').click();
  await mile.fill('#standout', 'The consistency. Ten orders in and every shirt comes back the same — impeccable.');
  await mile.click('button:has-text("Share your thoughts")');
  for (let i = 0; i < 20 && (await mile.locator('h1:has-text("Thank you — truly.")').count()) === 0; i++) await sleep(500);
  log('G5 submitted state reached', (await mile.locator('h1:has-text("Thank you — truly.")').count()) === 1);
  const fb = sql(`SELECT type, reference, rating FROM "Feedback" WHERE email='amaka52@kozy-test.example' ORDER BY "createdAt" DESC LIMIT 1;`);
  log('G6 Feedback row: REVIEW / Milestone reference / 5 stars',
    fb.startsWith('REVIEW|Milestone — 10 orders|5'), fb);
  const fbEv = sql(`SELECT count(*) FROM "NotificationEvent" WHERE type='FEEDBACK' AND title ILIKE '%amaka%';`);
  log('G7 FEEDBACK admin event recorded', parseInt(fbEv) >= 1, fbEv);

  // bad token
  await mile.goto(`${BASE}/milestone?token=garbage.sig`, { waitUntil: 'domcontentloaded' });
  await sleep(1500);
  log('G8 bad token: graceful error state',
    (await mile.locator('h1:has-text("isn\'t working")').count()) === 1 ||
    (await mile.locator('text=expired').count()) >= 1);

  // portal card: visible for Amaka (10 delivered)
  await ama.goto(`${BASE}/portal`, { waitUntil: 'domcontentloaded' });
  await sleep(2500);
  log('G9 portal: quiet referral card visible for 10+ customer',
    (await ama.locator('text=A quiet way to share the care').count()) === 1);
  log('G10 portal card shows the code + friends-courtesy line (credit spent in E)',
    (await ama.locator(`text=${codeRow}`).count()) >= 1 &&
    (await ama.locator('text=/Friends get 10% off/').count()) === 1);

  // portal silence for a below-milestone customer (customer40: 0 delivered)
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
  log('G11 portal: NO referral card below the milestone (silent)',
    (await small.locator('text=A quiet way to share the care').count()) === 0);
  log('G12 no hint of a referral program anywhere on their portal',
    (await small.locator('text=/referral/i').count()) === 0);

  // public site silence: home has no referral mention
  await small.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await sleep(2000);
  const homeSilent = await small.locator('text=/referral|refer a friend|invite/i').count();
  log('G13 public home: zero referral mentions', homeSilent === 0, `${homeSilent}`);

  log('ZERO page errors', errors.length === 0, errors.slice(0, 4).join(' | '));

  console.log(`\n===== ${pass} PASS / ${fail} FAIL =====`);
  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => {
  console.error('QA crashed:', e);
  process.exit(2);
});
