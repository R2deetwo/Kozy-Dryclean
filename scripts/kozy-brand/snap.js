#!/usr/bin/env node
/**
 * snap.js — screenshot an HTML file (whole page or a single element) to PNG.
 * Usage: node snap.js input.html output.png [--selector "#id"] [--w 1200] [--scale 2] [--transparent] [--fullpage]
 * If --selector given: element screenshot (tight bbox). Otherwise viewport screenshot.
 */
const path = require('path');
const fs = require('fs');

async function main() {
  const args = process.argv.slice(2);
  const input = args[0], output = args[1];
  if (!input || !output) { console.error('see usage'); process.exit(1); }
  const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
  const selector = flag('--selector');
  const width = parseInt(flag('--w') || '1200', 10);
  const height = parseInt(flag('--h') || '900', 10);
  const scale = parseFloat(flag('--scale') || '2');
  const transparent = args.includes('--transparent');
  const fullPage = args.includes('--fullpage');

  let chromium;
  try { ({ chromium } = require('playwright')); }
  catch { ({ chromium } = require('playwright-core')); }

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale });
  await page.goto('file://' + path.resolve(input));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);

  const opts = { omitBackground: transparent };
  if (selector) {
    const el = await page.$(selector);
    if (!el) { console.error('selector not found: ' + selector); process.exit(1); }
    await el.screenshot({ ...opts, path: output });
  } else {
    await page.screenshot({ ...opts, path: output, fullPage });
  }
  await browser.close();
  const dim = await new Promise(res => {
    // report file size only; dims via png header
    const buf = fs.readFileSync(output);
    const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
    res(`${w}x${h}`);
  });
  console.log(`✓ ${output} (${dim}, ${(fs.statSync(output).size / 1024).toFixed(0)} KB)`);
}
main().catch(e => { console.error(e); process.exit(1); });
