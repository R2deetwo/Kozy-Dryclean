// Phase 54 visual capture — the new surfaces, for VLM QA:
//   1. /join-riders desktop (hero + benefits + 4-step strip + form)
//   2. /join-riders mobile 390px (responsive check)
//   3. admin console → Riders tab (pipeline + roster, needs seeded rows)
//   4. order modal → Ask-the-customer composer (dialog open)
// Dev-server rules (phase-50/52 lessons): domcontentloaded + sleep, one
// bash invocation starts dev + seeds + captures + kills it.
const { chromium } = require('playwright');
const { execSync } = require('child_process');
const bcrypt = require('bcryptjs');

const BASE = 'http://localhost:3000';
const PSQL = '/home/z/my-project/work/pgvenv/lib/python3.12/site-packages/pgserver/pginstall/bin/psql';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function sql(statement) {
  return execSync(`${PSQL} -h 127.0.0.1 -p 54329 -U postgres -d kozy -tA`, {
    input: statement,
    env: { ...process.env, PGPASSWORD: 'postgres' },
  }).toString().trim();
}

(async () => {
  // Seed a presentable state: one PENDING application + one approved rider
  // (with a couple of delivered orders) so the roster shows real numbers.
  const riderHash = bcrypt.hashSync('Phase54!Rider2026', 10);
  sql(`
    DELETE FROM "RiderApplication" WHERE email IN ('kofi54@kozy-test.example','amir54@kozy-test.example');
    DELETE FROM "Order" WHERE id LIKE 'qa54cap%';
    DELETE FROM "User" WHERE email = 'amir54@kozy-test.example';
    INSERT INTO "User" (id, email, name, phone, role, "passwordHash", "emailVerified", "accessStatus", "createdAt", "updatedAt")
    VALUES ('amir54id0000000000000000', 'amir54@kozy-test.example', 'Amir Sadiq', '+2348031230060', 'DRIVER', '${riderHash}', now(), 'ACTIVE', now(), now())
    ON CONFLICT (email) DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash";
    INSERT INTO "RiderApplication" (id, "refCode", "fullName", email, phone, "altPhone", address, lga, "bikeModel", "bikeYear", "licenseNumber", availability, experience, consent, status, "userId", "reviewedAt", "createdAt")
    VALUES ('qa54capapp100000000000', 'KZR-8F3K', 'Kofi Mensah', 'kofi54@kozy-test.example', '+2348031230057', '+2348055550002', '7 Alexander Ave, Ikoyi', 'Ikoyi', 'Bajaj Boxer', '2023', 'LAG-5566778', 'full-time', 'Three years delivering for a Lagos pharmacy chain.', true, 'PENDING', NULL, NULL, now()),
           ('qa54capapp200000000000', 'KZR-2M9Q', 'Amir Sadiq', 'amir54@kozy-test.example', '+2348031230060', NULL, '12 Admiralty Way, Lekki Phase 1', 'Lekki', 'Honda Ace', '2021', 'LAG-4433221', 'part-time', NULL, true, 'APPROVED', 'amir54id0000000000000000', now(), now() - interval '9 days');
  `);
  const custId = sql(`SELECT id FROM "User" WHERE email='customer40@kozy-test.example';`);
  sql(`
    INSERT INTO "Order" (id, "orderNumber", "userId", "driverId", status, type, "guaranteeActive", "serviceSpeed", "itemsManifest", "pickupAddress", "pickupDate", "pickupTimeSlot", "totalPrice", "deliveredAt", "createdAt", "updatedAt")
    VALUES ('qa54capo010000000000', 'KZ-540101', '${custId}', 'amir54id0000000000000000', 'DELIVERED', 'ITEM', false, 'STANDARD', '[]', '12 Alexander Ave, Ikoyi', now(), '09:00 - 10:00', 5000, now(), now(), now()),
           ('qa54capo020000000000', 'KZ-540102', '${custId}', 'amir54id0000000000000000', 'DELIVERED', 'ITEM', false, 'STANDARD', '[]', '12 Alexander Ave, Ikoyi', now(), '09:00 - 10:00', 5000, now(), now(), now()),
           ('qa54capo030000000000', 'KZ-540103', '${custId}', 'amir54id0000000000000000', 'OUT_FOR_DELIVERY', 'ITEM', false, 'STANDARD', '[]', '12 Alexander Ave, Ikoyi', now(), '09:00 - 10:00', 5000, NULL, now(), now());
    INSERT INTO "Order" (id, "orderNumber", "userId", status, type, "guaranteeActive", "serviceSpeed", "itemsManifest", "pickupAddress", "pickupDate", "pickupTimeSlot", "totalPrice", "lastNotifiedStage", "createdAt", "updatedAt")
    VALUES ('qa54capo040000000000', 'KZ-540104', '${custId}', 'REQUESTED', 'ITEM', false, 'STANDARD', '[]', '12 Alexander Ave, Ikoyi', now(), '09:00 - 10:00', 5000, -1, now(), now());
  `);

  const browser = await chromium.launch();

  // 1) /join-riders desktop
  const d = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const dp = await d.newPage();
  await dp.goto(`${BASE}/join-riders`, { waitUntil: 'domcontentloaded' });
  await sleep(2500);
  await dp.screenshot({ path: '/home/z/my-project/work/p54-join-riders-desktop.png', fullPage: false });
  console.log('captured join-riders desktop');

  // 2) /join-riders mobile
  const m = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mp = await m.newPage();
  await mp.goto(`${BASE}/join-riders`, { waitUntil: 'domcontentloaded' });
  await sleep(2500);
  const overflowM = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await mp.screenshot({ path: '/home/z/my-project/work/p54-join-riders-mobile.png', fullPage: false });
  console.log(`captured join-riders mobile (overflow ${overflowM}px)`);

  // 3) admin Riders tab
  const a = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const ap = await a.newPage();
  await ap.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await sleep(1500);
  await ap.fill('#email', 'admin40@kozy-test.example');
  await ap.fill('#password', 'Phase40!Admin2026');
  await ap.click('button[type="submit"]');
  for (let i = 0; i < 40 && ap.url().includes('/login'); i++) await sleep(500);
  await ap.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
  const ridersTab = ap.locator('button:has-text("Riders")').first();
  for (let i = 0; i < 30 && (await ridersTab.count()) === 0; i++) await sleep(500);
  await ridersTab.click();
  const rosterH = ap.locator('text=Rider roster').first();
  for (let i = 0; i < 30 && (await rosterH.count()) === 0; i++) await sleep(500);
  await sleep(800);
  await ap.screenshot({ path: '/home/z/my-project/work/p54-riders-tab.png', fullPage: true });
  console.log('captured riders tab');

  // 4) order modal Ask-the-customer composer
  const ordersTab = ap.locator('button:has-text("Orders")').first();
  for (let i = 0; i < 30 && (await ordersTab.count()) === 0; i++) await sleep(500);
  await ordersTab.click();
  const card = ap.locator('text=#KZ-540104').first();
  for (let i = 0; i < 40 && (await card.count()) === 0; i++) await sleep(500);
  await card.click();
  const askBtn = ap.locator('button:has-text("Ask the customer")').first();
  for (let i = 0; i < 30 && (await askBtn.count()) === 0; i++) await sleep(500);
  await askBtn.click();
  const composer = ap.locator('textarea').first();
  for (let i = 0; i < 20 && (await composer.count()) === 0; i++) await sleep(300);
  await composer.fill('Our rider is nearby — which gate should he call at for the pickup?');
  await sleep(600);
  await ap.screenshot({ path: '/home/z/my-project/work/p54-ask-composer.png', fullPage: false });
  console.log('captured ask-composer dialog');
  // do NOT click send — capture only, no email from the visual pass

  await browser.close();

  // cleanup the capture seed
  sql(`
    DELETE FROM "Order" WHERE id LIKE 'qa54cap%';
    DELETE FROM "RiderApplication" WHERE email IN ('kofi54@kozy-test.example','amir54@kozy-test.example');
    DELETE FROM "User" WHERE email = 'amir54@kozy-test.example';
  `);
  console.log('capture seed cleaned');
  process.exit(0);
})().catch((e) => {
  console.error('capture failed:', e);
  process.exit(1);
});
