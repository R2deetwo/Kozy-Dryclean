#!/usr/bin/env node
// audit_v6_fit.js — measure EVERY visible element (text, images, boxes) inside
// .trim against the trim rectangle for the v6 print/digital HTML sources.
//
// Reports elements that cross the trim edge (would be cut by the cutter) and
// the clearance of the deepest content from the trim bottom — so the build
// scripts can be tuned until every piece passes with a safe margin.
//
// Usage: node audit_v6_fit.js <file1.html> [file2.html ...]
//        (paths relative to /home/z/my-project/work/kozy-brand or absolute)
const path = require('path');
const fs = require('fs');
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require('playwright-core')); }

const W = '/home/z/my-project/work/kozy-brand';
const argv = process.argv.slice(2);

// elements that are allowed to touch the trim edge by design
const EDGE_OK = new Set(['goldband', 'goldband-b', 'topline', 'bottomline', 'frame', 'marks']);
// minimum clearance required below the last content element (px)
const SAFE_BOTTOM = 8;

(async () => {
  const browser = await chromium.launch();
  const results = [];
  for (const f of argv) {
    const abs = f.startsWith('/') ? f : path.join(W, f);
    if (!fs.existsSync(abs)) { console.log(`SKIP (missing) ${f}`); continue; }
    const page = await browser.newPage({ viewport: { width: 1400, height: 2200 } });
    await page.goto('file://' + abs, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    const r = await page.evaluate((SAFE_BOTTOM) => {
      const trim = document.querySelector('.trim');
      if (!trim) return { error: 'no .trim' };
      const tb = trim.getBoundingClientRect();
      const out = [];
      let deepest = { bottom: -1e9, label: '' };
      const isEdgeOk = (el) => {
        for (let e = el; e && e !== trim; e = e.parentElement)
          if (EDGE_OK_LOCAL.has(e.className && e.className.baseVal !== undefined ? e.className.baseVal : e.className)) return true;
        return false;
      };
      const EDGE_OK_LOCAL = new Set(['goldband', 'goldband-b', 'topline', 'bottomline', 'frame', 'marks']);
      const visible = (el) => {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') return false;
        const bg = cs.backgroundColor;
        const hasBg = bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent';
        const hasBorder = parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderLeftWidth) > 0;
        return hasBg || hasBorder || el.tagName === 'IMG' || el.tagName === 'SVG';
      };
      const report = (rect, label, tag) => {
        if (rect.width < 1 || rect.height < 1) return;
        const over = {
          r: +(rect.right - tb.right).toFixed(1),
          l: +(tb.left - rect.left).toFixed(1),
          b: +(rect.bottom - tb.bottom).toFixed(1),
          t: +(tb.top - rect.top).toFixed(1),
        };
        if (over.b > deepest.bottom) { deepest = { bottom: over.b, label }; }
        if (over.r > 0.5 || over.l > 0.5 || over.b > 0.5 || over.t > 0.5)
          out.push({ tag, label, ...over });
      };
      // 1) every element: media or visibly-boxed (bg/border)
      trim.querySelectorAll('*').forEach(el => {
        const cls = (el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className) || '';
        if (EDGE_OK_LOCAL.has(cls)) return;
        const tag = el.tagName;
        const isMedia = tag === 'IMG' || tag === 'SVG';
        if (!isMedia && !visible(el)) return;
        const b = el.getBoundingClientRect();
        const label = (el.textContent || tag).trim().slice(0, 46).replace(/\s+/g, ' ');
        report(b, label, tag);
      });
      // 2) every text node (Range API — catches bare text in mixed containers)
      const walker = document.createTreeWalker(trim, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const t = node.textContent.trim();
        if (!t) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const r of range.getClientRects()) {
          if (r.width < 1 || r.height < 1) continue;
          report({ left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height },
            t.slice(0, 46).replace(/\s+/g, ' '), 'TXT');
        }
      }
      return {
        trim: { w: +tb.width.toFixed(1), h: +tb.height.toFixed(1) },
        deepest: { bottom: +deepest.bottom.toFixed(1), label: deepest.label.slice(0, 46) },
        overflows: out,
      };
    }, SAFE_BOTTOM);
    await page.close();
    const name = f.replace(/^.*kozy-brand\//, '');
    if (r.error) { console.log(`✗ ${name}: ${r.error}`); continue; }
    const status = (r.overflows.length === 0 && r.deepest.bottom <= -SAFE_BOTTOM)
      ? 'PASS' : 'FAIL';
    console.log(`${status === 'PASS' ? '✓' : '✗'} ${name}  [trim ${r.trim.w}x${r.trim.h}]`);
    console.log(`    deepest content: ${r.deepest.bottom > 0 ? '+' : ''}${r.deepest.bottom}px past trim bottom  ("${r.deepest.label}")`);
    r.overflows.forEach(x => console.log(`    OVERFLOW ${x.tag} "${x.label}"  L+${x.l} R+${x.r} T+${x.t} B+${x.b}`));
    results.push({ name, status, deepest: r.deepest.bottom, count: r.overflows.length });
  }
  await browser.close();
  const fail = results.filter(x => x.status === 'FAIL');
  console.log(`\n== ${results.length - fail.length}/${results.length} pass ==`);
  if (fail.length) { fail.forEach(x => console.log(`   FAIL ${x.name} (${x.count} overflow, deepest ${x.deepest}px)`)); process.exitCode = 1; }
})();
