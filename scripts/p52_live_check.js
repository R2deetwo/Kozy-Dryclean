// Phase 52 live check on kozycare.ng — read-only, no orders placed, no emails.
//   1. /milestone page loads + noindex
//   2. /api/referrals auth-guarded (401 with and without bad token)
//   3. /api/marketing/coupons/validate rejects garbage codes (429/400 family)
//   4. Public pages healthy (home, services, book, login, feedback)
//   5. Silence: home HTML has no referral program mentions
const BASE = 'https://kozycare.ng';

let pass = 0, fail = 0;
function log(name, ok, extra) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra !== undefined ? `  (${extra})` : ''}`);
  ok ? pass++ : fail++;
}

(async () => {
  // 1. milestone page + noindex
  const mile = await fetch(`${BASE}/milestone`);
  const mileHtml = await mile.text();
  log('L1 /milestone loads', mile.status === 200, `status ${mile.status}`);
  log('L2 /milestone is noindex',
    /name="robots"\s+content="noindex,nofollow"/i.test(mileHtml) ||
    /noindex/i.test((mileHtml.match(/<meta[^>]*robots[^>]*>/i) || [''])[0]),
    (mileHtml.match(/<meta[^>]*robots[^>]*>/i) || ['no meta'])[0].slice(0, 80));

  // 2. referrals API is auth-guarded
  const r1 = await fetch(`${BASE}/api/referrals`);
  log('L3 /api/referrals: 401 without auth', r1.status === 401, `status ${r1.status}`);
  const r2 = await fetch(`${BASE}/api/referrals?token=forged.payload`);
  log('L4 /api/referrals: 401 with forged token', r2.status === 401, `status ${r2.status}`);

  // 3. coupon validate stays strict (garbage code rejected)
  const cv = await fetch(`${BASE}/api/marketing/coupons/validate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'FAKE-999', serviceSubtotal: 5000 }),
  });
  const cvData = await cv.json().catch(() => ({}));
  log('L5 coupon validate: garbage code rejected',
    (cv.status === 400 || cv.status === 429) || (cvData.valid === false),
    `status ${cv.status}, ${JSON.stringify(cvData).slice(0, 60)}`);

  // 4. public pages healthy
  for (const path of ['/', '/services', '/book', '/login', '/feedback']) {
    const r = await fetch(`${BASE}${path}`);
    log(`L6 ${path} -> 200`, r.status === 200, `status ${r.status}`);
  }

  // 5. public silence — no referral mentions on the home page
  const home = await fetch(`${BASE}/`);
  const homeHtml = await home.text();
  const leaks = (homeHtml.match(/referral|refer a friend|invite a friend/gi) || []).length;
  log('L7 home HTML: zero referral mentions', leaks === 0, `${leaks} matches`);

  // 6. reviews API still public-shaped (GET testimonials works)
  const rev = await fetch(`${BASE}/api/reviews`);
  const revData = await rev.json().catch(() => null);
  log('L8 /api/reviews (GET) returns testimonials',
    rev.status === 200 && revData && Array.isArray(revData.testimonials),
    `status ${rev.status}, ${revData && revData.testimonials ? revData.testimonials.length : '?'} entries`);

  console.log(`\n===== ${pass} PASS / ${fail} FAIL =====`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => { console.error('Live check crashed:', e); process.exit(2); });
