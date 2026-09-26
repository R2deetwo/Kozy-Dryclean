// Phase 59 capture — screenshots for VLM review.
const { chromium } = require('playwright');

const BASE = 'http://localhost:3000';
const DRIVER = { email: 'driver59@kozy-test.example', password: 'Phase59!Rider2026' };
const ADMIN = { email: 'admin59@kozy-test.example', password: 'Phase59!Admin2026' };

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

  // ---- Rider app, phone viewport (it IS a phone app) ----
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await signIn(phone, DRIVER);
  await phone.waitForSelector('text=Your route today', { timeout: 15000 });
  await sleep(2500);
  await phone.screenshot({ path: 'work/p59-route-mobile.png', fullPage: true });

  // Pickup stop detail
  await phone.locator('text=KZ-59000001').first().click();
  await phone.waitForSelector('text=At this stop', { timeout: 10000 });
  await sleep(800);
  await phone.screenshot({ path: 'work/p59-pickup-detail.png', fullPage: true });

  // Delivery stop detail (with different drop-off)
  await phone.locator('button:has-text("Route")').first().click();
  await sleep(800);
  await phone.locator('text=KZ-59000002').first().click();
  await phone.waitForSelector('text=At this stop', { timeout: 10000 });
  await sleep(800);
  await phone.screenshot({ path: 'work/p59-delivery-detail.png', fullPage: true });
  await phone.close();

  // ---- Admin console, desktop ----
  const admin = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await signIn(admin, ADMIN);
  await admin.locator('aside nav button:has-text("Customers")').first().click();
  await admin.waitForSelector('h1:has-text("Customers (CRM)")', { timeout: 10000 });
  await sleep(1500);
  await admin.screenshot({ path: 'work/p59-crm.png', fullPage: true });

  await admin.locator('aside nav button:has-text("Riders")').first().click();
  await admin.waitForSelector('text=Rider roster', { timeout: 10000 });
  await sleep(1500);
  await admin.screenshot({ path: 'work/p59-roster.png', fullPage: true });

  await admin.close();
  await browser.close();
  console.log('CAPTURED: route-mobile, pickup-detail, delivery-detail, crm, roster');
})();
