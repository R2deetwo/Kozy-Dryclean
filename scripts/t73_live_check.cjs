// =============================================================================
// Task 73 LIVE verification (kozycare.ng) — READ-ONLY, no test data on prod.
// Checks the four shipped surfaces: distance-aware rider pay rates, the
// join-dialog account step code path (server-rendered shells + the rate card
// the dialog's pages consume), the /signup-success conversion route, and the
// SEO package.
// =============================================================================
const BASE = 'https://kozycare.ng'
let pass = 0
let fail = 0

function ok(name, cond, extra = '') {
  if (cond) {
    pass++
    console.log(`  PASS ${name}${extra ? ' — ' + extra : ''}`)
  } else {
    fail++
    console.log(`  FAIL ${name}${extra ? ' — ' + extra : ''}`)
  }
}

;(async () => {
  // ================================================================
  // [1] The conversion route
  // ================================================================
  console.log('\n[1] /signup-success')
  let res = await fetch(`${BASE}/signup-success?email=live@kozy.test`)
  let html = await res.text()
  ok('route serves 200', res.status === 200)
  ok('shows the check-your-email notice', html.includes('Account created') || html.includes('check your email'))
  ok('noindex, nofollow', /<meta\s+name="robots"\s+content="noindex/i.test(html))
  ok('title branded', /Account created/.test(html))

  res = await fetch(`${BASE}/signup`)
  html = await res.text()
  // The form itself hydrates client-side inside Suspense (useSearchParams),
  // so SSR HTML shows the fallback — assert on the server-rendered title.
  ok('/signup form still serves', res.status === 200 && /Create Account/.test(html))

  // ================================================================
  // [2] SEO package
  // ================================================================
  console.log('\n[2] SEO package')
  res = await fetch(`${BASE}/sitemap.xml`)
  const sitemap = await res.text()
  ok('sitemap lists /partners', sitemap.includes('/partners'))
  ok('sitemap does not list /signup-success', !sitemap.includes('/signup-success'))
  ok('sitemap still lists core pages', sitemap.includes('/memberships') && sitemap.includes('/services') && sitemap.includes('/book'))

  res = await fetch(`${BASE}/robots.txt`)
  const robots = await res.text()
  ok('robots disallows /partner portal', robots.includes('Disallow: /partner'))
  ok('robots disallows /signup-success', robots.includes('Disallow: /signup-success'))
  ok('robots disallows /verify-email + /review', robots.includes('Disallow: /verify-email') && robots.includes('Disallow: /review'))
  ok('sitemap directive intact', robots.includes('Sitemap: https://kozycare.ng/sitemap.xml'))

  // ================================================================
  // [3] The rider rate card (distance-aware pay)
  // ================================================================
  console.log('\n[3] Rider rate card (public settings payload)')
  res = await fetch(`${BASE}/api/settings/app`)
  const body = await res.json().catch(() => ({}))
  const s = body.settings ?? body
  ok('settings payload loads', res.status === 200 && !!s)
  ok('base rates 1500/1500 (owner decision)', s.riderPickupRate === 1500 && s.riderDeliveryRate === 1500, `${s.riderPickupRate}/${s.riderDeliveryRate}`)
  ok('distance rate 150/km', s.riderPerKmRate === 150, String(s.riderPerKmRate))
  ok('free km 4', s.riderFreeKm === 4, String(s.riderFreeKm))
  ok('distance cap 1800', s.riderDistanceCap === 1800, String(s.riderDistanceCap))

  // ================================================================
  // [4] Regression guards — the surfaces this deploy must not break
  // ================================================================
  console.log('\n[4] Regression guards')
  res = await fetch(`${BASE}/api/subscriptions/plans`)
  const plansBody = await res.json().catch(() => ({}))
  const plans = Array.isArray(plansBody) ? plansBody : (plansBody.plans ?? [])
  const active = plans.filter((p) => p.isActive !== false)
  ok('plans API healthy', res.status === 200 && active.length >= 6, `${active.length} active plans`)
  const club = active.filter((p) => (p.family ?? 'KIT') === 'SHOES')
  ok('club ladder intact (2/4/6)', club.length === 3 && [2, 4, 6].every((n, i) => (club[i]?.shoesPerMonth ?? club.find((c) => c.shoesPerMonth === n)) && club.some((c) => c.shoesPerMonth === n)))

  res = await fetch(`${BASE}/`)
  html = await res.text()
  ok('home serves', res.status === 200)
  ok('Google tags stay OFF until the office sets IDs', !html.includes('googletagmanager.com/gtag/js'))
  ok('Vercel analytics still present', html.includes('/_vercel/insights/script.js'))

  res = await fetch(`${BASE}/memberships`)
  html = await res.text()
  ok('/memberships serves', res.status === 200)

  res = await fetch(`${BASE}/driver`)
  html = await res.text()
  ok('rider app shell serves (login gate)', res.status === 200)

  console.log(`\n==== T73 LIVE: ${pass} PASS, ${fail} FAIL ====`)
  process.exit(fail > 0 ? 1 : 0)
})().catch((e) => {
  console.error('live verify crashed:', e)
  process.exit(1)
})
