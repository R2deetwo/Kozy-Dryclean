// Phase 46 — measure home page section heights (desktop + mobile).
// Usage: node scripts/p46_measure_home.js [--label before|after]
const { chromium } = require('playwright');

const BASE = 'http://localhost:3000';
const label = process.argv.includes('--label')
  ? process.argv[process.argv.indexOf('--label') + 1]
  : 'run';

(async () => {
  const browser = await chromium.launch();
  for (const [name, vp] of [
    ['desktop', { width: 1440, height: 1000 }],
    ['mobile', { width: 390, height: 844 }],
  ]) {
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200); // let prices/settings land

    const data = await page.evaluate(() => {
      const out = [];
      const secs = document.querySelectorAll('section, footer');
      for (const s of secs) {
        const r = s.getBoundingClientRect();
        const h = Math.round(r.height);
        if (h > 8) {
          const t = (s.querySelector('h1, h2, h3')?.textContent || '')
            .trim()
            .split('\n')[0]
            .slice(0, 44);
          out.push({ top: Math.round(r.top + window.scrollY), h, t, id: s.id || '' });
        }
      }
      return { total: document.body.scrollHeight, sections: out };
    });

    console.log(`\n===== ${label} · ${name} · TOTAL ${data.total}px =====`);
    for (const s of data.sections) {
      console.log(
        `${String(s.top).padStart(6)}px  ${String(s.h).padStart(5)}px  #${s.id || '-'} ${s.t}`
      );
    }
    await ctx.close();
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
