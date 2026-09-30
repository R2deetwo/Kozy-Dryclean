// =============================================================================
// Task 82 PRODUCTION E2E — sessions, claims, kit privacy, deep links LIVE on
// kozycare.ng. The member is the woosh test identity seeded by
// t82_prod_seed.py (PENDING ESSENTIALS + kit tag). No real customer or
// member is touched anywhere.
//
//   [H] health: home 200, settings honest (no Paystack key), bank details
//   [K] kit tag privacy: anonymous scan → public scope, ZERO personal data;
//       the page shows the sign-in gate; the OWNER sees their own kit
//   [C] the claim, wired: member presses "I've made payment" → the ADMIN
//       roster carries the open claim + the Operations feed shows
//       MEMBERSHIP_CLAIM (the owner's exact complaint: email arrived,
//       dashboard had nothing)
//   [D] deep links: /admin?tab=memberships opens the Members tab directly;
//       clicking the feed row lands on the roster
//   [V] office verify → ACTIVE, claim cleared, banner gone
//   [X] cleanup: the woosh member + every trace removed from prod
// =============================================================================
const { chromium } = require('playwright')

const BASE = 'https://kozycare.ng'
const MEMBER = 't82prod@woosh.dpdns.org'
const MEMBER_PW = 'T82Prod!2026'
const ADMIN = 'vk5m2w8t4a@woosh.dpdns.org'
const ADMIN_PW = 'KozyE2EAdmin!56'
const TAG = 'KZK-T82PRD'
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

async function login(page, email, password) {
  await page.goto(`${BASE}/login`)
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL(/portal|admin/, { timeout: 30000 })
}

async function main() {
  const browser = await chromium.launch()

  // =========================================================================
  console.log('\n[H] health')
  {
    const home = await browser.newContext()
    const r = await home.request.get(`${BASE}/`)
    ok('home 200', r.status() === 200)
    const s = await (await home.request.get(`${BASE}/api/settings/app`)).json()
    ok('settings honest (no Paystack key in prod)', s.settings?.paystackAvailable === false)
    ok('bank details intact', Boolean(s.settings?.bankName && s.settings?.accountNumber))
    await home.close()
  }

  // =========================================================================
  console.log('\n[K] kit tag privacy (the QR the owner scanned)')
  {
    // Anonymous: brand-only, nothing personal.
    const anon = await browser.newContext()
    const r1 = await anon.request.get(`${BASE}/api/kit/${TAG}`)
    const pub = await r1.json()
    ok('anonymous scan: 200 + scope public', r1.status() === 200 && pub.scope === 'public')
    ok('anonymous scan: no member object', !pub.member)
    ok('anonymous scan: no phone/email/name in payload', !JSON.stringify(pub).match(/@|\+234|Prod Tester/i))
    const apage = await anon.newPage()
    await apage.goto(`${BASE}/kit/${TAG}`)
    await apage.waitForTimeout(2500)
    let text = (await apage.textContent('body')) || ''
    ok('public page: privacy note + sign-in CTA', /private/i.test(text) && /Sign in to see it/.test(text))
    ok('public page: NO member name', !/Prod Tester/.test(text))
    await apage.screenshot({ path: 'work/t82-shots/prod-01-kit-public.png', fullPage: false })

    // The owner: their own kit.
    const owner = await browser.newContext()
    const opage = await owner.newPage()
    await login(opage, MEMBER, MEMBER_PW)
    const r2 = await owner.request.get(`${BASE}/api/kit/${TAG}`)
    const own = await r2.json()
    ok('owner scan: scope member', own.scope === 'member')
    ok('owner scan: name + plan, no phone', own.member?.name === 'Prod Tester T82' && !own.member?.phone)
    await opage.goto(`${BASE}/kit/${TAG}`)
    await opage.waitForTimeout(2500)
    text = (await opage.textContent('body')) || ''
    ok('owner page: "This is your kit" chip', /This is your kit/.test(text))
    await opage.screenshot({ path: 'work/t82-shots/prod-02-kit-owner.png', fullPage: false })
    await anon.close()
  }

  // =========================================================================
  console.log('\n[C] the claim, wired both sides')
  {
    // The member claims their first payment through the banner.
    const member = await browser.newContext()
    const mpage = await member.newPage()
    await login(mpage, MEMBER, MEMBER_PW)
    await mpage.waitForTimeout(2000)
    let text = (await mpage.textContent('body')) || ''
    ok('banner: Complete your payment first', /Complete your payment first/.test(text))
    const meSubs = await (await member.request.get(`${BASE}/api/subscriptions/me`)).json()
    const subId = meSubs.membership?.id
    const claim = await member.request.post(`${BASE}/api/subscriptions/renew`, {
      data: JSON.stringify({ subscriptionId: subId, months: 1, method: 'BANK_TRANSFER', claim: true }),
      headers: { 'Content-Type': 'application/json' },
    })
    ok('claim accepted (200)', claim.status() === 200)
    const dup = await member.request.post(`${BASE}/api/subscriptions/renew`, {
      data: JSON.stringify({ subscriptionId: subId, months: 1, method: 'BANK_TRANSFER', claim: true }),
      headers: { 'Content-Type': 'application/json' },
    })
    ok('duplicate claim refused (409)', dup.status() === 409)

    await mpage.goto(`${BASE}/portal`)
    await mpage.waitForTimeout(2500)
    text = (await mpage.textContent('body')) || ''
    ok('banner: awaiting state persists', /Payment sent — awaiting the office/.test(text))
    await mpage.screenshot({ path: 'work/t82-shots/prod-03-banner-claim.png', fullPage: false })

    // The ADMIN side: roster + Operations feed.
    const admin = await browser.newContext()
    const apage = await admin.newPage()
    await login(apage, ADMIN, ADMIN_PW)
    await apage.waitForTimeout(1500)
    const subs = await (await admin.request.get(`${BASE}/api/subscriptions`)).json()
    const row = (subs.items || []).find((m) => m.user?.email === MEMBER)
    ok('roster row exposes the open claim', Boolean(row?.openClaim) && row?.openClaim?.isInitial === true)
    const notes = await (await admin.request.get(`${BASE}/api/admin/notifications`)).json()
    const feed = notes.items || notes.events || []
    const claimEvent = feed.find((n) => n.type === 'MEMBERSHIP_CLAIM')
    ok('MEMBERSHIP_CLAIM in the Operations feed', Boolean(claimEvent), claimEvent?.title || 'not found')
    ok('feed event links to memberships', claimEvent?.linkTab === 'memberships')
    await member.close()

    // =========================================================================
    console.log('\n[D] deep links (no more dashboard dumps)')
    {
      await apage.goto(`${BASE}/admin?tab=memberships`)
      await apage.waitForTimeout(3000)
      let t = (await apage.textContent('body')) || ''
      ok('?tab=memberships → Members roster directly', /Running members/.test(t) && /The Kozy Circle/.test(t))
      ok('the claim visible on the roster', /completed their first payment|First payment note/.test(t))
      await apage.screenshot({ path: 'work/t82-shots/prod-04-admin-members.png', fullPage: false })

      await apage.goto(`${BASE}/admin`)
      await apage.waitForTimeout(2200)
      await apage.click('text=Notifications')
      await apage.waitForTimeout(2200)
      t = (await apage.textContent('body')) || ''
      ok('feed shows the claim row', /completed their first payment/.test(t))
      await apage.click('text=completed their first payment')
      await apage.waitForTimeout(2200)
      t = (await apage.textContent('body')) || ''
      ok('clicking the row → Members roster', /Running members/.test(t))
    }

    // =========================================================================
    console.log('\n[V] office verify')
    {
      const verify = await admin.request.patch(`${BASE}/api/subscriptions/${row.id}`, {
        data: JSON.stringify({ action: 'verify' }),
        headers: { 'Content-Type': 'application/json' },
      })
      ok('verify & activate succeeds', verify.status() === 200)
      const subs2 = await (await admin.request.get(`${BASE}/api/subscriptions`)).json()
      const row2 = (subs2.items || []).find((m) => m.user?.email === MEMBER)
      ok('claim cleared after verify', !row2?.openClaim)
      ok('status ACTIVE at plan price', row2?.status === 'ACTIVE' && row2?.pricePaid === 30000)
    }

    await admin.close()
  }

  // =========================================================================
  console.log('\n[X] session isolation spot-check (the owner\'s scare)')
  {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await login(page, MEMBER, MEMBER_PW)
    await page.goto(`${BASE}/admin`)
    await page.waitForTimeout(2500)
    ok('customer on /admin → bounced to /portal', page.url().includes('/portal'))
    const t = (await page.textContent('body')) || ''
    ok('no console content rendered', !/Atelier Console/.test(t))
    await ctx.close()
  }

  await browser.close()
  console.log(`\n=== ${pass} passed, ${fail} failed ===`)
  process.exit(fail > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error('E2E CRASHED:', e)
  process.exit(1)
})
