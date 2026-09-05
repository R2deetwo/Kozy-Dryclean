// measure_v62_clearance.js — hard numbers for the two VLM-flagged spots:
//  (1) institutional flyer footer line vs trim bottom
//  (2) A4 corporate sheet docref ("SERVICE OVERVIEW · LAGOS 2026") vs trim top
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require('playwright-core')); }

const files = [
  { f: '/home/z/my-project/work/kozy-brand/gold-corporate/flyer-institutional-front.html',
    sel: '.foot, .contact, .footer', name: 'flyer front footer' },
  { f: '/home/z/my-project/work/kozy-brand/gold-corporate/corporate-sheet-a4.html',
    sel: '.docref', name: 'A4 docref' },
];

(async () => {
  const browser = await chromium.launch();
  for (const { f, sel, name } of files) {
    const page = await browser.newPage({ viewport: { width: 1400, height: 2200 } });
    await page.goto('file://' + f, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    const r = await page.evaluate(({ sel }) => {
      const trim = document.querySelector('.trim').getBoundingClientRect();
      const out = { trim: { top: trim.top, bottom: trim.bottom, left: trim.left, right: trim.right }, nodes: [] };
      const push = (label, rect) => out.nodes.push({
        label,
        topClearance: +(trim.top - rect.top).toFixed(1),
        bottomClearance: +(trim.bottom - rect.bottom).toFixed(1),
        leftClearance: +(rect.left - trim.left).toFixed(1),
        rightClearance: +(trim.right - rect.right).toFixed(1),
      });
      document.querySelectorAll(sel).forEach(el => {
        const b = el.getBoundingClientRect();
        push('el:' + (el.textContent || '').trim().slice(0, 40), b);
        // every text line inside via Range
        el.childNodes.forEach(n => {
          if (n.nodeType === 3 && n.textContent.trim()) {
            const range = document.createRange();
            range.selectNodeContents(n);
            for (const r2 of range.getClientRects()) push('txt:' + n.textContent.trim().slice(0, 40), r2);
          }
        });
      });
      // also: deepest text node anywhere in the trim (footer sanity)
      if (sel.includes('foot') || sel.includes('contact')) {
        let deepest = null;
        const walker = document.createTreeWalker(document.querySelector('.trim'), NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
          const t = node.textContent.trim();
          if (!t) continue;
          const range = document.createRange();
          range.selectNodeContents(node);
          for (const r2 of range.getClientRects()) {
            const c = +(trim.bottom - r2.bottom).toFixed(1);
            if (deepest === null || c < deepest.clearance) deepest = { clearance: c, label: t.slice(0, 46) };
          }
        }
        out.deepestTextInTrim = deepest;
      }
      return out;
    }, { sel });
    console.log(`\n== ${name} (${f.split('/').pop()})`);
    r.nodes.forEach(n => console.log(`   ${n.label}\n     top:${n.topClearance}px  bottom:${n.bottomClearance}px  left:${n.leftClearance}px  right:${n.rightClearance}px`));
    if (r.deepestTextInTrim) console.log(`   DEEPEST text in trim: "${r.deepestTextInTrim.label}" → ${r.deepestTextInTrim.clearance}px inside bottom`);
    await page.close();
  }
  await browser.close();
})();
