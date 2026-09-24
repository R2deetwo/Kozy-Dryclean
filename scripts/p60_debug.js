// Debug: why is KZ-60000001 not clickable on the Orders board?
const { chromium } = require('playwright');
const BASE = 'http://localhost:3000';
const ADMIN = { email: 'admin60@kozy-test.example', password: 'Phase60!Admin2026' };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"]', ADMIN.email);
  await page.fill('input[type="password"]', ADMIN.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/admin/, { timeout: 20000 });
  await page.click('aside nav button:has-text("Orders")');
  await page.waitForTimeout(4000);
  const body = await page.textContent('body');
  console.log('has KZ-60000001 text:', body.includes('KZ-60000001'));
  console.log('has KZ-60000002 text:', body.includes('KZ-60000002'));
  console.log('has Ready to Pick Up:', body.includes('Ready to Pick Up'));
  console.log('has Bisi:', body.includes('Bisi'));
  // what view are we in?
  console.log('has list-view header Order #:', body.includes('Order #'));
  console.log('has Kanban columns (Requested):', body.includes('Requested'));
  const kzc = (body.match(/KZ-\d+/g) || []).slice(0, 12);
  console.log('order numbers visible:', kzc.join(', '));
  await page.screenshot({ path: 'work/p60-debug-board.png' });
  await browser.close();
})();
