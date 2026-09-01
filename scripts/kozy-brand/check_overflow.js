// Overflow check: verify no text content extends past the trim box on the v4.2 pieces.
const { chromium } = require('playwright');
const path = require('path');

const W = '/home/z/my-project/work/kozy-brand';
const files = process.argv.slice(2);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 2000 } });
  for (const f of files) {
    await page.goto('file://' + path.join(W, f));
    await page.waitForTimeout(1200); // fonts
    const r = await page.evaluate(() => {
      const trim = document.querySelector('.trim');
      const tb = trim.getBoundingClientRect();
      const out = [];
      // check every text-bearing leaf inside trim
      trim.querySelectorAll('*').forEach(el => {
        if (el.children.length) return;
        const t = (el.textContent || '').trim();
        if (!t) return;
        const b = el.getBoundingClientRect();
        if (b.width === 0 || b.height === 0) return;
        const over = {
          r: Math.round(b.right - tb.right), l: Math.round(tb.left - b.left),
          b: Math.round(b.bottom - tb.bottom), t: Math.round(tb.top - b.top),
        };
        if (over.r > 0.5 || over.l > 0.5 || over.b > 0.5 || over.t > 0.5)
          out.push({ text: t.slice(0, 40), ...over });
      });
      return out;
    });
    if (r.length === 0) console.log(`✓ ${f}: no text outside trim`);
    else { console.log(`✗ ${f}:`); r.forEach(x => console.log('   ', JSON.stringify(x))); }
  }
  await browser.close();
})();
