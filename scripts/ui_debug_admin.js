// Debug: what does the page actually show after login?
const { chromium } = require('playwright');
const BASE = 'http://localhost:3000';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'admin40@kozy-test.example');
  await page.fill('input[type="password"]', 'Phase40!Admin2026');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/home/z/my-project/work/detty-fix/debug-after-login.png' });
  console.log('URL after login:', page.url());

  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/home/z/my-project/work/detty-fix/debug-admin.png' });
  console.log('URL admin:', page.url());
  const body = await page.textContent('body');
  console.log('has "Marketing" text:', body.includes('Marketing'));
  // list candidate tab triggers
  const tabs = await page.$$eval('button, a, [role="tab"]', els =>
    els.map(e => (e.textContent || '').trim()).filter(t => t && t.length < 30).slice(0, 40)
  );
  console.log('clickable texts:', JSON.stringify(tabs));

  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
