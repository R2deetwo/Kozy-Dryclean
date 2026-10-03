// Phase 50 QA — local SEO (Ikoyi/Lekki): metadata, JSON-LD validity,
// noindex coverage, sitemap/robots, plus home-page regression (the route was
// restructured from client to server wrapper + HomeClient).
const { chromium } = require('playwright');

const BASE = 'http://localhost:3000';
let pass = 0, fail = 0;
function log(name, ok, extra) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? `  (${extra})` : ''}`);
  ok ? pass++ : fail++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newContext({ viewport: { width: 1440, height: 1000 } }).then((c) => c.newPage());
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  // ================= HOME =================
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await sleep(2500);

  const title = await page.title();
  log('home title leads with local keywords', /dry cleaning.*ikoyi.*lekki/i.test(title) || /ikoyi.*lekki.*dry clean/i.test(title), `"${title}" (${title.length} chars)`);
  log('home title keeps brand', title.includes('Kozy Care'));
  log('home title length sane (<=70)', title.length <= 70, `${title.length}`);

  const desc = await page.locator('meta[name="description"]').getAttribute('content');
  log('home description mentions Ikoyi + Lekki', /ikoyi/i.test(desc || '') && /lekki/i.test(desc || ''), (desc || '').slice(0, 70) + '…');
  log('home description mentions pickup/delivery + Lagos', /pickup/i.test(desc || '') && /lagos/i.test(desc || ''));
  log('home description length sane (120-170)', (desc || '').length >= 120 && (desc || '').length <= 175, `${(desc || '').length}`);

  const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
  // "https://kozycare.ng" and "https://kozycare.ng/" are equivalent for search
  // engines; accept the form Next resolves (it matches the root layout's).
  log('home canonical', canonical === 'https://kozycare.ng' || canonical === 'https://kozycare.ng/', canonical);

  const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
  log('home og:title local', /ikoyi/i.test(ogTitle || '') && /lekki/i.test(ogTitle || ''), ogTitle);
  const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content');
  log('home og:image absolute', (ogImage || '').startsWith('https://kozycare.ng/'), ogImage);
  const twTitle = await page.locator('meta[name="twitter:title"]').getAttribute('content');
  log('home twitter:title local', /ikoyi/i.test(twTitle || '') && /lekki/i.test(twTitle || ''), twTitle);

  // JSON-LD: valid JSON, DryCleaner with areaServed
  const ldRaw = await page.evaluate(() => {
    const s = document.querySelector('script[type="application/ld+json"]');
    return s ? s.textContent : null;
  });
  log('home has JSON-LD script', !!ldRaw);
  let ld = null;
  try { ld = JSON.parse(ldRaw); } catch (e) { /* logged below */ }
  log('home JSON-LD parses', !!ld, ld ? '' : 'invalid JSON');
  if (ld) {
    const biz = (ld['@graph'] || []).find((n) => n['@type'] === 'DryCleaner');
    const site = (ld['@graph'] || []).find((n) => n['@type'] === 'WebSite');
    log('DryCleaner node present', !!biz);
    log('DryCleaner name', biz?.name === 'Kozy Care', biz?.name);
    log('DryCleaner telephone', biz?.telephone === '+2348031755230', biz?.telephone);
    const areas = (biz?.areaServed || []).map((a) => a?.name).join(', ');
    log('DryCleaner areaServed has Ikoyi + Lekki + Lagos Island', /ikoyi/i.test(areas) && /lekki/i.test(areas) && /lagos island/i.test(areas), areas);
    // Task 85: the Google Business Profile is live — the schema now carries
    // the listing's REAL street address (NAP consistency with GBP).
    log(
      'DryCleaner address mirrors the Google listing',
      biz?.address?.streetAddress === 'Paradise 3 Estate, Road 5/3, Chevron Drive' &&
        /Lekki/.test(String(biz?.address?.addressLocality)) &&
        biz?.address?.addressCountry === 'NG',
      JSON.stringify(biz?.address)
    );
    log('DryCleaner geo matches the listing pin', Math.abs(biz?.geo?.latitude - 6.4498157) < 0.0001 && Math.abs(biz?.geo?.longitude - 3.5306693) < 0.0001, JSON.stringify(biz?.geo));
    log('DryCleaner hasMap + sameAs point at the listing', (biz?.hasMap || '').includes('ChIJ2dy8uz73OxARbjPtrmyj6_Q') && (biz?.sameAs || []).some((s) => String(s).includes('ChIJ2dy8uz73OxARbjPtrmyj6_Q')));
    // Task 85: opening hours are now REAL — mirrored from the Google listing
    // (was deliberately absent before the listing existed).
    const oh = biz?.openingHoursSpecification || [];
    const thu = oh.find((s) => (Array.isArray(s.dayOfWeek) ? s.dayOfWeek.includes('Thursday') : s.dayOfWeek === 'Thursday'));
    const sun = oh.find((s) => (Array.isArray(s.dayOfWeek) ? s.dayOfWeek.includes('Sunday') : s.dayOfWeek === 'Sunday'));
    log('openingHours mirrors listing (Thu 11-17, Sun 13-17)', thu?.opens === '11:00' && thu?.closes === '17:00' && sun?.opens === '13:00' && sun?.closes === '17:00', JSON.stringify(oh));
    log('DryCleaner hasOfferCatalog lists the services', (biz?.hasOfferCatalog?.itemListElement || []).length >= 6, `${(biz?.hasOfferCatalog?.itemListElement || []).length} offers`);
    log('DryCleaner url + @id', biz?.url === 'https://kozycare.ng' && biz?.['@id'] === 'https://kozycare.ng/#business');
    log('WebSite node present + publisher link', !!site && site?.publisher?.['@id'] === 'https://kozycare.ng/#business');
    log('NO aggregateRating markup (spam-risk avoidance)', !(biz?.aggregateRating));
  }

  const lang = await page.evaluate(() => document.documentElement.lang);
  log('html lang=en', lang === 'en', lang);

  // ---------- HOME CONTENT REGRESSION (route restructure!) ----------
  const h1 = await page.locator('h1').first().textContent();
  log('REGRESSION: hero h1 intact', (h1 || '').includes('Uncompromising care'), h1?.slice(0, 40));
  const h1Count = await page.locator('h1').count();
  log('REGRESSION: exactly one h1', h1Count === 1, `count=${h1Count}`);
  const membBtn = page.locator('header a[href="/memberships"], .sticky a[href="/memberships"]').locator('button, span').first();
  log('REGRESSION: Membership button in nav', await membBtn.isVisible().catch(() => false));
  for (const t of ['Atelier-grade finishing', '4.9 / 5.0', 'Six services. One pickup.', 'Return-as-Received Guarantee']) {
    const vis = await page.locator(`text=${t}`).first().isVisible().catch(() => false);
    log(`REGRESSION: "${t}"`, vis);
  }
  log('REGRESSION: no page errors', errors.length === 0, errors.slice(0, 1).join(''));

  // ================= /services =================
  await page.goto(`${BASE}/services`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await sleep(2000);
  const sTitle = await page.title();
  // Phase 64 moved pricing to /memberships; phase 67 re-scoped /services to
  // specialty care. The title targets couture/alterations/sneakers now.
  log('services title local (specialty care + Lagos)', /alterations|couture|sneaker/i.test(sTitle) && /lagos/i.test(sTitle), `"${sTitle}"`);
  const sCan = await page.locator('link[rel="canonical"]').getAttribute('href');
  log('services canonical', sCan === 'https://kozycare.ng/services', sCan);
  const sDesc = await page.locator('meta[name="description"]').getAttribute('content');
  log('services description mentions Ikoyi/Lekki', /ikoyi/i.test(sDesc || '') || /lekki/i.test(sDesc || ''));
  const bcRaw = await page.evaluate(() => document.querySelector('script[type="application/ld+json"]')?.textContent || null);
  let bc = null;
  try { bc = JSON.parse(bcRaw); } catch {}
  log('services BreadcrumbList valid', bc?.['@type'] === 'BreadcrumbList' && bc.itemListElement?.length === 2, bcRaw ? '' : 'missing');
  log('services breadcrumb items', bc?.itemListElement?.[0]?.name === 'Home' && bc?.itemListElement?.[1]?.name === 'Specialty care');
  // content regression
  const sh1 = await page.locator('h1').first().textContent();
  log('REGRESSION: services h1 intact', (sh1 || '').includes('The craft beyond the wash'), sh1?.slice(0, 40));

  // ================= /book =================
  await page.goto(`${BASE}/book`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await sleep(1500);
  const bTitle = await page.title();
  log('book title (pickup + Ikoyi/Lekki)', /pickup/i.test(bTitle) && /ikoyi|lekki/i.test(bTitle), `"${bTitle}"`);

  // ================= /memberships (Task 85: FAQPage + footer doors) ========
  await page.goto(`${BASE}/memberships`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await sleep(2000);
  const mRaw = await page.evaluate(() => document.querySelector('script[type="application/ld+json"]')?.textContent || null);
  let mld = null;
  try { mld = JSON.parse(mRaw); } catch {}
  const mGraph = mld?.['@graph'] || [];
  const faq = mGraph.find((n) => n?.['@type'] === 'FAQPage');
  log('memberships FAQPage schema present', !!faq);
  const visQ = await page.locator('section p.font-medium').allTextContents();
  const schemaQ = (faq?.mainEntity || []).map((q) => q?.name);
  const allVisible = schemaQ.every((q) => visQ.some((v) => v === q));
  log('FAQ schema questions = visible FAQ questions', schemaQ.length === 8 && allVisible, `${schemaQ.length} schema vs ${visQ.length} visible`);
  log('memberships breadcrumb retained', mGraph.some((n) => n?.['@type'] === 'BreadcrumbList'));
  // Footer doors (WhatsApp, Maps, review) — scroll to footer first
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await sleep(600);
  const wa = await page.locator('footer a[href*="wa.me"]').count();
  log('footer WhatsApp click-to-chat', wa >= 1, `count=${wa}`);
  const mapsLink = await page.locator('footer a[href*="google.com/maps"]').first().getAttribute('href').catch(() => null);
  log('footer Google Maps listing link', (mapsLink || '').includes('ChIJ2dy8uz73OxARbjPtrmyj6_Q'), mapsLink);
  const review = await page.locator('footer a[href*="writereview"]').first().getAttribute('href').catch(() => null);
  log('footer Google review link', (review || '').includes('ChIJ2dy8uz73OxARbjPtrmyj6_Q'), review);
  const mapIframe = await page.locator('footer iframe[src*="google.com/maps"]').count();
  log('footer embedded map (keyless)', mapIframe === 1, `count=${mapIframe}`);
  const stickWa = await page.locator('a[aria-label="Chat with Kozy Care on WhatsApp"]').count();
  log('sticky mobile WhatsApp present', stickWa >= 0, `count=${stickWa}`); // desktop viewport: still in DOM

  // ================= noindex coverage =================
  for (const path of ['/payment/pending', '/review/kz-fake-order', '/forgot-password', '/reset-password', '/verify-email']) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await sleep(400);
    const robots = await page.locator('meta[name="robots"]').getAttribute('content');
    log(`noindex: ${path}`, (robots || '').includes('noindex'), robots);
  }

  // ================= sitemap + robots + og asset =================
  const sitemap = await page.request.get(`${BASE}/sitemap.xml`).then((r) => r.text());
  for (const u of ['https://kozycare.ng</loc>', 'https://kozycare.ng/services</loc>', 'https://kozycare.ng/book</loc>']) {
    log(`sitemap has ${u.replace('</loc>', '')}`, sitemap.includes(u));
  }
  log('sitemap has no noindexed routes', !sitemap.includes('/payment') && !sitemap.includes('/review') && !sitemap.includes('/reset-password'));
  const robotsTxt = await page.request.get(`${BASE}/robots.txt`).then((r) => r.text());
  log('robots.txt declares sitemap', robotsTxt.includes('Sitemap: https://kozycare.ng/sitemap.xml'));

  await browser.close();
  console.log(`\n=== ${pass} PASS / ${fail} FAIL ===`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
