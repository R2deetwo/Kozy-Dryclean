// Phase 52 — capture screenshots for VLM visual QA.
// Requires the p52_qa.js state to exist (Amaka, 10 delivered, code minted).
const { chromium } = require('playwright');
const crypto = require('crypto');

const BASE = 'http://localhost:3000';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function milestoneToken(userId) {
  const payload = Buffer.from(JSON.stringify({ u: userId })).toString('base64url');
  const sig = crypto.createHmac('sha256', 'kozy-dev-secret-local-052').update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

(async () => {
  const browser = await chromium.launch();
  const token = milestoneToken('amaka52id0000000000000000');

  // 1) Milestone page — desktop + mobile
  for (const [name, vp] of [['desktop', { width: 1280, height: 900 }], ['mobile', { width: 375, height: 812 }]]) {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    await p.goto(`${BASE}/milestone?token=${encodeURIComponent(token)}`, { waitUntil: 'domcontentloaded' });
    await sleep(2500);
    await p.screenshot({ path: `/home/z/my-project/work/p52-milestone-${name}.png`, fullPage: true });
    await ctx.close();
  }

  // 2) Portal with the quiet referral card — desktop + mobile
  for (const [name, vp] of [['desktop', { width: 1280, height: 900 }], ['mobile', { width: 375, height: 812 }]]) {
    const ctx = await browser.newContext({ viewport: vp });
    const p = await ctx.newPage();
    await p.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    await sleep(1500);
    await p.fill('#email', 'amaka52@kozy-test.example');
    await p.fill('#password', 'Phase52!Amaka2026');
    await p.click('button[type="submit"]');
    for (let i = 0; i < 40 && p.url().includes('/login'); i++) await sleep(500);
    await p.goto(`${BASE}/portal`, { waitUntil: 'domcontentloaded' });
    await sleep(2500);
    await p.screenshot({ path: `/home/z/my-project/work/p52-portal-${name}.png`, fullPage: false });
    await ctx.close();
  }

  await browser.close();
  console.log('captured: p52-milestone-{desktop,mobile}.png, p52-portal-{desktop,mobile}.png');
})().catch((e) => { console.error(e); process.exit(1); });
