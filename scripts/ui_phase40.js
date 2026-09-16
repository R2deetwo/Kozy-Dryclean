// Phase 40 UI check — the newsletter engine panel + banner picker + edit
// dialog + library browser, against the local dev server (seeded).
const { chromium } = require('playwright');

const BASE = 'http://localhost:3000';
let pass = 0, fail = 0;
function log(name, ok) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  ok ? pass++ : fail++;
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  // ---- Admin login ----
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'admin40@kozy-test.example');
  await page.fill('input[type="password"]', 'Phase40!Admin2026');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);

  // ---- Open Marketing tab ----
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.click('text=Marketing');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/home/z/my-project/work/p40-engine-off.png', fullPage: false });

  // ---- The engine panel renders with its manual + switch ----
  const panelText = await page.textContent('body');
  log('engine panel title', panelText.includes('Your newsletter engine'));
  log('4-step manual visible', panelText.includes('1. Turn it on') && panelText.includes('4. You press Approve'));
  log('unsubscribe note visible', panelText.includes('stays registered'));

  // ---- Turn it ON ----
  const engineSwitch = page.locator('[role="switch"]').first();
  await engineSwitch.click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: '/home/z/my-project/work/p40-engine-on.png' });
  const onText = await page.textContent('body');
  log('engine ON state', onText.includes('Next on the plan'));
  log('cadence default every 2 weeks', onText.includes('Every 2 weeks'));

  // ---- Prepare the first draft ----
  await page.click('button:has-text("Prepare it now")');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/home/z/my-project/work/p40-draft-waiting.png' });
  const draftText = await page.textContent('body');
  log('draft waiting for review', draftText.includes('Ready for your review'));
  log('approve + skip buttons', (await page.$('button:has-text("Approve")')) != null && (await page.$('button:has-text("Skip")')) != null);
  log('test me button', (await page.$('button:has-text("Test me")')) != null);

  // ---- Draft appears in the campaign list with Auto badge + Edit ----
  const autoBadge = await page.$('text=Auto');
  log('Auto badge on campaign card', autoBadge != null);
  const editBtn = await page.$('button:has-text("Edit")');
  log('Edit button on draft card', editBtn != null);

  // ---- Preview dialog of the pending draft ----
  await page.click('button:has-text("Preview")');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/home/z/my-project/work/p40-email-preview.png' });
  const previewIframe = await page.$('iframe[title="Newsletter preview"]');
  log('engine preview iframe', previewIframe != null);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);

  // ---- Edit the draft ----
  await page.click('button:has-text("Edit")');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/home/z/my-project/work/p40-edit-dialog.png' });
  const editText = await page.textContent('body');
  log('edit dialog opens', editText.includes('Change anything before it goes out'));
  // the banner picker inside the editor
  const bannerThumbs = await page.$$('button[title*="—"]');
  log('banner picker thumbnails in editor', bannerThumbs.length >= 10, `thumbs=${bannerThumbs.length}`);
  // tweak the subject then save
  await page.fill('input[maxlength="200"]', 'Edited: week one check');
  await page.click('button:has-text("Save changes")');
  await page.waitForTimeout(2500);
  const savedText = await page.textContent('body');
  log('edit saved (subject on card)', savedText.includes('Edited: week one check'));
  await page.screenshot({ path: '/home/z/my-project/work/p40-edited-card.png' });

  // ---- Approve flow with confirmation dialog ----
  await page.click('button:has-text("Approve")');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '/home/z/my-project/work/p40-approve-dialog.png' });
  const approveText = await page.textContent('body');
  log('approve dialog explains the day', approveText.includes('will be scheduled for'));
  log('approve test tip when untested', approveText.includes('Test me'));
  await page.click('button:has-text("Approve — schedule it")');
  await page.waitForTimeout(2500);
  const approvedText = await page.textContent('body');
  log('approved state shows scheduled', approvedText.includes('Approved — going out automatically'));
  await page.screenshot({ path: '/home/z/my-project/work/p40-approved.png' });

  // ---- Library browser ----
  await page.click('button:has-text("Browse the 52-week plan")');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: '/home/z/my-project/work/p40-library.png' });
  const libText = await page.textContent('body');
  log('library dialog opens with 52 weeks', libText.includes('The 52-week content plan'));
  log('seasons present (Detty December + Owambe)', libText.includes('Detty December') && libText.includes('Owambe'));
  const startBtns = await page.$$('button:has-text("Start here")');
  log('Start here buttons', startBtns.length > 40, `btns=${startBtns.length}`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);

  // ---- Composer: banner picker + hidden slug ----
  await page.click('button:has-text("New campaign")');
  await page.waitForTimeout(2000);
  const composerText = await page.textContent('form');
  log('composer has banner picker', composerText.includes('Picture at the top of the email'));
  const composerThumbs = await page.$$('button[title*="—"]');
  log('composer banner thumbnails', composerThumbs.length >= 10, `thumbs=${composerThumbs.length}`);
  await page.screenshot({ path: '/home/z/my-project/work/p40-composer.png' });

  // ---- Mobile viewport sanity ----
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.click('text=Marketing >> visible=true');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/home/z/my-project/work/p40-mobile.png' });
  const mobileText = await page.textContent('body');
  log('engine panel visible on mobile', mobileText.includes('Your newsletter engine'));
  log('no horizontal overflow on mobile', (await page.evaluate(() => document.documentElement.scrollWidth <= 390 + 4)));

  await browser.close();
  console.log(`\nUI RESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
