// Phase 51 QA — staged condition photos end to end:
//   A. /api/media/stage + cron endpoint contracts
//   B. Customer books with 30 photos (staged one-by-one, IDs in the POST)
//   C. Admin: slim list payload (mediaCount, no bytes), Kanban camera badge,
//      detail modal fetches + renders 30 photos (click-through anchors)
//   D. Retention: DELIVERED +25h -> cron purge -> photos gone -> modal shows
//      the "claim window closed" note; stale staged photo purged
//   E. Feedback email path: DELIVERED PATCH fires notifyOrderStatus exactly
//      once (stage dedup) — verified via the dev log in the bash wrapper.
// Dev-mode rules (phase-50 lessons): domcontentloaded + sleep, never
// networkidle; run server + QA in one bash invocation.
const { chromium } = require('playwright');
const { execSync } = require('child_process');
const zlib = require('zlib');

const BASE = 'http://localhost:3000';
const PSQL = '/home/z/my-project/work/pgvenv/lib/python3.12/site-packages/pgserver/pginstall/bin/psql';
/** Run SQL via stdin — no shell quoting games with escaped identifiers. */
function sql(statement) {
  return execSync(`${PSQL} -h 127.0.0.1 -p 54329 -U postgres -d kozy -tA`, {
    input: statement,
    env: { ...process.env, PGPASSWORD: 'postgres' },
  }).toString().trim();
}

let pass = 0, fail = 0;
function log(name, ok, extra) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra !== undefined ? `  (${extra})` : ''}`);
  ok ? pass++ : fail++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const q = (s) => JSON.stringify(s);

// ---------- tiny 1x1 PNG (base64) + a big noise PNG builder ----------
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);
function crc32(buf) {
  let c, table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
/** Grayscale noise PNG (poorly compressible -> forces the client's adaptive
 *  quality step-down in canvas.toDataURL). */
function noisePng(w, h) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 0; // 8-bit grayscale
  const raw = Buffer.alloc(h * (1 + w));
  let o = 0;
  for (let y = 0; y < h; y++) {
    raw[o++] = 0; // filter: none
    for (let x = 0; x < w; x++) raw[o++] = (Math.random() * 256) | 0;
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 0 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

(async () => {
  const errors = [];
  const browser = await chromium.launch();

  // ================= A. STAGE + CRON API CONTRACTS =================
  {
    const r = await fetch(`${BASE}/api/media/stage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'qa-token-abcdef', photo: 'data:image/jpeg;base64,' + Buffer.from('fakejpg').toString('base64') }),
    });
    const d = await r.json();
    log('A1 stage: valid photo -> 200 + id', r.status === 200 && typeof d.id === 'string' && d.id.length >= 20, `status ${r.status}`);

    const r2 = await fetch(`${BASE}/api/media/stage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'qa-token-abcdef', photo: 'not-a-data-url' }),
    });
    log('A2 stage: non-data-url -> 400', r2.status === 400, `status ${r2.status}`);

    const big = 'data:image/jpeg;base64,' + 'A'.repeat(420000);
    const r3 = await fetch(`${BASE}/api/media/stage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'qa-token-abcdef', photo: big }),
    });
    log('A3 stage: oversized photo -> 400', r3.status === 400, `status ${r3.status}`);

    const r4 = await fetch(`${BASE}/api/media/stage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photo: 'data:image/jpeg;base64,AAAA' }),
    });
    log('A4 stage: missing token -> 400', r4.status === 400, `status ${r4.status}`);

    const c1 = await fetch(`${BASE}/api/cron/purge-media`);
    log('A5 cron: no auth -> 401', c1.status === 401, `status ${c1.status}`);
    const c2 = await fetch(`${BASE}/api/cron/purge-media`, { headers: { 'x-vercel-cron': '1' } });
    log('A6 cron: x-vercel-cron header -> 200', c2.status === 200, `status ${c2.status}`);
  }

  // ================= B. CUSTOMER BOOKS WITH 30 PHOTOS =================
  const custCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const cust = await custCtx.newPage();
  cust.on('pageerror', (e) => errors.push('cust: ' + String(e)));
  const stagedCalls = [];
  cust.on('response', async (res) => {
    if (res.url().includes('/api/media/stage')) {
      stagedCalls.push(res.status());
    }
  });
  let orderPostBody = null;
  cust.on('request', (req) => {
    if (req.method() === 'POST' && req.url().endsWith('/api/orders')) {
      try { orderPostBody = JSON.parse(req.postData() || '{}'); } catch {}
    }
  });

  // login
  await cust.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await sleep(1500);
  await cust.fill('#email', 'customer40@kozy-test.example');
  await cust.fill('#password', 'Phase40!Customer2026');
  await cust.click('button[type="submit"]');
  for (let i = 0; i < 40 && cust.url().includes('/login'); i++) await sleep(500);
  log('B1 customer logged in (redirected away from /login)', !cust.url().includes('/login'), cust.url());

  // book
  await cust.goto(`${BASE}/book`, { waitUntil: 'domcontentloaded' });
  await sleep(2500);
  // dismiss a resume-draft banner if one appears
  const resumeBtn = cust.locator('button:has-text("Continue where you left off")');
  if (await resumeBtn.count() > 0) { await resumeBtn.first().click(); await sleep(800); }

  // step 1: two items + machine wash
  await cust.locator('[aria-label^="Add one"]').first().click();
  await cust.locator('[aria-label^="Add one"]').nth(1).click();
  await cust.locator('button:has-text("Machine wash")').first().click();
  await cust.locator('button:has-text("Continue")').first().click();
  await sleep(900);
  log('B2 step 2 reached (guarantee heading)', (await cust.locator('h2:has-text("Activate your Return-as-Received Guarantee")').count()) === 1);

  log('B3 upload guidance panel visible', (await cust.locator('text=Getting good photos').count()) === 1);
  log('B4 counter shows /30', (await cust.locator('text=/30 photos').count()) === 1);

  // 30 photos: #1 is big noise (forces adaptive step-down), #2-30 tiny
  const files = [{ name: 'big-noise.png', mimeType: 'image/png', buffer: noisePng(1100, 1500) }];
  for (let i = 2; i <= 30; i++) files.push({ name: `p${i}.png`, mimeType: 'image/png', buffer: TINY_PNG });
  await cust.setInputFiles('input[type="file"][multiple]', files);

  // wait for all 30 stage responses
  for (let i = 0; i < 90 && stagedCalls.length < 30; i++) await sleep(500);
  log('B5 all 30 photos staged (30 x 200 responses)', stagedCalls.length === 30 && stagedCalls.every((s) => s === 200), `${stagedCalls.length} calls, statuses ${[...new Set(stagedCalls)].join(',')}`);

  // counter 30/30 + tiles done
  for (let i = 0; i < 20 && (await cust.locator('text=30/30 photos').count()) === 0; i++) await sleep(400);
  log('B6 counter reads 30/30', (await cust.locator('text=30/30 photos').count()) === 1);
  const tileImgs = cust.locator('img[alt^="Condition photo"]');
  log('B7 30 photo tiles rendered', (await tileImgs.count()) === 30, `${await tileImgs.count()}`);
  const noFailed = await cust.locator('text=Tap to retry').count();
  log('B8 zero failed tiles', noFailed === 0, `${noFailed}`);
  log('B9 add button disabled at limit', await cust.locator('button:has-text("Take or upload photos")').first().isDisabled());

  // the big noise photo tile should hold a real (<=210k chars) jpeg data URL
  const firstSrc = await cust.locator('img[alt^="Condition photo"]').first().getAttribute('src');
  log('B10 big photo compressed to staged size', firstSrc && firstSrc.startsWith('data:image/jpeg') && firstSrc.length <= 210000, firstSrc ? `${firstSrc.length} chars` : 'no src');

  // ack + continue
  await cust.locator('input[type="checkbox"]').first().check();
  await cust.locator('button:has-text("Continue")').first().click();
  await sleep(900);
  log('B11 step 3 reached', (await cust.locator('h2:has-text("Pickup & delivery")').count()) === 1);

  // logistics
  await cust.fill('#pickup-address', `Phase 51 QA street ${Date.now()}, Lekki Phase 1`);
  await cust.locator('button:has-text("08:00")').first().click();
  await cust.locator('button:has-text("Continue")').first().click();
  await sleep(900);

  // step 4: bank transfer (default) -> place order
  await cust.locator('button:has-text("I\'ve Made the Transfer")').first().click();
  await sleep(4000);
  log('B12 redirected to /payment/pending', cust.url().includes('/payment/pending'), cust.url());

  log('B13 order POST carried 30 staged IDs + token',
    orderPostBody && Array.isArray(orderPostBody.stagedPhotoIds) && orderPostBody.stagedPhotoIds.length === 30 && !!orderPostBody.stagedToken,
    orderPostBody ? `ids=${(orderPostBody.stagedPhotoIds || []).length}, token=${orderPostBody.stagedToken ? 'yes' : 'no'}` : 'no request captured');
  log('B14 order POST has NO inline conditionPhotos', !orderPostBody?.conditionPhotos);

  const stash = await cust.evaluate(() => sessionStorage.getItem('kozy:condition-photos'));
  const tok = await cust.evaluate(() => sessionStorage.getItem('kozy:stage-token'));
  log('B15 stash + token cleared after booking', !stash && !tok, `stash=${stash ? 'present' : 'clear'}, token=${tok ? 'present' : 'clear'}`);

  const orderNumber = decodeURIComponent(cust.url().split('order=')[1] || '').split('&')[0];
  log('B16 order number captured', /^#?KZ-/.test(orderNumber || ''), orderNumber);

  // ================= C. ADMIN: SLIM PAYLOAD + BADGE + MODAL =================
  const admCtx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const adm = await admCtx.newPage();
  adm.on('pageerror', (e) => errors.push('adm: ' + String(e)));
  await adm.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await sleep(1500);
  await adm.fill('#email', 'admin40@kozy-test.example');
  await adm.fill('#password', 'Phase40!Admin2026');
  await adm.click('button[type="submit"]');
  for (let i = 0; i < 40 && adm.url().includes('/login'); i++) await sleep(500);
  log('C1 admin logged in', !adm.url().includes('/login'), adm.url());

  const listRes = await adm.evaluate(async () => {
    const r = await fetch('/api/orders?limit=100');
    const text = await r.text();
    let json = null; try { json = JSON.parse(text); } catch {}
    return { status: r.status, bytes: text.length, hasDataUrl: text.includes('data:image'), items: json?.items?.length ?? -1 };
  });
  log('C2 list payload: no photo bytes, sane size', listRes.status === 200 && !listRes.hasDataUrl && listRes.bytes < 400000, `${(listRes.bytes / 1024).toFixed(0)}KB, items=${listRes.items}`);

  const orderId = await adm.evaluate(async (num) => {
    const r = await fetch('/api/orders?limit=100');
    const d = await r.json();
    const o = (d.items || []).find((x) => x.orderNumber === num);
    return o ? o.id : null;
  }, orderNumber);
  log('C3 new order found on the board list', !!orderId, orderId);

  const listed = await adm.evaluate(async (id) => {
    const r = await fetch('/api/orders?limit=100');
    const d = await r.json();
    const o = (d.items || []).find((x) => x.id === id);
    return { mediaCount: o?.mediaCount, hasMedia: o ? 'media' in o : null, guarantee: o?.guaranteeActive, status: o?.status };
  }, orderId);
  log('C4 list row: mediaCount 30, no media array, guarantee on',
    listed.mediaCount === 30 && listed.hasMedia === false && listed.guarantee === true, JSON.stringify(listed));

  const detail = await adm.evaluate(async (id) => {
    const r = await fetch(`/api/orders/${id}`);
    const d = await r.json();
    return { count: d?.order?.media?.length ?? -1, first: d?.order?.media?.[0]?.imageUrl?.slice(0, 22) };
  }, orderId);
  log('C5 single-order GET carries full 30 photos', detail.count === 30 && detail.first === 'data:image/jpeg;base64', JSON.stringify(detail));

  // board + badge + modal
  await adm.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
  // the console opens on the Dashboard tab — the board lives under "Orders"
  const ordersTab = adm.locator('button:has-text("Orders")').first();
  for (let i = 0; i < 40 && (await ordersTab.count()) === 0; i++) await sleep(500);
  await ordersTab.click();
  const badge = adm.locator('[title^="30 condition photos"]');
  for (let i = 0; i < 40 && (await badge.count()) === 0; i++) await sleep(500);
  log('C6 Kanban card camera badge (30)', (await badge.count()) >= 1, `${await badge.count()}`);
  await badge.first().click();
  const modalH = adm.locator('h3:has-text("Condition photos (30)")');
  for (let i = 0; i < 30 && (await modalH.count()) === 0; i++) await sleep(500);
  log('C7 modal shows Condition photos (30)', (await modalH.count()) === 1);
  const modalImgs = adm.locator('img[alt="Condition"]');
  let loaded = 0;
  for (let i = 0; i < 30; i++) {
    loaded = await adm.evaluate(() =>
      Array.from(document.querySelectorAll('img[alt="Condition"]')).filter((im) => im.naturalWidth > 0).length
    );
    if (loaded >= 30) break;
    await sleep(500);
  }
  log('C8 modal renders 30 loaded photos', (await modalImgs.count()) === 30 && loaded === 30, `count=${await modalImgs.count()}, loaded=${loaded}`);
  log('C9 photos open full size (anchor tiles)', (await adm.locator('a[title="Open full size"]').count()) === 30);
  await adm.keyboard.press('Escape');
  await sleep(600);

  // ================= D. DELIVERY -> FEEDBACK EMAIL -> 24H PURGE =================
  // Mark DELIVERED via the API (fires notifyOrderStatus; the email itself is
  // skipped in dev without BREVO_API_KEY, but each attempt logs "skipping
  // email send" — counting those lines proves the feedback email fired, and
  // that the repeat patch does NOT fire a second one (stage dedup).
  const LOG = '/home/z/my-project/work/p51-dev.log';
  const emailAttempts = () => {
    try {
      return (require('fs').readFileSync(LOG, 'utf8').match(/skipping email send/g) || []).length;
    } catch {
      return 0;
    }
  };
  const before = emailAttempts();
  const patch = await adm.evaluate(async (id) => {
    const r = await fetch(`/api/orders/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'DELIVERED' }),
    });
    return r.status;
  }, orderId);
  log('D1 PATCH -> DELIVERED ok', patch === 200, `status ${patch}`);
  await sleep(2000);
  log('D2 feedback email fired on delivery (+1 attempt)', emailAttempts() === before + 1, `${before} -> ${emailAttempts()}`);

  // stage-dedup: a second DELIVERED patch must NOT re-fire the email path
  const patch2 = await adm.evaluate(async (id) => {
    const r = await fetch(`/api/orders/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'DELIVERED' }),
    });
    return r.status;
  }, orderId);
  await sleep(2000);
  log('D3 repeat DELIVERED patch: no second email (dedup)', patch2 === 200 && emailAttempts() === before + 1, `status ${patch2}, attempts ${emailAttempts()}`);

  // age the delivery past the 24h guarantee window
  sql(`UPDATE \"Order\" SET \"deliveredAt\" = now() - interval '25 hours' WHERE id = '${orderId}'`);
  const aged = sql(`SELECT extract(epoch from (now() - \"deliveredAt\"))/3600 FROM \"Order\" WHERE id = '${orderId}'`).toString().trim();
  log('D4 delivery aged to +25h in DB', parseFloat(aged) > 24, `${aged}h`);

  const cron = await fetch(`${BASE}/api/cron/purge-media`, { headers: { 'x-vercel-cron': '1' } });
  const cronData = await cron.json();
  log('D5 cron purge removed the 30 photos', cron.status === 200 && cronData.purgedMedia >= 30, JSON.stringify(cronData));

  const after = await adm.evaluate(async (id) => {
    const r = await fetch(`/api/orders/${id}`);
    const d = await r.json();
    return { count: d?.order?.media?.length ?? -1, guarantee: d?.order?.guaranteeActive };
  }, orderId);
  log('D6 photos gone, guarantee flag intact (audit trail)', after.count === 0 && after.guarantee === true, JSON.stringify(after));

  // stale staged photo retention (created 25h ago, never claimed)
  sql(`INSERT INTO \"StagedPhoto\" (id, token, data, bytes, \"createdAt\") VALUES ('qa-staged-old-000000000001', 'qa-old', 'data:image/jpeg;base64,AAAA', 22, now() - interval '25 hours')`);
  const cron2 = await fetch(`${BASE}/api/cron/purge-media`, { headers: { 'x-vercel-cron': '1' } });
  const cron2Data = await cron2.json();
  const remaining = sql(`SELECT count(*) FROM \"StagedPhoto\" WHERE id = 'qa-staged-old-000000000001'`).toString().trim();
  log('D7 stale staged photo purged by the sweep', remaining === '0', `remaining=${remaining}, result=${JSON.stringify(cron2Data)}`);

  // board reflects the purge: badge gone, modal explains
  await adm.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
  const ordersTab2 = adm.locator('button:has-text("Orders")').first();
  for (let i = 0; i < 40 && (await ordersTab2.count()) === 0; i++) await sleep(500);
  await ordersTab2.click();
  for (let i = 0; i < 40 && (await adm.locator('[title^="30 condition photos"]').count()) > 0; i++) await sleep(500);
  // give the board a moment to settle after the badge disappears
  await sleep(1500);
  log('D8 badge gone after purge', (await adm.locator('[title^="30 condition photos"]').count()) === 0);
  // the ACTIVE board hides DELIVERED orders — reveal them first
  const completedToggle = adm.locator('button:has-text("Completed")').first();
  for (let i = 0; i < 20 && (await completedToggle.count()) === 0; i++) await sleep(500);
  if (await completedToggle.count() > 0) await completedToggle.click();
  // open the delivered order's modal (card and row both open it)
  const orderText = adm.locator(`text=${orderNumber}`).first();
  for (let i = 0; i < 30 && (await orderText.count()) === 0; i++) await sleep(500);
  await orderText.click();
  const noteLoc = adm.locator('text=/24-hour claim window after delivery has closed/');
  for (let i = 0; i < 30 && (await noteLoc.count()) === 0; i++) await sleep(500);
  log('D9 modal shows the claim-window-closed note', (await noteLoc.count()) >= 1, `count=${await noteLoc.count()}`);
  await adm.keyboard.press('Escape');

  // ================= E. REGRESSION =================
  const home = await cust.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  log('E1 home page 200', home && home.status() === 200, home && String(home.status()));
  const svc = await cust.goto(`${BASE}/services`, { waitUntil: 'domcontentloaded' });
  log('E2 /services 200', svc && svc.status() === 200, svc && String(svc.status()));
  log('E3 zero page errors across the run', errors.length === 0, errors.slice(0, 3).join(' | '));

  await browser.close();
  console.log(`\n===== PHASE 51 QA: ${pass} PASS / ${fail} FAIL =====`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => {
  console.error('QA crashed:', e);
  process.exit(2);
});
