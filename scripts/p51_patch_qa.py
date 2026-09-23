#!/usr/bin/env python3
"""Phase 51 — rework the D-section of scripts/p51_qa.js:
- count email attempts from the dev log around the DELIVERED patch (+1),
- assert the repeat patch adds none (stage-email dedup),
- renumber checks D1..D9."""
import re

P = '/home/z/my-project/scripts/p51_qa.js'
s = open(P).read()

start = s.index('  // ================= D. DELIVERY')
end = s.index('  // ================= E. REGRESSION')

new_d = '''  // ================= D. DELIVERY -> FEEDBACK EMAIL -> 24H PURGE =================
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
  execSync(`${PG} "UPDATE \\"Order\\" SET \\"deliveredAt\\" = now() - interval '25 hours' WHERE id = '${orderId}'"`);
  const aged = execSync(`${PG} "SELECT extract(epoch from (now() - \\"deliveredAt\\"))/3600 FROM \\"Order\\" WHERE id = '${orderId}'"`).toString().trim();
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
  execSync(`${PG} "INSERT INTO \\"StagedPhoto\\" (id, token, data, bytes, \\"createdAt\\") VALUES ('qa-staged-old-000000000001', 'qa-old', 'data:image/jpeg;base64,AAAA', 22, now() - interval '25 hours')"`);
  const cron2 = await fetch(`${BASE}/api/cron/purge-media`, { headers: { 'x-vercel-cron': '1' } });
  const cron2Data = await cron2.json();
  const remaining = execSync(`${PG} "SELECT count(*) FROM \\"StagedPhoto\\" WHERE id = 'qa-staged-old-000000000001'"`).toString().trim();
  log('D7 stale staged photo purged by the sweep', remaining === '0', `remaining=${remaining}, result=${JSON.stringify(cron2Data)}`);

  // board reflects the purge: badge gone, modal explains
  await adm.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' });
  await sleep(3500);
  log('D8 badge gone after purge', (await adm.locator('[title^="30 condition photos"]').count()) === 0);
  // open the delivered order's modal (card and row both open it)
  await adm.locator(`text=${orderNumber}`).first().click();
  await sleep(2500);
  const note = await adm.locator('text=/24-hour claim window after delivery has closed/').count();
  log('D9 modal shows the claim-window-closed note', note >= 1, `count=${note}`);
  await adm.keyboard.press('Escape');

'''

s = s[:start] + new_d + s[end:]
open(P, 'w').write(s)
print('OK: D-section reworked')
print('sanity:', 'D9 modal shows' in s and 'D2 feedback email fired' in s)
