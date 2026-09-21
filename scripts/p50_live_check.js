// Phase 50 QA — local SEO (Ikoyi/Lekki): metadata, JSON-LD validity,
// noindex coverage, sitemap/robots, plus home-page regression (the route was
// restructured from client to server wrapper + HomeClient).
const { chromium } = require('playwright');

const BASE = 'https://kozycare.ng';
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
    log('DryCleaner city-level address (no fake street)', biz?.address?.addressLocality === 'Lagos' && !biz?.address?.streetAddress, JSON.stringify(biz?.address));
    log('DryCleaner url + @id', biz?.url === 'https://kozycare.ng' && biz?.['@id'] === 'https://kozycare.ng/#business');
    log('WebSite node present + publisher link', !!site && site?.publisher?.['@id'] === 'https://kozycare.ng/#business');
    log('NO aggregateRating markup (spam-risk avoidance)', !(biz?.aggregateRating));
    log('NO invented openingHours', !(biz?.openingHours || biz?.openingHoursSpecification));
  }

  const lang = await page.evaluate(() => document.documentElement.lang);
  log('html lang=en', lang === 'en', lang);

  // ---------- HOME CONTENT REGRESSION (route restructure!) ----------
  const h1 = await page.locator('h1').first().textContent();
  log('REGRESSION: hero h1 intact', (h1 || '').includes('Uncompromising care'), h1?.slice(0, 40));
  const h1Count = await page.locator('h1').count();
  log('REGRESSION: exactly one h1', h1Count === 1, `count=${h1Count}`);
  log('REGRESSION: navy Pricing pill', (await page.locator('.sticky a[href="/services"] button').evaluate((e) => getComputedStyle(e).backgroundColor)) === 'rgb(10, 25, 47)');
  for (const t of ['Atelier-grade finishing', '4.9 / 5.0', 'Six services. One pickup.', 'Return-as-Received Guarantee', 'Loved by Lagos.']) {
    const vis = await page.locator(`text=${t}`).first().isVisible().catch(() => false);
    log(`REGRESSION: "${t}"`, vis);
  }
  log('REGRESSION: no page errors', errors.length === 0, errors.slice(0, 1).join(''));

  // ================= /services =================
  await page.goto(`${BASE}/services`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await sleep(2000);
  const sTitle = await page.title();
  log('services title local (prices + Ikoyi/Lekki)', /price/i.test(sTitle) && /ikoyi/i.test(sTitle) && /lekki/i.test(sTitle), `"${sTitle}"`);
  const sCan = await page.locator('link[rel="canonical"]').getAttribute('href');
  log('services canonical', sCan === 'https://kozycare.ng/services', sCan);
  const sDesc = await page.locator('meta[name="description"]').getAttribute('content');
  log('services description mentions Ikoyi/Lekki', /ikoyi/i.test(sDesc || '') || /lekki/i.test(sDesc || ''));
  const bcRaw = await page.evaluate(() => document.querySelector('script[type="application/ld+json"]')?.textContent || null);
  let bc = null;
  try { bc = JSON.parse(bcRaw); } catch {}
  log('services BreadcrumbList valid', bc?.['@type'] === 'BreadcrumbList' && bc.itemListElement?.length === 2, bcRaw ? '' : 'missing');
  log('services breadcrumb items', bc?.itemListElement?.[0]?.name === 'Home' && bc?.itemListElement?.[1]?.name === 'Services & pricing');
  // content regression
  const sh1 = await page.locator('h1').first().textContent();
  log('REGRESSION: services h1 intact', (sh1 || '').includes('Everything Kozy Care does'), sh1?.slice(0, 40));

  // ================= /book =================
  await page.goto(`${BASE}/book`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await sleep(1500);
  const bTitle = await page.title();
  log('book title (pickup + Ikoyi/Lekki)', /pickup/i.test(bTitle) && /ikoyi|lekki/i.test(bTitle), `"${bTitle}"`);

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
