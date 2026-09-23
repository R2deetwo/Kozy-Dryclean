// Phase 54 re-capture — the Riders tab WITH loaded data (the first capture
// fired while the API was still compiling/loading). Waits for an actual
// application card ("Kofi Mensah") and roster entry ("Amir Sadiq").
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
  `);

  const browser = await chromium.launch();
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
  // wait for LOADED data, not just the section heading
  const kofi = ap.locator('text=Kofi Mensah').first();
  for (let i = 0; i < 40 && (await kofi.count()) === 0; i++) await sleep(500);
  const amir = ap.locator('text=Amir Sadiq').first();
  for (let i = 0; i < 40 && (await amir.count()) === 0; i++) await sleep(500);
  await sleep(800);
  await ap.screenshot({ path: '/home/z/my-project/work/p54-riders-tab.png', fullPage: true });
  console.log('re-captured riders tab with loaded data');

  await browser.close();
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
