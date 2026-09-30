// =============================================================================
// Task 79 verification — the payment trap closed + brand navy.
// Runs against localhost:3000 (server started by t79_run_verify.sh with
// MEMBER_EMAIL_TEST_MODE=1 + EMAIL_CAPTURE_DIR=work/t79-emails).
//   [1] RENEW API — the untrap: a PENDING_ACTIVATION member can now pay
//       their first month (transfer claim / card path); months>1 → 400;
//       the ladder for live members unchanged (85,000 / 166,500)
//   [2] The office alert reads FIRST-MONTH language (activate, not extend)
//   [3] WEBHOOK — a signed charge.success on the pending member's stored
//       reference ACTIVATES the membership (+30d); replay ignored
//   [4] THE SWEEP + captured HTML — the two-button summary and the paused
//       email carry the NAVY prepay button (brand), gold primary, savings
//       note in gold; NO green anywhere (#2E9E5B / #1F7A43)
//   [5] PORTAL — the pending member sees "Complete your first payment"
//       (Awaiting payment badge, one month, transfer works); the club
//       member too; the live member's ladder pills are NAVY, no emerald
//   [6] JOINDIALOG honesty — without a Paystack key the card option is
//       disabled ("coming soon"), transfer is the default
//   [7] robots intact
// =============================================================================
const { chromium } = require('playwright')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const BASE = 'http://localhost:3000'
const CRON_SECRET = 'kozy-dev-cron-secret-052'
const WEBHOOK_SECRET = 'kozy-dev-webhook-secret-052'
const CAPTURE = path.join(__dirname, '..', 'work', 't79-emails')
let pass = 0
let fail = 0

function ok(name, cond, extra = '') {
  if (cond) {
    pass++
    console.log(`  PASS ${name}${extra ? ' — ' + extra : ''}`)
  } else {
    fail++
    console.log(`  FAIL ${name}${extra ? ' — ' + extra : ''}`)
  }
}

function st(r) {
  return typeof r.status === 'function' ? r.status() : r.status
}

async function login(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL(/portal|admin/, { timeout: 20000 })
  await page.waitForTimeout(1200)
}

function capturedFor(email) {
  const slug = email.toLowerCase().replace(/[^a-z0-9]+/gi, '-')
  try {
    const files = fs.readdirSync(CAPTURE).filter((f) => f.endsWith('.html') && f.includes(slug))
    if (files.length === 0) return null
    files.sort()
    return fs.readFileSync(path.join(CAPTURE, files[files.length - 1]), 'utf8')
  } catch {
    return null
  }
}

function capturedAll() {
  try {
    const files = fs.readdirSync(CAPTURE).filter((f) => f.endsWith('.html'))
    return files.map((f) => ({ f, html: fs.readFileSync(path.join(CAPTURE, f), 'utf8') }))
  } catch {
    return []
  }
}

const DAY = 24 * 60 * 60 * 1000

function sign(payload) {
  const body = JSON.stringify(payload)
  const hmac = crypto.createHmac('sha512', WEBHOOK_SECRET).update(body).digest('hex')
  return { body, hmac }
}

;(async () => {
  const browser = await chromium.launch()

  // ================================================================
  // [1] RENEW API — the untrap
  // ================================================================
  console.log('[1] Renew API — the pending member can now pay')
  {
    let res = await fetch(`${BASE}/api/subscriptions/renew`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscriptionId: 'x', months: 1, method: 'BANK_TRANSFER' }),
    })
    ok('renew unauthenticated 401', st(res) === 401, `status ${st(res)}`)

    const pendingPage = await browser.newPage()
    await login(pendingPage, 't79pending@woosh.dpdns.org', 'T79Pending!2026')
    let me = await pendingPage.request.get(`${BASE}/api/subscriptions/me`)
    let meData = await me.json().catch(() => ({}))
    const pendingSub = meData.membership
    ok('pending member sees their pending membership', pendingSub?.status === 'PENDING_ACTIVATION')

    // months>1 while pending → a clear no
    res = await pendingPage.request.post(`${BASE}/api/subscriptions/renew`, {
      data: { subscriptionId: pendingSub.id, months: 3, method: 'BANK_TRANSFER' },
    })
    let data = await res.json().catch(() => ({}))
    ok('pending months=3 rejected 400', st(res) === 400 && data.error === 'FIRST_MONTH_IS_ONE', `${st(res)} ${data.error}`)

    // the card path (no key configured) → honest 503
    res = await pendingPage.request.post(`${BASE}/api/subscriptions/renew`, {
      data: { subscriptionId: pendingSub.id, months: 1, method: 'PAYSTACK' },
    })
    data = await res.json().catch(() => ({}))
    ok('pending card without key → 503 PAYSTACK_NOT_CONFIGURED', st(res) === 503 && data.error === 'PAYSTACK_NOT_CONFIGURED', `${st(res)}`)

    // THE transfer completion — bank details + reference + claim
    res = await pendingPage.request.post(`${BASE}/api/subscriptions/renew`, {
      data: { subscriptionId: pendingSub.id, months: 1, method: 'BANK_TRANSFER' },
    })
    data = await res.json().catch(() => ({}))
    ok(
      'pending transfer completion 200 with instructions',
      st(res) === 200 && data.transfer?.amount === 30000 && data.transfer?.months === 1 && String(data.transfer?.reference || '').startsWith('KZY-RENEW-'),
      `${st(res)} amount=${data.transfer?.amount}`
    )
    ok(
      'transfer note speaks of activation (not renewal)',
      String(data.transfer?.note || '').includes('activates the moment the office confirms')
    )

    // The ladder for live members — unchanged (regression)
    const activePage = await browser.newPage()
    await login(activePage, 't79active@woosh.dpdns.org', 'T79Active!2026')
    me = await activePage.request.get(`${BASE}/api/subscriptions/me`)
    meData = await me.json().catch(() => ({}))
    const activeSub = meData.membership
    res = await activePage.request.post(`${BASE}/api/subscriptions/renew`, {
      data: { subscriptionId: activeSub.id, months: 3, method: 'BANK_TRANSFER' },
    })
    data = await res.json().catch(() => ({}))
    ok('live member 3-month ladder intact (₦85,000)', st(res) === 200 && data.transfer?.amount === 85000, `${st(res)} ${data.transfer?.amount}`)
    res = await activePage.request.post(`${BASE}/api/subscriptions/renew`, {
      data: { subscriptionId: activeSub.id, months: 6, method: 'BANK_TRANSFER' },
    })
    data = await res.json().catch(() => ({}))
    ok('live member 6-month ladder intact (₦166,500)', st(res) === 200 && data.transfer?.amount === 166500, `${st(res)} ${data.transfer?.amount}`)

    // The ledger claim: isInitial + FIRST-month note (via the admin drill-down)
    const adminPage = await browser.newPage()
    await login(adminPage, 't79admin@woosh.dpdns.org', 'T79Admin!2026')
    res = await adminPage.request.get(`${BASE}/api/subscriptions`)
    const list = await res.json().catch(() => ({ items: [] }))
    const row = (list.items || []).find((r) => r.id === pendingSub.id)
    ok('admin roster lists the pending member', Boolean(row))
    res = await adminPage.request.get(`${BASE}/api/subscriptions/${pendingSub.id}`)
    const detail = await res.json().catch(() => ({}))
    const events = detail?.activity?.events ?? detail?.events ?? []
    const claim = Array.isArray(events) ? events.find((e) => e.kind === 'RENEWAL_INTENT') : null
    ok('RENEWAL_INTENT claim recorded for the first payment', Boolean(claim))
    if (claim) {
      const meta = JSON.parse(claim.meta || '{}')
      ok('claim meta isInitial=true', meta.isInitial === true)
      ok('claim note names the FIRST month', String(claim.note || '').includes('FIRST month'))
    }

    // ================================================================
    // [2] The office alert reads FIRST-MONTH language
    // ================================================================
    console.log('[2] Office alert for the first-payment claim')
    {
      const all = capturedAll()
      const alert = all.find(
        (x) => x.f.includes('transfer') || (x.html.includes('first month') && x.html.includes('KZY-RENEW'))
      )
      ok('office alert captured', Boolean(alert), alert ? alert.f : 'no capture')
      if (alert) {
        ok('alert says "first month" (activate language)', alert.html.includes('first month'))
        ok('alert headline is the activation one', /activate/i.test(alert.html))
        ok('alert has no green hex', !alert.html.includes('#2E9E5B') && !alert.html.includes('#1F7A43'))
      }
    }

    // ================================================================
    // [3] WEBHOOK — the card path completes the pending membership
    // ================================================================
    console.log('[3] Webhook activates the pending member on charge.success')
    {
      const ref = pendingSub.paystackRef || `SUB-${pendingSub.id}`
      const payload = {
        event: 'charge.success',
        data: {
          reference: ref,
          amount: 3000000,
          currency: 'NGN',
          status: 'success',
          metadata: { subscriptionId: pendingSub.id, kind: 'membership', months: 1 },
        },
      }
      const { body, hmac } = sign(payload)
      let wh = await fetch(`${BASE}/api/webhooks/paystack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-paystack-signature': hmac },
        body,
      })
      ok('webhook accepted', st(wh) === 200, `status ${st(wh)}`)

      res = await adminPage.request.get(`${BASE}/api/subscriptions`)
      const list2 = await res.json().catch(() => ({ items: [] }))
      const row2 = (list2.items || []).find((r) => r.id === pendingSub.id)
      const endMs = row2?.periodEnd ? new Date(row2.periodEnd).getTime() : 0
      const days = (endMs - Date.now()) / DAY
      ok(
        'pending member now ACTIVE with +30d',
        row2?.status === 'ACTIVE' && row2?.pricePaid === 30000 && days > 28 && days < 32,
        `status=${row2?.status} pricePaid=${row2?.pricePaid} days=${days.toFixed(1)}`
      )

      // Replay — ignored
      const { body: body2, hmac: hmac2 } = sign(payload)
      wh = await fetch(`${BASE}/api/webhooks/paystack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-paystack-signature': hmac2 },
        body: body2,
      })
      res = await adminPage.request.get(`${BASE}/api/subscriptions`)
      const list3 = await res.json().catch(() => ({ items: [] }))
      const row3 = (list3.items || []).find((r) => r.id === pendingSub.id)
      const days3 = (new Date(row3.periodEnd).getTime() - Date.now()) / DAY
      ok('replay ignored (no double extension)', Math.abs(days3 - days) < 1, `days=${days3.toFixed(1)}`)

      await pendingPage.close()
      await activePage.close()
    }
  }

  // ================================================================
  // [4] THE SWEEP — captured HTML carries navy, not green
  // ================================================================
  console.log('[4] Sweep + captured emails — navy brand')
  {
    let res = await fetch(`${BASE}/api/cron/member-emails`, {
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    })
    const sweep = await res.json().catch(() => ({}))
    const sr = sweep.result && typeof sweep.result.sent === 'number' ? sweep.result : sweep
    ok('sweep ran', st(res) === 200, `status ${st(res)} sent=${sr.sent} paused=${sr.pausedCandidates}`)
    if (sr.details && sr.pausedCandidates > 0) {
      const pd = sr.details.filter((d) => d.job === 'paused')
      console.log('      paused details:', JSON.stringify(pd.map((d) => ({ who: d.member.email, outcome: d.outcome, reason: d.reason.slice(0, 60) }))))
    }

    const activeHtml = capturedFor('t79active@woosh.dpdns.org')
    ok('active member summary captured', Boolean(activeHtml))
    if (activeHtml) {
      ok(
        'gold primary button stands',
        activeHtml.includes('linear-gradient(135deg, #E3BE4F, #D4AF37, #B8962B)') && activeHtml.includes('Pay next month — ₦30,000')
      )
      ok(
        'NAVY prepay button (brand)',
        activeHtml.includes('linear-gradient(135deg, #0A192F, #1B3A5F)') && activeHtml.includes('Pay 3 months — ₦85,000')
      )
      ok('savings note inside the navy button (gold text)', activeHtml.includes('#E3BE4F') && activeHtml.includes('you save ₦5,000'))
      ok('NO green button hex', !activeHtml.includes('#2E9E5B'))
      ok('NO green link hex', !activeHtml.includes('#1F7A43'))
      ok('no green shadow rgba', !activeHtml.includes('rgba(37,122,67'))
    }

    // NOTE: the capture filename is truncated at 90 chars — the paused
    // email's long subject pushes the recipient out of the name, so it is
    // located by CONTENT instead.
    const pausedHtml = capturedFor('t79past@woosh.dpdns.org')
      ? capturedFor('t79past@woosh.dpdns.org')
      : (capturedAll().find((x) => x.html.includes('has paused') && x.html.includes('Reactivate for 3 months')) || {}).html || null
    ok('paused member email captured', Boolean(pausedHtml))
    if (pausedHtml) {
      ok(
        'paused email: gold reactivate + navy 3-month',
        pausedHtml.includes('linear-gradient(135deg, #E3BE4F, #D4AF37, #B8962B)') &&
          pausedHtml.includes('linear-gradient(135deg, #0A192F, #1B3A5F)') &&
          pausedHtml.includes('Reactivate for 3 months — ₦85,000')
      )
      ok('paused email: no green', !pausedHtml.includes('#2E9E5B') && !pausedHtml.includes('#1F7A43'))
    }

    // Idempotent second sweep
    res = await fetch(`${BASE}/api/cron/member-emails`, {
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    })
    const sweep2raw = await res.json().catch(() => ({}))
    const sweep2 = sweep2raw.result && typeof sweep2raw.result.sent === 'number' ? sweep2raw.result : sweep2raw
    ok('second sweep sends nothing', (sweep2.sent ?? 0) === 0, `sent=${sweep2.sent}`)
  }

  // ================================================================
  // [5] PORTAL — the completion card + navy ladder
  // ================================================================
  console.log('[5] Portal — completion card + navy pills')
  {
    // The (now ACTIVE) previously-pending member is mid-cycle — the club
    // member carries the pending-state assertions instead.
    const clubPage = await browser.newPage()
    await login(clubPage, 't79clubpend@woosh.dpdns.org', 'T79Clubpend!2026')
    await clubPage.goto(`${BASE}/portal?renew=1`, { waitUntil: 'domcontentloaded' })
    await clubPage.waitForTimeout(2500)
    let body = await clubPage.textContent('body').catch(() => '')
    ok('club pending member sees the completion card', body.includes('Complete your first payment'))
    ok('club completion speaks in pairs', body.includes('pairs of cleans a month unlock'))
    const transferBtn = clubPage.locator('button', { hasText: 'Pay by bank transfer' }).first()
    ok('transfer button present for pending member', (await transferBtn.count()) > 0)
    if ((await transferBtn.count()) > 0) {
      await transferBtn.click()
      await clubPage.waitForTimeout(1500)
      body = await clubPage.textContent('body').catch(() => '')
      ok('transfer instructions appear (reference)', body.includes('KZY-RENEW-'))
    }
    await clubPage.close()

    // The live member — the ladder pills are NAVY
    const livePage = await browser.newPage()
    await login(livePage, 't79active@woosh.dpdns.org', 'T79Active!2026')
    await livePage.goto(`${BASE}/portal?renew=1&months=3`, { waitUntil: 'domcontentloaded' })
    await livePage.waitForTimeout(2500)
    body = await livePage.textContent('body').catch(() => '')
    ok('live member renewal card renders', body.includes('Renew the The Essentials') || body.includes('Renew the'))
    const cardHtml = await livePage
      .locator('#kozy-renewal')
      .innerHTML()
      .catch(() => '')
    ok('ladder pills navy (from-navy-500)', cardHtml.includes('from-navy-500') || cardHtml.includes('to-navy-700'))
    ok('no emerald pills in the renewal card', !cardHtml.includes('emerald-400') && !cardHtml.includes('emerald-500') && !cardHtml.includes('emerald-700'))
    ok('save badge renders', body.includes('save ₦5,000'))
    ok('navy price subtext (gold-200)', cardHtml.includes('text-gold-200') || cardHtml.includes('bg-navy-50'))
    await livePage.close()
  }

  // ================================================================
  // [6] JOINDIALOG honesty — card disabled without a key
  // ================================================================
  console.log('[6] JoinDialog honesty gate')
  {
    const freshPage = await browser.newPage()
    await login(freshPage, 't79fresh@woosh.dpdns.org', 'T79Fresh!2026')
    await freshPage.goto(`${BASE}/memberships`, { waitUntil: 'domcontentloaded' })
    await freshPage.waitForTimeout(2000)
    const joinBtn = freshPage.locator('button', { hasText: 'Join The Essentials' }).first()
    if ((await joinBtn.count()) === 0) {
      // fallback: any Join button
      const any = freshPage.locator('button', { hasText: /^Join/ }).first()
      if ((await any.count()) > 0) await any.click()
    } else {
      await joinBtn.click()
    }
    await freshPage.waitForTimeout(1200)
    const body = await freshPage.textContent('body').catch(() => '')
    ok('join dialog opens', body.includes('Pay by card') && body.includes('Pay by bank transfer'))
    const cardBtn = freshPage.locator('button[disabled]', { hasText: 'Pay by card' }).first()
    ok('card option disabled without a key', (await cardBtn.count()) > 0)
    ok('card option says coming soon', body.includes('coming soon'))
    ok(
      'transfer is the effective default (receipt upload visible)',
      body.includes('Attach your transfer receipt')
    )
    await freshPage.close()
  }

  // ================================================================
  // [7] robots intact
  // ================================================================
  {
    const res = await fetch(`${BASE}/robots.txt`)
    const txt = await res.text()
    ok('robots intact', st(res) === 200 && txt.includes('Disallow: /admin'), `status ${st(res)}`)
  }

  await browser.close()
  console.log(`\n===== T79 BATTERY: ${pass} PASS / ${fail} FAIL =====`)
  process.exit(fail === 0 ? 0 : 1)
})().catch((e) => {
  console.error('BATTERY CRASHED:', e)
  process.exit(1)
})
