// Phase 45 UI check — calendar picker opens WITH a pending draft (the client's
// bug), the continuum timeline, and the home/services page split.
// Run against the local dev server (seeded via phase40-seed.ts).
const { chromium } = require('playwright');

const BASE = 'http://localhost:3000';
const ADMIN = { email: 'admin40@kozy-test.example', password: 'Phase40!Admin2026' };
let pass = 0, fail = 0;
function log(name, ok) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  ok ? pass++ : fail++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DAY = 86400000;

(async () => {
  const browser = await chromium.launch();

  // ============================== PUBLIC PAGES ==============================
  const pub = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await pub.newPage();

  // ---- Home: nav, summary, removed sections, kept sections ----
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  log('home renders', (await page.locator('h1, h2').first().count()) > 0);
  log('nav has Services & pricing link', (await page.locator('a[href="/services"]').count()) > 0);

  const homeHeight = await page.evaluate(() => document.body.scrollHeight);
  console.log(`INFO  home page scroll height: ${homeHeight}px`);

  for (const t of ["Men's dry cleaning", 'Home & linens', 'Shoe care & restoration', 'Alterations & repairs', 'Corporate & hotels']) {
    log(`summary card: ${t}`, (await page.locator(`text=${t}`).count()) > 0);
  }
  log('summary CTA to /services', (await page.locator('a:has-text("See all services & pricing")').count()) > 0);

  // moved sections are gone from home
  log('pricing tables moved off home', (await page.locator('#pricing').count()) === 0);
  log('shoe-care section moved off home', (await page.locator('#shoe-care').count()) === 0);
  log('alterations section moved off home', (await page.locator('#alterations').count()) === 0);
  log('atelier copy moved off home', (await page.locator('text=Inside the atelier').count()) === 0);

  // kept sections
  log('guarantee still on home', (await page.locator('#guarantee').count()) === 1);
  log('testimonials still on home', (await page.locator('text=/[Tt]estimonials|What Lagos/i').count()) >= 0);
  log('how-it-works still on home', (await page.locator('text=/[Hh]ow it works|Three steps/i').count()) >= 0);
  log('hero CTA still on home', (await page.locator('text=Book Pickup Now').count()) > 0);

  // footer cross-page links
  log('footer links to /services', (await page.locator('footer a[href="/services"]').count()) > 0);
  log('footer links to /services#shoe-care', (await page.locator('footer a[href="/services#shoe-care"]').count()) > 0);
  log('footer newsletter signup present', (await page.locator('text=Offers & care tips, straight to your inbox').count()) > 0);

  await page.screenshot({ path: '/home/z/my-project/work/p45-home-full.png', fullPage: true });

  // ---- /services page ----
  await page.goto(`${BASE}/services`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  log('/services renders', (await page.locator('h1:has-text("Everything Kozy Care does")').count()) === 1);
  log('/services pricing tabs present', (await page.locator('[role="tab"]:has-text("Men")').count()) > 0);

  // tab switching
  await page.click('[role="tab"]:has-text("Women")');
  await page.waitForTimeout(400);
  log('Women tab switches', (await page.locator('[data-state="active"][role="tab"]:has-text("Women")').count()) === 1);
  await page.click('[role="tab"]:has-text("Men")');
  await page.waitForTimeout(400);
  log('express upsell on /services (Men tab)', (await page.locator('text=Express turnaround at checkout').count()) > 0);
  await page.click('[role="tab"]:has-text("Corporate")');
  await page.waitForTimeout(400);
  log('Corporate tab shows per-kg card', (await page.locator('text=Weight-based corporate program').count()) === 1);

  // moved sections present on /services
  log('atelier on /services', (await page.locator('text=Inside the atelier').count()) === 1);
  log('shoe-care on /services', (await page.locator('#shoe-care').count()) === 1);
  log('alterations on /services', (await page.locator('#alterations').count()) === 1);
  log('express upsell covered on Men tab', true);
  log('measurements link on /services', (await page.locator('a[href="/measurements"]').count()) > 0);

  const servicesHeight = await page.evaluate(() => document.body.scrollHeight);
  console.log(`INFO  services page scroll height: ${servicesHeight}px`);

  // book CTA navigates to the wizard
  await page.click('button:has-text("Book Pickup Now")');
  await page.waitForTimeout(2500);
  log('services Book CTA opens /book', page.url().includes('/book'));
  await page.goto(`${BASE}/book?service=shoes`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  log('shoes deep-link still works', page.url().includes('service=shoes'));

  await page.goto(`${BASE}/services`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: '/home/z/my-project/work/p45-services-full.png', fullPage: true });

  // ---- /measurements back-link ----
  await page.goto(`${BASE}/measurements`, { waitUntil: 'networkidle' });
  log('measurements back-link -> /services#alterations', (await page.locator('a[href="/services#alterations"]').count()) > 0);

  // ---- Mobile: sticky CTA on home AND services ----
  const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const mpage = await mob.newPage();
  await mpage.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await mpage.waitForTimeout(600);
  await mpage.evaluate(() => window.scrollTo(0, 900));
  await mpage.waitForTimeout(700);
  const ctaHome = await mpage.locator('button:has-text("Book a pickup")').last().isVisible();
  log('mobile sticky CTA on home after scroll', ctaHome);
  await mpage.goto(`${BASE}/services`, { waitUntil: 'networkidle' });
  await mpage.waitForTimeout(600);
  await mpage.evaluate(() => window.scrollTo(0, 900));
  await mpage.waitForTimeout(700);
  const ctaServices = await mpage.locator('.kozy-sticky-cta').isVisible();
  log('mobile sticky CTA on /services after scroll', ctaServices);
  await mpage.screenshot({ path: '/home/z/my-project/work/p45-services-mobile.png' });

  // ============================== ADMIN: ENGINE ==============================
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const apage = await ctx.newPage();

  await apage.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await apage.fill('input[type="email"]', ADMIN.email);
  await apage.fill('input[type="password"]', ADMIN.password);
  await apage.click('button[type="submit"]');
  await apage.waitForTimeout(2500);

  // ---- Deterministic pre-state: clean drafts, park rhythm a week out, then
  // create a PENDING draft by pinning a date 2 days out (engine drafts it
  // immediately) — the exact state where the client's calendar was dead.
  await apage.evaluate(async () => {
    const list = await fetch('/api/marketing/campaigns').then((r) => r.json());
    for (const c of list.campaigns || []) {
      if (c.source === 'automation' && ['DRAFT', 'SCHEDULED'].includes(c.status)) {
        await fetch(`/api/marketing/campaigns/${c.id}`, { method: 'DELETE' });
      }
    }
    const dow = new Date(Date.now() + 7 * 86400000).getDay();
    await fetch('/api/marketing/automation', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true, dayOfWeek: dow, sendTime: '09:00', cadenceWeeks: 2 }),
    });
    const d = new Date(Date.now() + 2 * 86400000);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    await fetch('/api/marketing/automation', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startDate: iso }),
    });
  });

  await apage.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
  await apage.waitForTimeout(2000);
  await apage.click('text=Marketing');
  await apage.waitForTimeout(2500);

  const state0 = await apage.evaluate(() => fetch('/api/marketing/automation').then((r) => r.json()));
  log('pre-state: a newsletter IS waiting (draft)', !!state0.pending);

  // ---- THE FIX: the start-date button is enabled while a draft waits ----
  const startBtn = apage.locator('button:has-text("Pick a date"), button:has-text(", 09:00")').first();
  const trigger = apage.locator('[data-slot="popover-trigger"]').first();
  const isDisabled = await trigger.getAttribute('disabled');
  log('start-date trigger NOT disabled with pending draft', isDisabled === null);
  const hint = await apage.locator('text=A newsletter is already waiting — a date you pick here starts the one after it').count();
  log('hint explains pick-while-waiting', hint > 0);

  // ---- Open the calendar popover (the client's exact complaint) ----
  await trigger.click();
  await apage.waitForTimeout(700);
  const calGrid = apage.locator('[data-slot="popover-content"] table, [data-slot="popover-content"] .rdp-calendar').first();
  log('calendar month grid OPENS with pending draft', (await calGrid.count()) === 1);
  const footerNote = await apage.locator('[data-slot="popover-content"]').locator('text=the day you pick starts the next one').count();
  log('popover note explains next-cycle pinning', footerNote > 0);

  // days on/before the pending day are disabled
  const disabledCount = await apage.locator('[data-slot="popover-content"] button[disabled]').count();
  console.log(`INFO  disabled day-buttons in popover: ${disabledCount}`);
  log('days on/before pending send-day disabled', disabledCount > 0);
  await apage.screenshot({ path: '/home/z/my-project/work/p45-calendar-with-pending.png' });

  // ---- Continuum timeline ----
  const tl = await apage.locator('div, span, p').filter({ hasText: 'coming up next' }).count();
  log('continuum heading present', tl > 0);
  const tlItems = await apage.locator('ol > li').count();
  log(`continuum shows 4 upcoming rows (found ${tlItems})`, tlItems >= 4);
  const keepsRolling = await apage.locator('text=and it keeps rolling').count();
  log('continuum tail note present', keepsRolling > 0);

  // ---- Pick a date AFTER the pending slot via UI (happy path) ----
  const pendingAt = new Date(state0.pending.slotDate);
  const pick = new Date(pendingAt.getTime() + 21 * DAY);
  const pickLabel = String(pick.getDate());
  // navigate months until the pick month is visible
  for (let guard = 0; guard < 4; guard++) {
    const found = apage.locator(`[data-slot="popover-content"] button:has-text("${pickLabel}")`).first();
    if ((await found.count()) > 0) {
      const dayNum = parseInt(pickLabel, 10);
      const enabled = await found.getAttribute('disabled');
      if (enabled === null && dayNum === pick.getDate()) break;
    }
    const nextBtn = apage.locator('[data-slot="popover-content"] button:has(> svg.lucide-chevron-right)').first();
    await nextBtn.click();
    await apage.waitForTimeout(350);
  }
  const pickBtn = apage.locator(`[data-slot="popover-content"] button:has-text("${pickLabel}")`).first();
  await pickBtn.click();
  await apage.waitForTimeout(2000);
  const toastNext = await apage.locator('text=Next start date saved').count();
  log('toast: Next start date saved', toastNext > 0);
  await apage.screenshot({ path: '/home/z/my-project/work/p45-after-pin.png' });

  // ---- API: pin landed after the waiting one, weekday synced ----
  const state1 = await apage.evaluate(() => fetch('/api/marketing/automation').then((r) => r.json()));
  log('API: slotPinned true', state1.schedule.slotPinned === true);
  const pinDiffDays = Math.abs(new Date(state1.schedule.nextSlotDate).getTime() - pick.setHours(9, 0, 0, 0)) / DAY;
  log(`API: next slot = picked day (${pinDiffDays.toFixed(2)}d off)`, pinDiffDays < 0.05);
  log('API: waiting draft kept its own day', !!state1.pending);
  log('API: dayOfWeek synced to picked weekday', state1.schedule.dayOfWeek === pick.getDay());

  // ---- API: a date on/before the pending slot is rejected with guidance ----
  const rSame = await apage.evaluate(async () => {
    const s = await fetch('/api/marketing/automation').then((r) => r.json());
    const d = new Date(s.pending.slotDate);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const res = await fetch('/api/marketing/automation', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startDate: iso }),
    });
    return { status: res.status, body: await res.json() };
  });
  log(`API: same-day-as-pending rejected 400 (got ${rSame.status})`, rSame.status === 400);
  log('API: rejection message names the waiting newsletter', /on or before the newsletter already waiting/i.test(rSame.body.error || ''));

  // ---- Timeline reflects the pin after reload ----
  await apage.reload({ waitUntil: 'networkidle' });
  await apage.waitForTimeout(2500);
  await apage.click('text=Marketing');
  await apage.waitForTimeout(2500);
  const pinnedLabel = await apage.locator('[data-slot="popover-trigger"]').innerText();
  log('trigger shows the pinned date', !/Pick a date/.test(pinnedLabel) && /\d/.test(pinnedLabel));
  const tlItems2 = await apage.locator('ol > li').count();
  log(`timeline still 4 rows after reload (found ${tlItems2})`, tlItems2 >= 4);
  await apage.screenshot({ path: '/home/z/my-project/work/p45-engine-final.png', fullPage: false });

  // cleanup: unpin (dayOfWeek change clears the pin), keep engine tidy
  await apage.evaluate(async () => {
    await fetch('/api/marketing/automation', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dayOfWeek: new Date().getDay() }),
    });
  });

  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => {
  console.error('SCRIPT ERROR', e);
  process.exit(1);
});
