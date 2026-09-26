// Debug probe — why did the driver sign-in 401?
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('response', (r) => {
    if (r.url().includes('callback/credentials')) {
      console.log('CALLBACK STATUS:', r.status());
    }
  });
  page.on('console', (m) => {
    if (m.type() === 'error') console.log('CONSOLE:', m.text().slice(0, 200));
  });
  await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"]', 'admin40@kozy-test.example');
  await page.fill('input[type="password"]', 'Phase40!Admin2026');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(6000);
  console.log('URL NOW:', page.url());
  const txt = await page.textContent('body');
  console.log('HAS ERROR MSG:', /Invalid email or password|not verified|paused/i.test(txt));
  console.log('ERROR TEXT:', (txt.match(/Invalid[^.]*\./) || ['none'])[0]);
  await browser.close();
})();
