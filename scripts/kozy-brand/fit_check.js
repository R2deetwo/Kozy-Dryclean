// fit_check.js — verify ALL elements (not just text) sit inside .trim
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const files = process.argv.slice(2);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 2200 } });
  for (const f of files) {
    await page.goto('file://' + path.resolve(f));
    await page.waitForTimeout(1200);
    const r = await page.evaluate(() => {
      const trim = document.querySelector('.trim');
      const tb = trim.getBoundingClientRect();
      const out = [];
      trim.querySelectorAll('*').forEach(el => {
        const b = el.getBoundingClientRect();
        if (b.width === 0 || b.height === 0) return;
        const over = {
          r: Math.round(b.right - tb.right), l: Math.round(tb.left - b.left),
          b: Math.round(b.bottom - tb.bottom), t: Math.round(tb.top - b.top),
        };
        if (over.r > 0.5 || over.l > 0.5 || over.b > 0.5 || over.t > 0.5)
          out.push({ tag: el.tagName, cls: el.className.baseVal || el.className,
                     text: (el.textContent || '').trim().slice(0, 30), ...over });
      });
      return out;
    });
    if (r.length === 0) console.log(`✓ ${path.basename(f)}: all elements inside trim`);
    else { console.log(`✗ ${path.basename(f)}:`); r.forEach(x => console.log('   ', JSON.stringify(x))); }
  }
  await browser.close();
})();
