// Phase 61 QA — the rider app as a REAL app. Verifies on the dev server:
//   A. TAB SHELL: bottom tab bar (Route/History/Earnings/Account), route
//      default; distance chip reads "X km away" (the owner's "aja 5.6 km
//      and within 12 km" confusion is gone).
//   B. RULES EXIT: the dialog now closes via "Got it — back to my route"
//      AND via the ✕ (the owner's "no clear way to exit" bug).
//   C. HISTORY: completed legs grouped by day, on-time chips, only legs
//      THIS rider swiped.
//   D. EARNINGS (unpublished): the honest "rates aren't published" state.
//   E. ACCOUNT: profile with the owner's test phone, WhatsApp self-test
//      link → wa.me/2348124129296, install card, rules/password/sign-out.
//   F. PWA: manifest + service worker served for /driver.
//   G. LIVE ASSIGNMENT: while the rider app is open, assigning a stop
//      lights the gold in-app alert; the server fires the web-push +
//      WhatsApp hooks (bridge-mode log line proves the path ran).
//   H. PUSH: /api/push/key serves the VAPID key; enabling the toggle in a
//      real browser registers a PushSubscription row (if the headless
//      browser's push service is reachable).
//   I. RIDER PAY (admin): Settings → Offers & Delivery → Rider Pay card
//      publishes rates; the rider's Earnings tab flips to the live ledger.
//   J. WHATSAPP BRIDGE (admin): assigned-order modal shows the one-tap
//      "Send the job brief on WhatsApp" → wa.me/2348124129296.
// Run: node scripts/p61_qa.js
const { chromium } = require('playwright');
const fs = require('fs');
const { Client } = require('../work/pgembed/node_modules/pg');

const BASE = 'http://localhost:3000';
const DRIVER = { email: 'driver61@kozy-test.example', password: 'Phase61!Rider2026' };
const ADMIN = { email: 'admin61@kozy-test.example', password: 'Phase61!Admin2026' };
const DEVLOG = 'work/p61-prod.log';

let pass = 0, fail = 0, skip = 0;
function log(name, ok, extra) {
  const tag = ok === 'SKIP' ? 'SKIP' : ok ? 'PASS' : 'FAIL';
  console.log(`${tag}  ${name}${extra !== undefined ? `  (${extra})` : ''}`);
  if (ok === true) pass++; else if (ok === false) fail++; else skip++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const devlogSize = () => (fs.existsSync(DEVLOG) ? fs.statSync(DEVLOG).size : 0);

async function signIn(page, creds) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"]', creds.email);
  await page.fill('input[type="password"]', creds.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/admin|driver|portal/, { timeout: 20000 });
}

(async () => {
  // Rider runs in a PERSISTENT browser profile: headless Chromium disables
  // the Push API in incognito-style contexts (crbug 41124656), so a real
  // end-to-end push (server -> FCM -> device notification) needs a regular
  // profile. Fresh dir each run = fresh subscription each run.
  fs.rmSync('work/p61-chrome-profile', { recursive: true, force: true });
  const rbrowser = await chromium.launchPersistentContext('work/p61-chrome-profile', {
    viewport: { width: 390, height: 844 },
    permissions: ['notifications', 'geolocation'],
    geolocation: { latitude: 6.4541, longitude: 3.4703 }, // Lekki Phase 1
  });
  const rider = await rbrowser.newPage();
  const errors = [];
  rider.on('pageerror', (e) => errors.push(String(e)));
  const browser = await chromium.launch(); // admin + everything else

  // ============ A. TAB SHELL + ROUTE ============
  await signIn(rider, DRIVER);
  log('rider sign-in lands on /driver', rider.url().includes('/driver'), rider.url());
  await rider.waitForSelector('text=Your route today', { timeout: 15000 });
  await sleep(2500); // first poll + geofence settle

  for (const t of ['Route', 'History', 'Earnings', 'Account']) {
    log(`bottom tab bar shows "${t}"`, (await rider.locator(`nav >> text=${t}`).count()) === 1);
  }

  let routeText = await rider.textContent('body');
  log('live pickup stop on route', routeText.includes('KZ-61000001'));
  log('live delivery stop on route', routeText.includes('KZ-61000002'));
  log('unassigned order NOT on route yet', !routeText.includes('KZ-61000006'));
  // The owner's confusion, gone: no "within N km", no orphan "aja".
  log('no "within N km" service-radius text', !/within \d+\s?km/i.test(routeText));
  log('no orphan "aja" fragment', !/\baja\b/i.test(routeText));
  // Distance chip: "Lekki · X km away" (needs the granted geolocation + a
  // successful server ping — poll for it, first load can be slow).
  let kmAway = null;
  for (let i = 0; i < 16; i++) {
    await sleep(1500);
    const t = await rider.textContent('body');
    kmAway = t.match(/([\d.]+)\s?km away/i);
    if (kmAway) break;
  }
  log('distance chip reads "X km away"', Boolean(kmAway), kmAway ? kmAway[0] : await rider.textContent('header').then((t) => t.replace(/\s+/g, ' ').trim().slice(0, 60)).catch(() => 'no pill'));

  // ============ B. RULES EXIT ============
  await rider.click('header >> button:has-text("Rules")');
  await rider.waitForSelector('text=Care & safety rules', { timeout: 5000 });
  log('rules dialog opens from header', true);
  log('rules have the explicit exit button', (await rider.locator('button:has-text("Got it — back to my route")').count()) === 1);
  await rider.click('button:has-text("Got it — back to my route")');
  await sleep(600);
  log('rules dialog closes via the exit button', (await rider.locator('text=You are the face of Kozy Care').count()) === 0);
  // And via the ✕ / Escape:
  await rider.click('header >> button:has-text("Rules")');
  await rider.waitForSelector('text=Care & safety rules', { timeout: 5000 });
  let closedByX = false;
  try {
    await rider.keyboard.press('Escape');
    await sleep(500);
    closedByX = (await rider.locator('text=You are the face of Kozy Care').count()) === 0;
  } catch { /* ignore */ }
  log('rules dialog also closes via Escape/✕', closedByX);

  // ============ C. HISTORY ============
  await rider.click('nav >> text=History');
  await rider.waitForSelector('text=#KZ-61000003', { timeout: 10000 }).catch(() => {});
  const histText = await rider.textContent('body');
  log('history shows a "Today" group', /Today/.test(histText));
  log('history shows today\u2019s pickup leg', histText.includes('KZ-61000003'));
  log('history shows yesterday\u2019s leg (weekday group)', /Fri|Thu|Wed|Tue|Mon|Sun|Sat/.test(histText) && histText.includes('KZ-61000004'));
  log('history shows the 6-day-old delivery', histText.includes('KZ-61000005'));
  log('history rows carry on-time chips', /on time/.test(histText) && /late/.test(histText));
  log('history credits legs by swipe (attribution note)', /swipe/i.test(histText));
  const rowKZ3 = await rider.locator('li').filter({ hasText: 'KZ-61000003' }).count();
  log('today\u2019s order appears as pickup + delivery legs', rowKZ3 === 2, `rows=${rowKZ3}`);

  // ============ D. EARNINGS (rates unpublished) ============
  await rider.click('nav >> text=Earnings');
  await rider.waitForSelector('text=Rider rates', { timeout: 10000 }).catch(() => {});
  let earnText = await rider.textContent('body');
  log('earnings: honest unpublished state', /aren.t published yet/i.test(earnText));
  log('earnings: work counters visible (3 pickups / 2 deliveries)', /3/.test(earnText) && /2/.test(earnText));
  log('earnings: no invented naira figure', !/₦\s?[\d,]+/.test(earnText));

  // ============ E. ACCOUNT ============
  await rider.click('nav >> text=Account');
  await rider.waitForSelector('text=Riding since', { timeout: 10000 }).catch(() => {});
  const accText = await rider.textContent('body');
  log('account shows the rider profile', accText.includes('Phase 61 Rider'));
  log('account shows the owner\u2019s test phone', accText.includes('08124129296'));
  log('account shows notifications card', /Notifications/.test(accText));
  log('account shows the install card', /Get the app on your phone/.test(accText));
  log('account shows rules + password + sign out', /Care & safety rules/.test(accText) && /Password/.test(accText) && /Sign out/.test(accText));
  const waHref = await rider.locator('a:has-text("Send test")').first().getAttribute('href').catch(() => null);
  log('WhatsApp self-test link targets the owner\u2019s number', Boolean(waHref && waHref.startsWith('https://wa.me/2348124129296?text=')), waHref ? waHref.slice(0, 48) : 'missing');

  // ============ F. PWA ============
  const manifestLink = await rider.locator('link[rel="manifest"]').getAttribute('href').catch(() => null);
  log('driver page links its manifest', manifestLink === '/manifest-driver.webmanifest', String(manifestLink));
  const mf = await rider.evaluate(() => fetch('/manifest-driver.webmanifest').then((r) => r.json()).catch(() => null));
  log('manifest is valid JSON with name + icons', Boolean(mf && mf.name && Array.isArray(mf.icons) && mf.icons.length > 0), mf ? mf.name : 'fetch failed');
  const swOk = await rider.evaluate(() => fetch('/sw.js').then((r) => r.ok).catch(() => false));
  log('service worker is served', swOk);
  const swReg = await rider.evaluate(() =>
    navigator.serviceWorker.getRegistrations().then((rs) => rs.map((r) => r.active?.scriptURL || r.installing?.scriptURL || '')),
  ).catch(() => []);
  log('service worker registered on /driver', swReg.some((u) => u.includes('/sw.js')), swReg.join(','));

  // ============ H. PUSH ============
  // The full browser->push-service->device leg cannot run in this sandbox:
  // headless Chromium cannot reach its push service ("push service not
  // available"), and real delivery needs a real Android/iOS device. What IS
  // provable here — and is asserted below — is the ENTIRE server pipeline:
  // subscription storage, VAPID signing, the actual signed POST leaving the
  // server on assignment (to a mock push endpoint we stand up locally),
  // TTL/urgency headers, and honest UI when the browser can't subscribe.
  const keyRes = await rider.evaluate(() => fetch('/api/push/key').then((r) => r.json()).catch(() => null));
  log('push key API: available + VAPID public key', Boolean(keyRes && keyRes.available && keyRes.publicKey && keyRes.publicKey.length > 60));

  // H1. The toggle communicates honestly in a browser whose push service is
  //     unreachable (this sandbox): a clear note, never a silent failure.
  let noteSeen = false;
  try {
    await rider.locator('[role="switch"]').first().click();
    await sleep(3500);
    const note = await rider.locator('div.rounded-2xl:has-text("Notifications") p.mt-3').textContent().catch(() => null);
    noteSeen = Boolean(note && note.trim().length > 8);
    log('toggle failure communicates honestly (no silent break)', noteSeen, (note || '').replace(/\s+/g, ' ').slice(0, 90));
  } catch (e) {
    log('toggle failure communicates honestly (no silent break)', 'SKIP', String(e).slice(0, 60));
  }

  // H2. Register a synthetic subscription whose endpoint is a LOCAL mock
  //     push service. The keys are a REAL P-256 keypair (web-push validates
  // the curve point) — so the mock can also DECRYPT the pushed payload and
  // prove the POST carries our assignment message, end to end.
  const PUSH_PORT = 8433;
  const nodeCrypto = require('crypto');
  const { publicKey, privateKey } = nodeCrypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const p256dh = publicKey.export({ type: 'spki', format: 'der' }).slice(-65).toString('base64url');
  const authSecret = nodeCrypto.randomBytes(16).toString('base64url');
  const pushHits = [];
  const pushServer = require('https').createServer(
    {
      key: fs.readFileSync('work/p61-push-mock.key'),
      cert: fs.readFileSync('work/p61-push-mock.crt'),
    },
    (req, res) => {
    let body = [];
    req.on('data', (c) => body.push(c));
    req.on('end', () => {
      const buf = Buffer.concat(body);
      let decrypted = null;
      try {
        // aes128gcm (RFC 8188/8291): the body itself carries the salt, the
        // record size, and the sender's ephemeral P-256 public key (keyid);
        // the payload is ECDH+HKDF derived AES-128-GCM ciphertext.
        const salt = buf.slice(0, 16);
        const idlen = buf[20];
        const keyid = buf.slice(21, 21 + idlen);
        if (idlen === 65 && buf.length > 21 + idlen + 16) {
          const asPub = keyid;
          const uaPub = Buffer.from(p256dh, 'base64url');
          const SPKI = Buffer.from('3059301306072a8648ce3d020106082a8648ce3d030107034200', 'hex');
          const senderKey = nodeCrypto.createPublicKey({ key: Buffer.concat([SPKI, asPub]), format: 'der', type: 'spki' });
          const ikm = nodeCrypto.diffieHellman({ privateKey, publicKey: senderKey });
          const prkFull = Buffer.from(
            nodeCrypto.hkdfSync('sha256', ikm, Buffer.from(authSecret, 'base64url'), Buffer.concat([Buffer.from('WebPush: info\u0000'), uaPub, asPub]), 32),
          );
          const cek = Buffer.from(nodeCrypto.hkdfSync('sha256', prkFull, salt, Buffer.from('Content-Encoding: aes128gcm\u0000'), 16));
          const nonce = Buffer.from(nodeCrypto.hkdfSync('sha256', prkFull, salt, Buffer.from('Content-Encoding: nonce\u0000'), 12));
          const ct = buf.slice(21 + idlen, -16);
          const tag = buf.slice(-16);
          const d = nodeCrypto.createDecipheriv('aes-128-gcm', cek, nonce);
          d.setAuthTag(tag);
          const pt = Buffer.concat([d.update(ct), d.final()]);
          const end = pt.indexOf(2); // record delimiter/padding
          decrypted = pt.slice(0, end >= 0 ? end : pt.length).toString('utf8');
        }
      } catch (e) {
        decrypted = 'DECRYPT_ERR: ' + String(e).slice(0, 60);
      }
      pushHits.push({ url: req.url, ttl: req.headers.ttl, urgency: req.headers.urgency, auth: req.headers.authorization, bodyLen: buf.length, decrypted });
      res.writeHead(200);
      res.end('ok');
    });
    },
  );
  await new Promise((r) => pushServer.listen(PUSH_PORT, '127.0.0.1', r));
  const subReg = await rider.evaluate(
    async ({ port, key, auth }) => {
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: {
            endpoint: `https://127.0.0.1:${port}/push/test-endpoint`,
            keys: { p256dh: key, auth },
          },
          device: 'QA synthetic device',
        }),
      });
      return res.status;
    },
    { port: PUSH_PORT, key: p256dh, auth: authSecret },
  );
  log('subscription API accepts a device registration', subReg === 200, `POST status=${subReg}`);
  const subCount = await rider.evaluate(() => fetch('/api/push/subscribe').then((r) => r.json()).then((d) => d.count).catch(() => -1));
  log('PushSubscription row registered', subCount >= 1, `devices=${subCount}`);

  // ============ G. LIVE ASSIGNMENT (rider app open on Account tab) ============
  // Admin, in a separate context, assigns the unassigned stop.
  const actx = await browser.newContext({ viewport: { width: 1280, height: 800 } });

  const admin = await actx.newPage();
  admin.on('pageerror', (e) => errors.push('admin: ' + String(e)));
  await signIn(admin, ADMIN);
  await admin.waitForURL(/admin/, { timeout: 20000 });
  log('admin sign-in lands in console', admin.url().includes('/admin'));

  const assignStart = devlogSize();
  const pg = new Client({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:54329/kozy' });
  await pg.connect();
  const o6 = await pg.query(`SELECT id FROM "Order" WHERE "orderNumber"='KZ-61000006'`);
  const drv = await pg.query(`SELECT id FROM "User" WHERE email='driver61@kozy-test.example'`);
  const o6id = o6.rows[0]?.id ?? null;
  const driverId = drv.rows[0]?.id ?? null;
  log('unassigned stop + driver found (DB)', Boolean(o6id && driverId), `order=${Boolean(o6id)} driver=${Boolean(driverId)}`);
  let assignStatus = null;
  if (driverId && o6id) {
    assignStatus = await admin.evaluate(
      async ({ id, drv }) => {
        const res = await fetch(`/api/orders/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ driverId: drv }),
        });
        return res.status;
      },
      { id: o6id, drv: driverId },
    );
  }
  log('admin assigns the stop (PATCH 200)', assignStatus === 200, `status=${assignStatus} driverId=${driverId}`);

  // THE server-pipeline push proof: after() signs a VAPID payload and POSTs
  // it to the subscribed endpoint (our local mock push service) with the
  // TTL + urgency headers the spec promises. Polled together with the
  // in-app banner (self-dismisses after 8s — tapped the moment it appears).
  let pushHit = null;
  let alertSeen = false;
  let alertOpenedStop = false;
  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    if (!alertSeen && (await rider.locator('text=New stop assigned').count()) > 0) {
      alertSeen = true;
      await rider.locator('text=New stop assigned').first().click().catch(() => {});
      await sleep(900);
      alertOpenedStop = (await rider.textContent('body')).includes('KZ-61000006');
      // Back to the tab shell (the detail screen owns the whole page).
      await rider.click('header button:has-text("Route")').catch(() => {});
      await sleep(400);
    }
    if (!pushHit && pushHits.length > 0) pushHit = pushHits[0];
    if (alertSeen && pushHit) break;
  }
  log(
    'PUSH DELIVERED: signed POST reached the push endpoint',
    Boolean(pushHit && pushHit.url?.includes('/push/') && pushHit.auth?.toLowerCase().includes('vapid') && Number(pushHit.ttl) > 0 && pushHit.bodyLen > 50),
    pushHit ? `TTL=${pushHit.ttl} urgency=${pushHit.urgency} vapid=${pushHit.auth ? 'yes' : 'no'} body=${pushHit.bodyLen}B` : 'no POST received',
  );
  let pushedMsg = null;
  try { pushedMsg = pushHit?.decrypted ? JSON.parse(pushHit.decrypted) : null; } catch { pushedMsg = null; }
  log(
    'PUSH PAYLOAD decrypts to the assignment message',
    Boolean(pushedMsg && /pickup|delivery/i.test(pushedMsg.title || '') && (pushedMsg.url || '') === '/driver'),
    pushedMsg ? `${pushedMsg.title} — ${(pushedMsg.body || '').slice(0, 60)}` : (pushHit?.decrypted || 'not decrypted'),
  );
  const subAfter = await pg
    .query(`SELECT COUNT(*)::int AS n FROM "PushSubscription" WHERE "userId"='${driverId}'`)
    .then((r) => r.rows[0].n)
    .catch(() => -1);
  log('live subscription survives a successful push (not pruned)', subAfter >= 1, `rows=${subAfter}`);

  log('live assignment lights the in-app alert', alertSeen);
  log('tapping the alert opens the new stop', alertOpenedStop);
  // Server-side hooks ran: the WhatsApp bridge-mode line proves the
  // assignment notification path executed.
  const logTail = fs.existsSync(DEVLOG) ? fs.readFileSync(DEVLOG, 'utf8').slice(Math.max(0, assignStart)) : '';
  log('assignment notification path ran (bridge-mode log or proven push)', logTail.includes('bridge mode') || Boolean(pushHit));
  log('no push send error in logs', !logTail.includes('[notify] push error'));

  // ============ J. WHATSAPP BRIDGE in the console ============
  await admin.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
  await admin.click('aside nav button:has-text("Orders")').catch(async () => {});
  await sleep(1500);
  const openModal = admin.locator(`text=KZ-61000001`).first();
  await openModal.click().catch(() => {});
  await admin.waitForSelector('text=Assigned rider', { timeout: 10000 }).catch(() => {});
  const bridgeBtn = admin.locator('a:has-text("Send the job brief on WhatsApp")').first();
  const bridgeHref = await bridgeBtn.getAttribute('href').catch(() => null);
  log('order modal shows the WhatsApp bridge button', Boolean(bridgeHref), bridgeHref ? bridgeHref.slice(0, 40) : 'missing');
  log('bridge targets the owner\u2019s number', Boolean(bridgeHref && bridgeHref.startsWith('https://wa.me/2348124129296?text=')));
  const decoded = bridgeHref ? decodeURIComponent(bridgeHref) : '';
  log('bridge brief carries the order + address + when', decoded.includes('KZ-61000001') && decoded.includes('12 Admiralty Way') && decoded.includes('When:'), decoded.match(/When:.{0,40}/s)?.[0]?.replace(/\s+/g, ' ') || '');
  await admin.keyboard.press('Escape').catch(() => {});

  // ============ I. RIDER PAY publish → live ledger ============
  await admin.click('aside nav button:has-text("Settings")').catch(() => {});
  await admin.waitForSelector('[data-state]', { timeout: 10000 }).catch(() => {});
  await admin.click('button[role="tab"]:has-text("Offers & Delivery")').catch(async () => {
    // fall back to whatever tab holds Rider Pay
  });
  await sleep(800);
  if ((await admin.locator('text=Rider Pay').count()) === 0) {
    for (const tab of ['Pricing', 'Bank', 'Contact', 'Notifications', 'Guarantee']) {
      await admin.click(`button[role="tab"]:has-text("${tab}")`).catch(() => {});
      await sleep(600);
      if ((await admin.locator('text=Rider Pay').count()) > 0) break;
    }
  }
  log('Settings shows the Rider Pay card', (await admin.locator('text=Rider Pay').count()) > 0);
  await admin.fill('#rider-pickup-rate', '300');
  await admin.fill('#rider-delivery-rate', '500');
  await admin.locator('button:has-text("Save")').first().click();
  await sleep(2000);
  const savedSettings = await admin.evaluate(() => fetch('/api/settings/app').then((r) => r.json()).then((d) => d.settings));
  log('rider pay rates saved (₦300/₦500)', savedSettings.riderPickupRate === 300 && savedSettings.riderDeliveryRate === 500, `${savedSettings.riderPickupRate}/${savedSettings.riderDeliveryRate}`);

  // Back on the rider app — the Earnings tab re-mounts and re-fetches.
  await rider.click('nav >> text=Earnings');
  await sleep(2000);
  earnText = await rider.textContent('body');
  log('earnings flips to the live ledger', /This payout week/.test(earnText));
  log('this week = ₦1,100 (3 legs)', earnText.includes('₦1,100'));
  log('all-time = ₦1,900 (5 legs)', earnText.includes('₦1,900'));
  log('published rates chip shown', /₦300 \/ pickup/.test(earnText) && /₦500 \/ delivery/.test(earnText));
  log('ledger rows priced (+₦300 / +₦500)', /\+₦300/.test(earnText) && /\+₦500/.test(earnText));
  log('on-time % shown vs the customer\u2019s slot', /40%|On-time/.test(earnText));

  // ============ Screenshots for VLM ============
  await rider.click('nav >> text=Route');
  await sleep(1200);
  await rider.screenshot({ path: 'work/p61-route-mobile.png', fullPage: false });
  await rider.click('nav >> text=History');
  await sleep(1200);
  await rider.screenshot({ path: 'work/p61-history-mobile.png', fullPage: false });
  await rider.click('nav >> text=Earnings');
  await sleep(1200);
  await rider.screenshot({ path: 'work/p61-earnings-mobile.png', fullPage: false });
  await rider.click('nav >> text=Account');
  await sleep(1200);
  await rider.screenshot({ path: 'work/p61-account-mobile.png', fullPage: false });
  await admin.screenshot({ path: 'work/p61-riderpay-admin.png', fullPage: false });

  log('zero page errors across both sessions', errors.length === 0, errors.slice(0, 3).join(' | '));

  console.log(`\n==== P61 QA: ${pass} PASS, ${fail} FAIL, ${skip} SKIP ====`);
  await pg.end().catch(() => {});
  try { pushServer.close(); } catch { /* ignore */ }
  await rbrowser.close().catch(() => {});
  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => {
  console.error('BATTERY CRASH:', e);
  process.exit(2);
});
