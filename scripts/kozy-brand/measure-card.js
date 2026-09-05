#!/usr/bin/env node
/** measure-card.js — report bounding boxes of key card elements vs the frame. */
const path = require('path');

async function main() {
  const [,, htmlPath] = process.argv;
  let chromium;
  try { ({ chromium } = require('playwright')); }
  catch { ({ chromium } = require('playwright-core')); }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 700, height: 500 } });
  await page.goto('file://' + path.resolve(htmlPath));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(200);
  const boxes = await page.evaluate(() => {
    const get = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height, bottom: r.bottom, right: r.right };
    };
    return {
      poster: get('.poster'),
      content: get('.content'),
      frame: get('.frame'),
      rows: get('.rows'),
      mid: get('.mid'),
      name: get('.name'),
      brandrow: get('.brandrow'),
      headrow: get('.headrow'),
      addr: get('.addr'),
      qrbox: get('.qrbox'),
      addrrule: get('.addrrule'),
      scan: get('.scan'),
    };
  });
  const poster = boxes.poster;
  for (const [k, b] of Object.entries(boxes)) {
    if (!b || !poster) continue;
    console.log(`${k.padEnd(10)} x=${b.x.toFixed(1)} y=${b.y.toFixed(1)} w=${b.w.toFixed(1)} h=${b.h.toFixed(1)} | fromPosterBottom=${(poster.bottom - b.bottom).toFixed(1)} fromPosterRight=${(poster.right - b.right).toFixed(1)}`);
  }
  if (boxes.frame && boxes.rows) {
    console.log(`rows.bottom vs frame.bottom: rows=${boxes.rows.bottom.toFixed(1)} frame=${boxes.frame.bottom.toFixed(1)} ${boxes.rows.bottom > boxes.frame.bottom ? 'VIOLATION' : 'ok'}`);
  }
  if (boxes.frame && boxes.addr) {
    console.log(`addr.bottom vs frame.bottom: addr=${boxes.addr.bottom.toFixed(1)} frame=${boxes.frame.bottom.toFixed(1)} ${boxes.addr.bottom > boxes.frame.bottom ? 'VIOLATION' : 'ok'}`);
  }
  if (boxes.frame && boxes.qrbox) {
    console.log(`qrbox.right vs frame.right: qr=${boxes.qrbox.right.toFixed(1)} frame=${boxes.frame.right.toFixed(1)} ${boxes.qrbox.right > boxes.frame.right ? 'VIOLATION' : 'ok'}`);
  }
  await browser.close();
}
main().catch(e => { console.error(e); process.exit(1); });
