// Verify the TEST RIDER account works on PRODUCTION: sign in at
// kozycare.ng/login with the emailed password, land on /driver, see the
// forced password dialog + the test pickup stop (KZ-55555001).
const { chromium } = require('playwright');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto('https://kozycare.ng/login', { waitUntil: 'domcontentloaded' });
  await sleep(1500);
  await page.fill('#email', 'practiceprosystems+rider@gmail.com');
  await page.fill('#password', 'KozyTestRider!55');
  await page.click('button[type="submit"]');
  for (let i = 0; i < 40 && page.url().includes('/login'); i++) await sleep(500);
  console.log('after login:', page.url());

  await page.goto('https://kozycare.ng/driver', { waitUntil: 'domcontentloaded' });
  await sleep(3000);
  const body = await page.textContent('body').catch(() => '');
  console.log('password dialog shown:', /Set your own password/.test(body));
  console.log('test stop visible (KZ-55555001):', /55555001/.test(body));
  console.log('Rules button present:', (await page.locator('button:has-text("Rules")').count()) > 0);
  console.log('guarantee stop present:', /Admiralty/.test(body));
  await page.screenshot({ path: 'work/p55-prod-rider-test.png', fullPage: false });
  console.log('page errors:', errors.length === 0 ? 'none' : errors.slice(0, 3));

  await browser.close();
})();
