// Follow-ups: identify the 3 opacity:0 stragglers + capture /book skeleton under throttled network
const { chromium, devices } = require('playwright');

(async () => {
  const browser = await chromium.launch();

  // ---- A: identify stuck elements after full slow scroll ----
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto('http://localhost:3100/', { waitUntil: 'load' });
  await p.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 300) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 200)); }
    await new Promise(r => setTimeout(r, 600));
  });
  const stuck = await p.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('div,section,img')) {
      const cs = getComputedStyle(el);
      if (cs.opacity === '0') {
        const r = el.getBoundingClientRect();
        const parentHidden = el.closest('[hidden],[aria-hidden="true"]') || el.closest('[data-state="inactive"]');
        out.push({
          tag: el.tagName, cls: (el.className || '').toString().slice(0, 60),
          inHiddenPane: !!parentHidden,
          text: (el.textContent || '').trim().slice(0, 40),
          w: Math.round(r.width), h: Math.round(r.height), y: Math.round(r.top + window.scrollY),
        });
      }
    }
    return out.slice(0, 12);
  });
  console.log('STUCK ELEMENTS:', JSON.stringify(stuck, null, 1));
  await ctx.close();

  // ---- B: /book skeleton under 3G-like throttling, navigating from / ----
  const ctx2 = await browser.newContext({ ...devices['iPhone 14'] });
  const p2 = await ctx2.newPage();
  const client = await ctx2.newCDPSession(p2);
  await client.send('Network.enable');
  await client.send('Network.emulateNetworkConditions', {
    offline: false, latency: 300, downloadThroughput: (1.2 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8,
  });
  await p2.goto('http://localhost:3100/', { waitUntil: 'load' });
  // click "Book Pickup Now" (client-side route transition to /book)
  await p2.click('text=Book Pickup Now');
  await p2.waitForTimeout(400);
  const skeletonDuringNav = await p2.evaluate(() => !!document.querySelector('.kozy-skeleton'));
  await p2.screenshot({ path: '/home/z/my-project/work/p42/book-skeleton-throttled.png' });
  console.log('B skeleton visible during throttled nav:', skeletonDuringNav);
  await p2.waitForTimeout(6000);
  const wizardThere = await p2.evaluate(() => !document.querySelector('.kozy-skeleton') && !!document.querySelector('[role="tab"], .max-w-4xl, main, [class*="wizard"], [data-radix-tab]') );
  const bodyText = await p2.evaluate(() => document.body.innerText.slice(0, 120).replace(/\n/g, ' '));
  console.log('B wizard replaced skeleton:', wizardThere, '| text:', bodyText.slice(0, 90));
  await p2.screenshot({ path: '/home/z/my-project/work/p42/book-wizard-throttled.png' });
  await ctx2.close();

  await browser.close();
  console.log('DONE');
})();
