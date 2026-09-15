// Phase 37 UI check — the new Campaigns composer (plain message + live
// preview) and the safe send dialog, against the local dev server.
const { chromium } = require('playwright');

const BASE = 'http://localhost:3000';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  // ---- Admin login ----
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'admin37@kozy-test.example');
  await page.fill('input[type="password"]', 'Phase37!Admin2026');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);

  // ---- Open Marketing tab ----
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.click('text=Marketing');
  await page.waitForTimeout(2500);

  // ---- Open the composer ----
  await page.click('text=New campaign');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: '/home/z/my-project/work/p37-composer.png' });

  // The message box must NOT be monospace HTML — check the helper text exists
  const helper = await page.textContent('form');
  const plainComposer = helper.includes('Type it like a normal message');
  const noHtmlLabel = !helper.includes('Email body (HTML)');
  console.log('plain composer copy:', plainComposer ? 'PASS' : 'FAIL');
  console.log('no raw HTML label:', noHtmlLabel ? 'PASS' : 'FAIL');

  // ---- Live preview tab ----
  await page.click('button[title="See exactly what the email looks like"]');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: '/home/z/my-project/work/p37-composer-preview.png' });
  const iframe = await page.$('iframe[title="Live email preview"]');
  console.log('live preview iframe:', iframe ? 'PASS' : 'FAIL');

  // Back to writing, type a custom message
  await page.click('text=Back to writing');
  await page.waitForTimeout(600);
  await page.fill('textarea[name="bodyText"]', 'Hello Kozy family,\n\nThis weekend: **15% off everything**.\n\n— Kozy Care');
  await page.click('button[title="See exactly what the email looks like"]');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: '/home/z/my-project/work/p37-composer-preview2.png' });
  const iframe2 = await page.$('iframe[title="Live email preview"]');
  const srcDoc = iframe2 ? await iframe2.getAttribute('srcdoc') : null;
  console.log('preview re-renders message:', srcDoc && srcDoc.includes('<strong>15% off everything</strong>') ? 'PASS' : 'FAIL');

  // ---- Save the campaign ----
  await page.click('text=Back to writing');
  await page.fill('input[name="name"]', 'UI check campaign');
  await page.fill('input[name="subject"]', 'A friendly note from Kozy');
  await page.click('button:has-text("Save campaign")');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: '/home/z/my-project/work/p37-campaign-card.png' });

  // Card shows Preview button + Tested chip (test was sent in the e2e run
  // for the API campaign, not this one — so expect NO chip here yet)
  const previewBtn = await page.$('button:has-text("Preview")');
  console.log('campaign card Preview button:', previewBtn ? 'PASS' : 'FAIL');

  // ---- Saved campaign preview dialog ----
  await previewBtn.click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: '/home/z/my-project/work/p37-preview-dialog.png' });
  const previewIframe = await page.$('iframe[title="Campaign email preview"]');
  console.log('saved preview dialog iframe:', previewIframe ? 'PASS' : 'FAIL');
  await page.click('[data-slot="dialog-close"]');
  await page.waitForTimeout(900);

  // ---- Safe send dialog: requires typing SEND ----
  await page.click('button:has-text("Send now")');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: '/home/z/my-project/work/p37-send-dialog.png' });
  const sendConfirmBtn = await page.$('button:has-text("Send to")');
  const disabledEarly = sendConfirmBtn ? await sendConfirmBtn.isDisabled() : true;
  console.log('send button locked before typing SEND:', disabledEarly ? 'PASS' : 'FAIL');

  // Type SEND → button unlocks
  await page.fill('#send-confirm', 'SEND');
  await page.waitForTimeout(500);
  const disabledAfter = await sendConfirmBtn.isDisabled();
  console.log('send button unlocks after typing SEND:', !disabledAfter ? 'PASS' : 'FAIL');
  await page.screenshot({ path: '/home/z/my-project/work/p37-send-dialog-typed.png' });

  // Click send → TEST_FIRST guard should fire (this campaign was never tested)
  await sendConfirmBtn.click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/home/z/my-project/work/p37-send-test-first.png' });
  const toastText = await page.textContent('body');
  console.log('TEST_FIRST toast shown:', toastText.includes('test it first') ? 'PASS' : 'FAIL');

  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
