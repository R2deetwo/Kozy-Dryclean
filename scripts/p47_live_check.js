// Phase 47 LIVE verification — cursor affordance on production kozycare.ng
const { chromium } = require('playwright');

let pass = 0, fail = 0;
function log(name, ok, extra) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? `  (${extra})` : ''}`);
  ok ? pass++ : fail++;
}

(async () => {
  // 1. HTML + CSS static checks (attribute order agnostic: extract the anchor
  //    that directly wraps the logo mark, then assert title + href)
  const html = await fetch('https://kozycare.ng/').then((r) => r.text());
  const logoAnchor = (html.match(/<a[^>]*><img[^>]*src="\/brand\/kozy-mark\.svg"/) || [])[0] || '';
  log('live: logo is an anchor with tooltip',
    logoAnchor.includes('title="Back to the home page"') && logoAnchor.includes('href="/'),
    logoAnchor.slice(0, 80));

  // find the stylesheet links and check the button cursor rule made it into the built CSS
  const cssUrls = [...html.matchAll(/href="(\/_next\/static\/[^"]+\.css)"/g)].map((m) => m[1]);
  let cssHasRule = false;
  for (const u of cssUrls) {
    const css = await fetch(`https://kozycare.ng${u}`).then((r) => r.text());
    if (/button:not\(:disabled\)[^}]*cursor:pointer|cursor:pointer[^;]*[^}]*button:not\(:disabled\)/.test(css.replace(/\s+/g, ''))) cssHasRule = true;
  }
  log('live: built CSS contains the button pointer rule', cssHasRule, `${cssUrls.length} css files`);

  // 2. Real browser checks on production
  const browser = await chromium.launch();
  const page = await browser.newContext({ viewport: { width: 1440, height: 1000 } }).then((c) => c.newPage());
  await page.goto('https://kozycare.ng/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const logoA = page.locator('a:has(img[alt="Kozy Care mark"])').first();
  await logoA.hover();
  const logoCursor = await logoA.evaluate((e) => getComputedStyle(e).cursor);
  log('live CURSOR: logo = pointer', logoCursor === 'pointer', logoCursor);

  const svc = page.getByRole('link', { name: /services & pricing/i }).first();
  const svcCursor = await svc.evaluate((e) => getComputedStyle(e).cursor);
  log('live CURSOR: Services & pricing = pointer', svcCursor === 'pointer', svcCursor);

  const bookBtn = page.getByRole('button', { name: /book pickup now/i }).first();
  const bookCursor = await bookBtn.evaluate((e) => getComputedStyle(e).cursor);
  log('live CURSOR: hero Book button = pointer', bookCursor === 'pointer', bookCursor);

  const signin = page.getByRole('link', { name: /sign in/i }).first();
  const siCursor = await signin.evaluate((e) => getComputedStyle(e).cursor);
  log('live CURSOR: Sign in = pointer', siCursor === 'pointer', siCursor);

  // logo click from /services -> home, client-side
  await page.goto('https://kozycare.ng/services', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.evaluate(() => { window.__p47 = 'alive'; });
  await page.locator('a:has(img[alt="Kozy Care mark"])').first().click();
  await page.waitForURL('https://kozycare.ng/', { timeout: 20000 });
  await page.waitForTimeout(800);
  const marker = await page.evaluate(() => window.__p47);
  log('live: logo click /services -> /', new URL(page.url()).pathname === '/', page.url());
  log('live: client-side nav (no reload)', marker === 'alive', `marker=${marker}`);

  await browser.close();
  console.log(`\n=== ${pass} PASS / ${fail} FAIL ===`);
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
