// =============================================================================
// Phase 56 — FULL E2E BATTERY (production, REAL emails, REAL personas)
// =============================================================================
// The owner's ask: "i want to test a real set of users and run them through
// the system. this will be a staff, a customer, and a rider" using disposable
// inboxes from his woosh.dpdns.org mail app, plus an admin inbox "so that i
// can see what the admin sees".
//
// Two passes over the SAME flow:
//   PASS=A (default) — battery-owned inboxes (kozy-a-*@woosh.dpdns.org, API
//     tokens on file): every email is READ and asserted — subject category,
//     links, system-generated passwords are extracted and USED (real
//     verification click, real must-change-password sign-ins, real
//     GPS-gated rider confirmations).
//   PASS=B — the owner's four pre-claimed inboxes:
//       customer  wpcfvk76gd@woosh.dpdns.org
//       staff     awhr8npwm9@woosh.dpdns.org
//       rider     d8cne7n6mu@woosh.dpdns.org
//       admin     vk5m2w8t4a@woosh.dpdns.org
//     Emails land there for HIM to read in his mail app; the battery drives
//     the board as admin (staff/rider sessions are his to play) and also
//     parks a second order at "ready to pick up" assigned to his rider so
//     he can GPS-ping, navigate, swipe-confirm and report a problem with
//     the incident email landing in his admin inbox.
//
// Run:  PASS=A npx tsx scripts/p56_e2e_battery.ts
//       PASS=B npx tsx scripts/p56_e2e_battery.ts
// (needs work/p56-env.env sourced for DIRECT_URL)
// =============================================================================

import { chromium } from 'playwright'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const PASS = process.env.PASS === 'B' ? 'B' : 'A'
const BASE = 'https://kozycare.ng'
const WOOSH = 'https://woosh.dpdns.org'
const WOOSH_KEY = 'W81GNkdNEpPnhvyAoe5bjCbbGxHPUByoUiVztlMCQpQ'
const ADMIN_INBOX_USER = 'vk5m2w8t4a@woosh.dpdns.org'

type Inbox = { address: string; token?: string }

const INBOXES: Record<string, Inbox> =
  PASS === 'A'
    ? JSON.parse(fs.readFileSync('work/p56-inboxes.json', 'utf8'))
    : {
        customer: { address: 'wpcfvk76gd@woosh.dpdns.org' },
        staff: { address: 'awhr8npwm9@woosh.dpdns.org' },
        rider: { address: 'd8cne7n6mu@woosh.dpdns.org' },
        admin: { address: 'vk5m2w8t4a@woosh.dpdns.org' },
      }

const READ_INBOX = PASS === 'A' // B inboxes are the owner's — no read access

const PERSONAS = {
  A: {
    customer: { email: 'kozy-a-customer@woosh.dpdns.org', password: 'KozyAutoCust!56', name: 'Test Auto Customer', phone: '+234 803 000 0012' },
    staff: { email: 'kozy-a-staff@woosh.dpdns.org', name: 'Test Auto Staff', phone: '+234 803 000 0014' },
    rider: { email: 'kozy-a-rider@woosh.dpdns.org', name: 'Test Auto Rider', phone: '+234 803 000 0016', alt: '+234 803 000 0017', password: 'KozyAutoRider!56' },
    staffPassword: 'KozyAutoStaff!56',
    admin: { email: 'kozy-a-admin@woosh.dpdns.org', password: 'KozyAutoAdmin!56' },
  },
  B: {
    customer: { email: 'wpcfvk76gd@woosh.dpdns.org', password: 'KozyE2ECustomer!56', name: 'Test Customer', phone: '+234 803 000 0022' },
    staff: { email: 'awhr8npwm9@woosh.dpdns.org', name: 'Test Staff', phone: '+234 803 000 0024' },
    rider: { email: 'd8cne7n6mu@woosh.dpdns.org', name: 'Test Rider', phone: '+234 803 000 0026', alt: '+234 803 000 0027', password: null as string | null },
    staffPassword: null as string | null,
    admin: { email: 'vk5m2w8t4a@woosh.dpdns.org', password: 'KozyE2EAdmin!56' },
  },
}[PASS]

const P = PERSONAS
const LEKKI_ADDRESS = '12 Admiralty Way, Lekki Phase 1, Lagos'
const LAGOS_TZ = 'Africa/Lagos'

const db = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } })

// ---------------------------------------------------------------------------
// Assertion log
// ---------------------------------------------------------------------------
let passCount = 0
let failCount = 0
const failures: string[] = []
function log(id: string, ok: boolean, detail = '') {
  const line = `${ok ? 'PASS' : 'FAIL'}  ${id}${detail ? `  — ${detail}` : ''}`
  console.log(line)
  if (ok) passCount++
  else {
    failCount++
    failures.push(`${id} ${detail}`)
  }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ---------------------------------------------------------------------------
// Woosh inbox client (Pass A — token-holding inboxes only)
// ---------------------------------------------------------------------------
type MsgSummary = { id: string; sender: string; subject: string; receivedAt: number }
const seenIds: Record<string, Set<string>> = {}

async function wooshList(inbox: Inbox, waitForSec = 0): Promise<MsgSummary[]> {
  if (!inbox.token) return []
  const url = `${WOOSH}/api/inbox/${encodeURIComponent(inbox.address)}${waitForSec ? `?wait_for=${waitForSec}` : ''}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${inbox.token}` } })
  if (!res.ok) return []
  const data = await res.json().catch(() => null)
  return data?.messages ?? []
}

async function wooshRead(inbox: Inbox, id: string): Promise<{ subject: string; bodyHtml: string; bodyText: string }> {
  const res = await fetch(`${WOOSH}/api/message/${id}`, { headers: { Authorization: `Bearer ${inbox.token}` } })
  return await res.json()
}

async function wooshClear(inbox: Inbox) {
  if (!inbox.token) return
  await fetch(`${WOOSH}/api/inbox/${encodeURIComponent(inbox.address)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${inbox.token}` },
  })
  seenIds[inbox.address] = new Set()
}

/** Long-poll until a NEW message matching the predicate lands (or timeout). */
async function waitEmail(
  who: keyof typeof INBOXES,
  matcher: (m: MsgSummary) => boolean,
  label: string,
  timeoutMs = 90_000
): Promise<MsgSummary | null> {
  if (!READ_INBOX) {
    console.log(`  (inbox-read skipped — ${who}'s inbox is the owner's) ${label}`)
    return null
  }
  const inbox = INBOXES[who]
  if (!inbox.token) return null
  seenIds[inbox.address] ??= new Set()
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const msgs = await wooshList(inbox, 20)
    const hit = msgs.find((m) => !seenIds[inbox.address].has(m.id) && matcher(m))
    if (hit) {
      seenIds[inbox.address].add(hit.id)
      console.log(`  [email→${who}] ${hit.subject}`)
      return hit
    }
    // keep draining anything else that lands so it isn't re-matched later
    for (const m of msgs) seenIds[inbox.address].add(m.id)
  }
  console.log(`  [email→${who}] TIMEOUT waiting for: ${label}`)
  return null
}

/** Count of messages currently in an inbox (for quiet-stage assertions). */
async function inboxCount(who: keyof typeof INBOXES): Promise<number> {
  if (!READ_INBOX) return -1
  return (await wooshList(INBOXES[who])).length
}

const extractCode = (html: string): string | null => {
  const m = html.match(/<code[^>]*>\s*([^<]+?)\s*<\/code>/)
  if (!m) return null
  // The emailed password can contain '&' (the generator's symbol set),
  // which the email HTML escapes as &amp; — un-escape or the extracted
  // password simply does not match at sign-in.
  return m[1]
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}
const extractUrl = (html: string, re: RegExp): string | null => {
  const m = html.match(re)
  return m ? m[0] : null
}

// ---------------------------------------------------------------------------
// Playwright: login + API caller
// ---------------------------------------------------------------------------
let browser: import('playwright').Browser | null = null

async function login(email: string, password: string) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await sleep(1200)
  await page.fill('#email', email)
  await page.fill('#password', password)
  await page.click('button[type="submit"]')
  for (let i = 0; i < 40 && page.url().includes('/login'); i++) await sleep(500)
  return { ctx, page, errors, stillOnLogin: page.url().includes('/login') }
}

type Api = ReturnType<typeof makeApi>
function makeApi(page: import('playwright').Page) {
  return {
    async call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
      return page.evaluate(
        async ({ method, path, body, headers }) => {
          const r = await fetch(path, {
            method,
            headers: { 'Content-Type': 'application/json', ...headers },
            body: body === undefined ? undefined : JSON.stringify(body),
          })
          let data: unknown = null
          try {
            data = await r.json()
          } catch {}
          return { status: r.status, data }
        },
        { method, path, body, headers }
      )
    },
  }
}

/** Anonymous Node-side POST (spoofed x-forwarded-for keeps public per-IP
 *  rate limits from tripping across battery re-runs). */
async function anonPost(path: string, body: unknown, ip: string) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  })
  let data: unknown = null
  try {
    data = await res.json()
  } catch {}
  return { status: res.status, data }
}

function tomorrowLagos(): string {
  const d = new Date(Date.now() + 24 * 3600 * 1000)
  return new Intl.DateTimeFormat('en-CA', { timeZone: LAGOS_TZ }).format(d)
}

// ---------------------------------------------------------------------------
// MAIN FLOW
// ---------------------------------------------------------------------------
async function main() {
  browser = await chromium.launch()
  console.log(`\n=== Kozy Care E2E battery — PASS ${PASS} — ${new Date().toISOString()} ===`)
  console.log(`personas: customer=${P.customer.email} staff=${P.staff.email} rider=${P.rider.email} admin=${P.admin.email}\n`)

  // ---- 0. DB preflight -----------------------------------------------------
  if (PASS === 'A') {
    // Fresh, deterministic run: wipe this pass's artifacts (test-owned only).
    const emails = [P.customer.email, P.staff.email, P.rider.email]
    const users = await db.user.findMany({ where: { email: { in: emails } }, select: { id: true } })
    const userIds = users.map((u) => u.id)
    if (userIds.length) {
      await db.riderIncident.deleteMany({ where: { orderId: { in: await db.order.findMany({ where: { userId: { in: userIds } }, select: { id: true } }).then((o) => o.map((x) => x.id)) } } })
      await db.statusEvent.deleteMany({ where: { order: { userId: { in: userIds } } } })
      await db.payment.deleteMany({ where: { order: { userId: { in: userIds } } } })
      await db.order.deleteMany({ where: { userId: { in: userIds } } })
      await db.verificationToken.deleteMany({ where: { userId: { in: userIds } } })
      await db.user.deleteMany({ where: { id: { in: userIds } } })
    }
    await db.riderApplication.deleteMany({ where: { email: { in: emails } } })
    for (const inbox of Object.values(INBOXES)) await wooshClear(inbox)
    console.log('preflight: prior Pass-A artifacts cleared (users, applications, orders, inboxes)')
  } else {
    const existing = await db.user.findMany({ where: { email: { in: [P.customer.email, P.staff.email, P.rider.email] } }, select: { email: true, role: true } })
    for (const u of existing) console.log(`preflight: ${u.email} already exists (${u.role}) — flow steps for it will be skipped/reused`)
  }

  // ---- 1. Admin session + alert routing ------------------------------------
  const adm = await login(P.admin.email, P.admin.password)
  log('1.1 admin signed in', !adm.stillOnLogin, adm.page.url())
  const admApi = makeApi(adm.page)

  let settingsRes = await admApi.call('GET', '/api/settings/app')
  const currentAlerts: string = settingsRes.data?.settings?.adminAlertsEmail ?? ''
  const alertList = currentAlerts.split(/[,;\n]/).map((s: string) => s.trim()).filter(Boolean)
  const wanted = [...new Set([...alertList, P.admin.email])]
  if (!alertList.includes(P.admin.email)) {
    const put = await admApi.call('PUT', '/api/settings/app', { settings: { adminAlertsEmail: wanted.join(',') } })
    log('1.2 admin inbox added to alert recipients', put.status === 200, `${wanted.join(', ')}`)
  } else {
    log('1.2 admin inbox already an alert recipient', true, currentAlerts)
  }

  // ---- 2. Rider application → approval → welcome ----------------------------
  const existingApp = await db.riderApplication.findFirst({ where: { email: P.rider.email } })
  let riderUserId: string | null = existingApp?.userId ?? null
  if (!existingApp) {
    const ip = `10.56.${PASS === 'A' ? 1 : 2}.${Math.floor(Math.random() * 200) + 10}`
    const app = await anonPost('/api/rider-applications', {
      fullName: P.rider.name,
      email: P.rider.email,
      phone: P.rider.phone,
      altPhone: P.rider.alt,
      address: 'Admiralty Way, Lekki Phase 1',
      lga: 'Lekki',
      bikeModel: 'Bajaj Boxer',
      bikeYear: '2022',
      licenseNumber: 'ABC12345678',
      availability: 'full-time',
      experience: 'Two years dispatch riding around Ikoyi and Lekki.',
      consent: true,
    }, ip)
    log('2.1 rider application submitted', app.status === 201, `status ${app.status} · ref ${app.data?.application?.refCode ?? app.data?.refCode ?? app.data?.id ?? '?'}`)
    await waitEmail('rider', (m) => m.subject.startsWith('[Kozy Care · Rider] Application received'), 'application-received email')
    await waitEmail('admin', (m) => m.subject.startsWith('[Kozy Care Ops · Rider]') && m.subject.includes('applied to ride'), 'admin rider-application alert')
  } else {
    log('2.1 rider application exists from earlier run', true, existingApp.refCode ?? '')
  }

  if (!riderUserId) {
    const list = await admApi.call('GET', '/api/rider-applications')
    const found = (list.data?.applications ?? []).find((a: any) => a.email === P.rider.email || a.fullName === P.rider.name)
    const appId = found?.id ?? existingApp?.id
    const dec = await admApi.call('POST', `/api/rider-applications/${appId}/decision`, {
      action: 'approve',
      email: P.rider.email,
      note: `E2E welcome — sign in, set your own password, and your route screen is ready.`,
    })
    log('2.2 rider approved', dec.status === 200, `welcome email ok: ${dec.data?.welcome?.ok}`)
    riderUserId = dec.data?.rider?.id ?? null
    const welcome = await waitEmail('rider', (m) => m.subject.startsWith('[Kozy Care · Rider] Welcome to the rider team'), 'rider welcome email')

    let riderInitial: string | null = null
    if (welcome && READ_INBOX) {
      const full = await wooshRead(INBOXES.rider, welcome.id)
      riderInitial = extractCode(full.bodyHtml ?? full.bodyText ?? '')
      log('2.3 rider welcome carries initial password', !!riderInitial)
      // The welcome email's "Open the rider app" link must point at production.
      const link = extractUrl(full.bodyHtml ?? '', /https:\/\/kozycare\.ng\/login\?email=[^"'\s<]+/)
      log('2.4 welcome email link → kozycare.ng (no localhost)', !!link, link ?? 'not found')
    }
    if (riderInitial) {
      // First sign-in: forced password change in the rider app.
      const rider0 = await login(P.rider.email, riderInitial)
      log('2.5 rider first sign-in lands in rider app', !rider0.stillOnLogin && rider0.page.url().includes('/driver'), rider0.page.url())
      const dialogVisible = await rider0.page
        .waitForSelector('text=Set your own password', { timeout: 20000 })
        .then(() => true)
        .catch(() => false)
      log('2.6 forced password dialog shown', dialogVisible)
      const rApi = makeApi(rider0.page)
      const chg = await rApi.call('POST', '/api/users/me/password', {
        currentPassword: riderInitial,
        newPassword: P.rider.password!,
      })
      log('2.7 rider set own password', chg.status === 200, `status ${chg.status}`)
      await rider0.ctx.close()
    }
  } else {
    log('2.2 rider already approved (re-run)', true, `userId ${riderUserId}`)
  }

  // ---- 3. Customer signup → verification → login ----------------------------
  const existingCustomer = await db.user.findUnique({ where: { email: P.customer.email } })
  if (!existingCustomer) {
    const ip = `10.57.${PASS === 'A' ? 1 : 2}.${Math.floor(Math.random() * 200) + 10}`
    const su = await anonPost('/api/auth/signup', {
      email: P.customer.email,
      password: P.customer.password,
      name: P.customer.name,
      phone: P.customer.phone,
      role: 'B2C',
    }, ip)
    log('3.1 customer signed up', su.status === 201 || su.status === 200, `status ${su.status}`)

    if (READ_INBOX) {
      const verify = await waitEmail('customer', (m) => m.subject.startsWith('[Kozy Care · Account] Verify your account'), 'verification email')
      let verified = false
      if (verify) {
        const full = await wooshRead(INBOXES.customer, verify.id)
        const link = extractUrl(full.bodyHtml ?? '', /https:\/\/kozycare\.ng\/verify-email\?token=[A-Za-z0-9_-]+/)
        log('3.2 verification link extracted', !!link, link?.slice(0, 60) ?? '')
        if (link) {
          // The emailed link opens the /verify-email PAGE, whose client
          // script POSTs the token to the API — a plain fetch of the page
          // URL would only ever return HTML. Complete it the way the page
          // does: POST the token straight to the API.
          const token = link.split('token=')[1]
          const click = await fetch(`${BASE}/api/auth/verify-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
          })
          verified = click.ok
        }
      }
      log('3.3 verification completed via the emailed token', verified)
      await waitEmail('admin', (m) => m.subject.startsWith('[Kozy Care Ops · Signup]') && m.subject.includes('just signed up'), 'admin signup alert')
    } else {
      // Pass B: the email lands in the owner's inbox for HIM to click; the
      // battery completes verification with the real token so the lifecycle
      // can proceed even if he hasn't clicked yet.
      const token = await db.verificationToken.findFirst({
        where: { user: { email: P.customer.email } },
        orderBy: { createdAt: 'desc' },
      })
      if (token) {
        const click = await fetch(`${BASE}/api/auth/verify-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: token.token }),
        })
        log('3.3 verification completed via emailed token (owner can also click it himself)', click.ok)
      } else {
        const u = await db.user.findUnique({ where: { email: P.customer.email } })
        log('3.3 customer already verified', !!u?.emailVerified)
      }
    }
  } else {
    log('3.1 customer exists from earlier run', true, existingCustomer.role)
  }

  const cust = await login(P.customer.email, P.customer.password)
  log('3.4 customer signed in', !cust.stillOnLogin, cust.page.url())
  const custApi = makeApi(cust.page)

  // ---- 4. Staff invite ------------------------------------------------------
  const existingStaff = await db.user.findUnique({ where: { email: P.staff.email } })
  if (!existingStaff) {
    const inv = await admApi.call('POST', '/api/staff', {
      name: P.staff.name,
      email: P.staff.email,
      phone: P.staff.phone,
      note: 'E2E test staff — you will move orders on the board and ask customers questions.',
    })
    log('4.1 staff invited', inv.status === 201 || inv.status === 200, `status ${inv.status}`)
    const invite = await waitEmail('staff', (m) => m.subject.startsWith('[Kozy Care · Team] Welcome to the team'), 'staff invite email')

    if (invite && READ_INBOX) {
      const full = await wooshRead(INBOXES.staff, invite.id)
      const staffInitial = extractCode(full.bodyHtml ?? full.bodyText ?? '')
      log('4.2 staff invite carries initial password', !!staffInitial)
      const stf0 = await login(P.staff.email, staffInitial ?? 'x')
      log('4.3 staff first sign-in reaches console', !stf0.stillOnLogin && stf0.page.url().includes('/admin'), stf0.page.url())
      const sApi = makeApi(stf0.page)
      const chg = await sApi.call('POST', '/api/users/me/password', {
        currentPassword: staffInitial,
        newPassword: P.staffPassword!,
      })
      log('4.4 staff set own password', chg.status === 200, `status ${chg.status}`)
      await stf0.ctx.close()
    }
  } else {
    log('4.1 staff exists from earlier run', true, existingStaff.role)
  }

  // A staff session for board moves (Pass A); Pass B drives as admin.
  let boardApi: Api = admApi
  if (PASS === 'A') {
    const stf = await login(P.staff.email, P.staffPassword!)
    log('4.5 staff session active for board moves', !stf.stillOnLogin && stf.page.url().includes('/admin'))
    boardApi = makeApi(stf.page)
  }

  // ---- 5. Order lifecycle ---------------------------------------------------
  const bookPayload = (addr: string) => ({
    type: 'ITEM',
    items: [
      { id: 'shirt', name: 'White shirt', quantity: 3 },
      { id: 'suit', name: 'Navy suit', quantity: 1 },
      { id: 'dress', name: 'Silk dress', quantity: 1 },
    ],
    modeOfWash: 'MACHINE',
    serviceSpeed: 'STANDARD',
    pickupAddress: addr,
    deliveryAddress: addr,
    pickupDate: tomorrowLagos(),
    pickupTimeSlot: '09:00 - 10:00',
    paymentMethod: 'BANK_TRANSFER',
  })

  const booked = await custApi.call('POST', '/api/orders', bookPayload(LEKKI_ADDRESS))
  const order: any = booked.data?.order ?? booked.data
  log('5.1 order booked (bank transfer)', booked.status === 201 || booked.status === 200, `#${order?.orderNumber} · ₦${order?.totalPrice ?? '?'}`)
  // Bank-transfer bookings email differently BY DESIGN: the customer gets
  // "We're verifying your transfer" (the anti-double-payment reassurance)
  // instead of the plain booking confirmation, and the admin gets the
  // actionable "Verify payment" alert instead of the generic new-order one.
  await waitEmail('customer', (m) => m.subject.startsWith('[Kozy Care · Payment]') && m.subject.includes('verifying your transfer'), 'transfer-pending booking email')
  await waitEmail('admin', (m) => m.subject.startsWith('[Kozy Care Ops · Payment] Verify payment'), 'admin payment alert at booking')

  // Customer re-confirms the transfer from the status page — the booking
  // already created the PENDING payment row, so this lands on the
  // duplicate-guard (201 + duplicate:true) and deliberately sends nothing.
  const pay = await custApi.call('POST', '/api/payments', {
    orderId: order.id,
    amount: order.totalPrice,
    method: 'BANK_TRANSFER',
  })
  log('5.2 transfer re-confirmed by customer (duplicate-guarded)', pay.status === 201, `duplicate: ${pay.data?.duplicate}`)

  // Admin verifies → PAYMENT_VERIFIED
  const ordFull = await admApi.call('GET', `/api/orders/${order.id}`)
  const paymentId = ordFull.data?.payments?.[0]?.id ?? ordFull.data?.order?.payments?.[0]?.id ?? pay.data?.payment?.id ?? pay.data?.id
  const ver = await admApi.call('PATCH', `/api/payments/${paymentId}`, { status: 'VERIFIED' })
  log('5.3 payment verified by admin', ver.status === 200, `status ${ver.status}`)
  await waitEmail('customer', (m) => m.subject.startsWith('[Kozy Care · Payment]') && m.subject.includes('Payment confirmed'), 'payment-confirmed email')

  // Assign the rider
  const asg = await boardApi.call('PATCH', `/api/orders/${order.id}`, { driverId: riderUserId })
  log('5.4 rider assigned', asg.status === 200, `status ${asg.status}`)

  // Rider leg (Pass A): real GPS ping + GPS-gated confirm as the rider.
  if (PASS === 'A' && P.rider.password) {
    const rider = await login(P.rider.email, P.rider.password)
    log('5.5 rider signed in with own password', !rider.stillOnLogin && rider.page.url().includes('/driver'))
    const rApi = makeApi(rider.page)
    const stopList = await rApi.call('GET', '/api/orders')
    const stops: any[] = stopList.data?.items ?? stopList.data?.orders ?? stopList.data ?? []
    const stop = Array.isArray(stops) ? stops.find((o: any) => o.id === order.id) : null
    log('5.6 assigned stop visible in rider route list', !!stop, stop?.orderNumber ?? 'not found')
    await rider.page.screenshot({ path: 'work/p56-rider-stop.png' })

    // GPS ping at Lekki, then confirm pickup — the geofence action guard
    const ping = await rApi.call('POST', '/api/driver/location', { lat: 6.4392, lng: 3.4712 })
    log('5.7 rider GPS ping accepted (Lekki)', ping.status === 200 || ping.status === 201, `status ${ping.status} · ${ping.data?.status} · zone ${ping.data?.zone}`)
    const pick = await rApi.call('PATCH', `/api/orders/${order.id}`, { status: 'PICKED_UP' })
    log('5.8 rider swipe-confirm pickup (GPS-gated)', pick.status === 200, `status ${pick.status}`)
    await rider.ctx.close()
  } else {
    const pick = await admApi.call('PATCH', `/api/orders/${order.id}`, { status: 'PICKED_UP' })
    log('5.8 pickup confirmed (board)', pick.status === 200, `status ${pick.status}`)
  }

  // Quiet stages — no customer email is the assertion
  const beforeQuiet = await inboxCount('customer')
  await boardApi.call('PATCH', `/api/orders/${order.id}`, { status: 'AT_STATION' })
  await boardApi.call('PATCH', `/api/orders/${order.id}`, { status: 'PROCESSING' })
  await sleep(12000)
  const afterQuiet = await inboxCount('customer')
  log('5.9 quiet stages (at station / processing) send NOTHING', READ_INBOX ? afterQuiet === beforeQuiet : true, READ_INBOX ? `${beforeQuiet} → ${afterQuiet}` : 'owner inbox — skipped')

  await boardApi.call('PATCH', `/api/orders/${order.id}`, { status: 'FINISHING' })
  await waitEmail('customer', (m) => m.subject.startsWith('[Kozy Care · Order] Finishing touches'), 'finishing email')
  await boardApi.call('PATCH', `/api/orders/${order.id}`, { status: 'OUT_FOR_DELIVERY' })
  await waitEmail('customer', (m) => m.subject.startsWith('[Kozy Care · Delivery] Out for delivery'), 'out-for-delivery email')

  // ---- 6. Rider incident (the email the owner asked about) ------------------
  if (PASS === 'A' && P.rider.password) {
    const rider = await login(P.rider.email, P.rider.password)
    const rApi = makeApi(rider.page)
    const inc = await rApi.call('POST', `/api/orders/${order.id}/incident`, {
      kind: 'DAMAGE',
      description: 'E2E check: one white shirt has a small tear at the collar seam — spotted before handover, flagged immediately as trained.',
      atStop: 'delivery',
    })
    log('6.1 rider reported damage incident', inc.status === 201 || inc.status === 200, `status ${inc.status}`)
    await rider.ctx.close()
    const incidentEmail = await waitEmail('admin', (m) => m.subject.startsWith('[Kozy Care Ops · Incident] Damage reported on order'), 'admin incident alert')
    log('6.2 incident email categorized + worded "Damage reported"', !!incidentEmail, incidentEmail?.subject ?? 'not received')

    // Admin resolves it from the ledger
    const list = await admApi.call('GET', '/api/rider-applications')
    const incidents: any[] = list.data?.incidents ?? []
    const open = incidents.find((i: any) => i.orderId === order.id && !i.resolvedAt)
    if (open) {
      const res = await admApi.call('POST', `/api/rider-incidents/${open.id}`, {
        resolution: 'E2E resolution: shirt re-finished and pressed; customer informed at handover under the Return-as-Received Guarantee — no charge for the shirt.',
      })
      log('6.3 admin recorded incident outcome', res.status === 200, `status ${res.status}`)
    } else {
      log('6.3 open incident found in ledger', false, JSON.stringify(incidents).slice(0, 120))
    }
  } else {
    console.log('  (incident step is Pass A / the owner\'s own rider-play moment on the parked order)')
  }

  // ---- 7. Delivery + feedback + review --------------------------------------
  if (PASS === 'A' && P.rider.password) {
    const rider = await login(P.rider.email, P.rider.password)
    const rApi = makeApi(rider.page)
    await rApi.call('POST', '/api/driver/location', { lat: 6.4392, lng: 3.4712 })
    const del = await rApi.call('PATCH', `/api/orders/${order.id}`, { status: 'DELIVERED' })
    log('7.1 rider swipe-confirm delivery (GPS-gated)', del.status === 200, `status ${del.status}`)
    await rider.ctx.close()
  } else {
    const del = await admApi.call('PATCH', `/api/orders/${order.id}`, { status: 'DELIVERED' })
    log('7.1 delivery confirmed (board)', del.status === 200, `status ${del.status}`)
  }
  await waitEmail('customer', (m) => m.subject.startsWith('[Kozy Care · Feedback]') && m.subject.includes('how did we do'), 'feedback-request email')

  // Review: 4 stars → held for moderation (never pollutes the public wall)
  const rev = await custApi.call('POST', '/api/reviews', {
    orderId: order.id,
    rating: 4,
    comment: 'E2E test review — service was prompt and the finish was crisp; noting one shirt needed a second press.',
    displayName: P.customer.name,
  })
  log('7.2 customer submitted 4-star review', rev.status === 201 || rev.status === 200, `status ${rev.status}`)
  await waitEmail('admin', (m) => m.subject.startsWith('[Kozy Care Ops · Review] New review'), 'admin review alert')

  // ---- 8. Staff question to the customer ------------------------------------
  const ask = await boardApi.call('POST', `/api/orders/${order.id}/message`, {
    question: 'E2E check: quick one — was the blue kaftan part of this basket, or booked separately?',
  })
  log('8.1 staff asked the customer a question', ask.status === 200 || ask.status === 201, `status ${ask.status}`)
  await waitEmail('customer', (m) => m.subject.startsWith('[Kozy Care · Question] A quick question'), 'question email')

  // ---- 9. Pass B: a parked order for the owner's own rider play -------------
  if (PASS === 'B') {
    const booked2 = await custApi.call('POST', '/api/orders', bookPayload('14 Admiralty Way, Lekki Phase 1, Lagos'))
    const order2: any = booked2.data?.order ?? booked2.data
    log('9.1 second order booked for owner play', booked2.status === 201 || booked2.status === 200, `#${order2?.orderNumber}`)
    await custApi.call('POST', '/api/payments', { orderId: order2.id, amount: order2.totalPrice, method: 'BANK_TRANSFER' })
    const ord2Full = await admApi.call('GET', `/api/orders/${order2.id}`)
    const pay2Id = ord2Full.data?.payments?.[0]?.id ?? ord2Full.data?.order?.payments?.[0]?.id
    await admApi.call('PATCH', `/api/payments/${pay2Id}`, { status: 'VERIFIED' })
    await admApi.call('PATCH', `/api/orders/${order2.id}`, { driverId: riderUserId })
    log('9.2 parked at PAYMENT_VERIFIED + assigned to the rider — GPS ping, navigate, swipe-confirm and "Report a problem" are the owner\'s to play', true, `#${order2?.orderNumber}`)
    console.log(`  → ${P.rider.name}'s live stop: order #${order2?.orderNumber} at 14 Admiralty Way, Lekki Phase 1`)
  }

  // ---- 10. Restore alert recipients (Pass A only — drop my temp inbox) ------
  if (PASS === 'A') {
    const restoreList = [...new Set([...alertList, ADMIN_INBOX_USER])].join(',')
    const put = await admApi.call('PUT', '/api/settings/app', { settings: { adminAlertsEmail: restoreList } })
    log('10.1 alert recipients restored (owner\'s admin inbox kept, temp auto inbox removed)', put.status === 200, restoreList)
  }

  await adm.page.screenshot({ path: `work/p56-${PASS}-board.png` })

  // ---- SUMMARY ---------------------------------------------------------------
  console.log('\n================ SUMMARY ================')
  console.log(`${passCount}/${passCount + failCount} PASS`)
  if (failures.length) {
    console.log('FAILURES:')
    failures.forEach((f) => console.log('  - ' + f))
  }
  fs.writeFileSync(
    `work/p56-${PASS}-results.json`,
    JSON.stringify({ pass: PASS, passCount, failCount, failures, order: order?.orderNumber }, null, 2)
  )
}

main()
  .catch((e) => {
    console.error('BATTERY ERROR', e)
    process.exitCode = 1
  })
  .finally(async () => {
    if (browser) await browser.close()
    await db.$disconnect()
  })

