// Phase 68: check VAPID push configuration state on prod (admin session).
const { chromium } = require('playwright');
const BASE = 'https://kozycare.ng';
const ADMIN = { email: 'vk5m2w8t4a@woosh.dpdns.org', password: 'KozyE2EAdmin!56' };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"]', ADMIN.email);
  await page.fill('input[type="password"]', ADMIN.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/admin/, { timeout: 25000 });
  const res = await page.evaluate(async (base) => {
    const r = await fetch(`${base}/api/push/key`);
    return { status: r.status, body: await r.json() };
  }, BASE);
  console.log('push/key:', JSON.stringify(res));
  if (res.body?.available === true) {
    console.log('VAPID keys ARE configured on prod — rider push is live.');
  } else if (res.body?.available === false) {
    console.log('VAPID keys NOT configured — rider stop-push is disabled until the owner pastes them.');
  }
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
