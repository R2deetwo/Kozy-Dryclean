// Task 85 — DOM audit: every rendered image on the marketing pages,
// reporting alt text presence so the fix list is exact (not guessed).
const { chromium } = require('playwright');

const BASE = 'http://localhost:3000';
const PAGES = ['/', '/services', '/memberships'];

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  const report = {};
  for (const path of PAGES) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    // scroll to bottom to trigger lazy content
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 800) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 120));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(1200);
    const imgs = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('img').forEach((el) => {
        out.push({
          src: (el.getAttribute('src') || '').slice(0, 90),
          alt: el.getAttribute('alt'),
          cls: (el.className || '').toString().slice(0, 50),
        });
      });
      // CSS background-image carriers (divs with bg image, no alt possible —
      // listed separately so we can judge decorative vs meaningful)
      const bgs = [];
      document.querySelectorAll('div,section').forEach((el) => {
        const bg = getComputedStyle(el).backgroundImage;
        if (bg && bg.includes('url(') && bg.includes('/brand') ) {
          bgs.push(bg.slice(0, 110));
        }
      });
      return { imgs: out, bgs };
    });
    report[path] = imgs;
    const missing = imgs.imgs.filter((i) => i.alt === null || i.alt === undefined || i.alt.trim() === '');
    console.log(`\n=== ${path}: ${imgs.imgs.length} <img> (${missing.length} missing alt), ${imgs.bgs.length} brand bg-images ===`);
    imgs.imgs.forEach((i, idx) => {
      const flag = i.alt ? 'OK  ' : 'MISS';
      console.log(`  [${flag}] ${String(idx).padStart(2)} src=${i.src} alt=${JSON.stringify(i.alt)}`);
    });
    imgs.bgs.slice(0, 10).forEach((b) => console.log(`  [BG] ${b}`));
  }
  require('fs').writeFileSync('/home/z/my-project/work/t85_img_audit.json', JSON.stringify(report, null, 2));
  await browser.close();
})();
