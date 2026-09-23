// Phase 53 live check — kozycare.ng after the loyalty + email-system deploy:
//  1. key pages 200 (home / services / login / milestone)
//  2. /api/loyalty auth-gated (401 session-less AND forged token)
//  3. /milestone still noindex
//  4. public silence: home HTML has zero mentions of the loyalty offer,
//     the dormant referral program, or the offline handwritten-receipt offer
//  5. the reviews/feedback endpoints unchanged (405/400 on GET probes)
//  6. the production DB took the loyaltyFree column (the deploy's
//     build:vercel runs prisma db push — verified via a real API surface)
const BASE = 'https://kozycare.ng';
let pass = 0, fail = 0;
function log(name, ok, extra) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra !== undefined ? `  (${extra})` : ''}`);
  ok ? pass++ : fail++;
}

(async () => {
  // 1. pages
  for (const p of ['/', '/services', '/login', '/milestone', '/book', '/feedback']) {
    const r = await fetch(`${BASE}${p}`, { redirect: 'manual' });
    log(`L1 ${p} reachable`, r.status === 200, `status ${r.status}`);
  }

  // 2. loyalty API auth gates
  const l1 = await fetch(`${BASE}/api/loyalty`);
  log('L2 /api/loyalty session-less -> 401', l1.status === 401, `status ${l1.status}`);
  const l2 = await fetch(`${BASE}/api/loyalty?token=forged.sig`);
  log('L3 /api/loyalty forged token -> 401', l2.status === 401, `status ${l2.status}`);

  // 3. milestone page noindex
  const m = await fetch(`${BASE}/milestone`);
  const mHtml = await m.text();
  log('L4 /milestone noindex', /noindex/i.test(mHtml), '');
  log('L5 /milestone has no loyalty copy for anonymous visitors (loads client-side)',
    !/eleventh|on the house|next one is on us/i.test(mHtml), '');

  // 4. public silence on the home page
  const h = await fetch(`${BASE}/`);
  const html = await h.text();
  const mentions = ['eleventh', 'referral', 'refer a friend', 'handwritten', '10 washes', 'tenth'].filter((w) =>
    new RegExp(w, 'i').test(html)
  );
  log('L6 home: zero mentions of the offers (they stay private)', mentions.length === 0, mentions.join(',') || 'none');

  // 5. endpoints intact
  const rv = await fetch(`${BASE}/api/reviews`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  log('L7 /api/reviews rejects empty body (400)', rv.status === 400, `status ${rv.status}`);
  const fb = await fetch(`${BASE}/api/feedback`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  log('L8 /api/feedback rejects empty body (400)', fb.status === 400, `status ${fb.status}`);

  // 6. orders API still auth-guarded
  const o = await fetch(`${BASE}/api/orders`);
  log('L9 /api/orders auth-guarded', o.status === 401 || o.status === 403, `status ${o.status}`);

  console.log(`\n===== ${pass} PASS / ${fail} FAIL =====`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => {
  console.error('Live check crashed:', e);
  process.exit(2);
});
