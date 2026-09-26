// Debug the push toggle in headless Chromium — why does it not turn on?
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    permissions: ['notifications', 'geolocation'],
    geolocation: { latitude: 6.4541, longitude: 3.4703 },
  });
  const page = await ctx.newPage();
  page.on('console', (m) => console.log('CONSOLE:', m.type(), m.text().slice(0, 220)));
  page.on('pageerror', (e) => console.log('PAGEERR:', String(e).slice(0, 220)));

  await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"]', 'driver61@kozy-test.example');
  await page.fill('input[type="password"]', 'Phase61!Rider2026');
  await page.click('button[type="submit"]');
  await page.waitForURL(/driver/, { timeout: 20000 });
  await page.waitForSelector('text=Riding since', { timeout: 15000 }).catch(() => {});

  // Instrument the push APIs directly.
  const probe = await page.evaluate(async () => {
    const out = {};
    out.permission0 = Notification.permission;
    try {
      out.requested = await Notification.requestPermission();
    } catch (e) { out.requested = 'ERR ' + String(e).slice(0, 80); }
    out.permission1 = Notification.permission;
    try {
      const reg = await navigator.serviceWorker.ready;
      out.sw = reg.active?.scriptURL ?? 'none';
      const keyRes = await fetch('/api/push/key').then((r) => r.json());
      out.key = keyRes.available ? keyRes.publicKey.slice(0, 24) + '…' : 'unavailable';
      const b64 = keyRes.publicKey;
      const padding = '='.repeat((4 - (b64.length % 4)) % 4);
      const raw = atob((b64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
      const key = new Uint8Array(new ArrayBuffer(raw.length));
      for (let i = 0; i < raw.length; ++i) key[i] = raw.charCodeAt(i);
      out.subscribe = await new Promise((resolve) => {
        const timeout = setTimeout(() => resolve('TIMEOUT 20s'), 20000);
        reg.pushManager
          .subscribe({ userVisibleOnly: true, applicationServerKey: key })
          .then((s) => { clearTimeout(timeout); resolve('OK ' + s.endpoint.slice(0, 60)); })
          .catch((e) => { clearTimeout(timeout); resolve('ERR ' + String(e).slice(0, 140)); });
      });
    } catch (e) { out.swErr = String(e).slice(0, 140); }
    return out;
  });
  console.log('PROBE:', JSON.stringify(probe, null, 2));

  // Now the actual UI toggle:
  await page.locator('[role="switch"]').first().click();
  await sleep(4000);
  const note = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('div'));
    const c = cards.find((d) => d.textContent?.includes('Stop notifications'));
    return (c?.textContent ?? '').replace(/\s+/g, ' ').slice(0, 300);
  });
  console.log('NOTIFY CARD:', note);
  await browser.close();
})();
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
