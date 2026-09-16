// =============================================================================
// Marketing engine — newsletter campaigns + coupon rules (phase 36)
// =============================================================================
// The single source of truth shared by the admin console, the public
// endpoints and the checkout pricing in /api/orders:
//
//   - Campaign sending: resolves the audience (customers + footer
//     subscribers, always opt-in filtered), wraps the body in the Kozy
//     email template, rewrites links through the click tracker, appends
//     the open-tracking pixel and the one-click unsubscribe footer, then
//     sends in batches through Brevo (tagged kozy-marketing).
//   - Coupon rules: one eligibility + amount function used by BOTH the
//     live "Apply code" preview in the booking wizard and the
//     authoritative checkout computation — the two can never disagree.
//
// Design rules (same as src/lib/notifications.ts):
//   - sending is resumable: recipient rows are created once per
//     (campaign, email) and only PENDING rows are ever sent, so an
//     interrupted "Send Now" simply continues where it stopped.
//   - per-user unsubscribe is token-signed (HMAC) and needs NO login —
//     it works for customers AND footer subscribers, and only ever
//     affects marketing email (transactional order email is untouched).
// =============================================================================

import crypto from 'crypto'
import { db } from '@/lib/db'
import { sendEmail } from '@/lib/email'
import { formatNaira } from '@/lib/types'
import { getNewsletterEntry, NEWSLETTER_BANNERS, NEWSLETTER_LIBRARY_TOTAL } from '@/lib/newsletter-content'

// -----------------------------------------------------------------------------
// Base URL
// -----------------------------------------------------------------------------
export function marketingBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    'http://localhost:3000'
  )
}

// -----------------------------------------------------------------------------
// Unsubscribe tokens — HMAC-signed, login-free, no expiry
// -----------------------------------------------------------------------------
// Payload: { e: email } — the unsubscribe endpoint clears BOTH the
// User.marketingOptIn flag and the NewsletterSubscriber.optIn flag for the
// address, so one link covers every way the email might have joined the list.
const TOKEN_SECRET =
  process.env.NEXTAUTH_SECRET || process.env.MARKETING_SECRET || 'kozy-dev-secret'

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url')
}

export function signUnsubscribeToken(email: string): string {
  const payload = b64url(JSON.stringify({ e: email.toLowerCase() }))
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

export function verifyUnsubscribeToken(token: string): string | null {
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return null
  const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url')
  // timing-safe compare (lengths differ → invalid)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString())
    return typeof parsed.e === 'string' ? parsed.e.toLowerCase() : null
  } catch {
    return null
  }
}

/** Apply the unsubscribe: both flag stores, no throw. Returns what changed. */
export async function applyUnsubscribe(email: string): Promise<{ user: boolean; subscriber: boolean }> {
  const result = { user: false, subscriber: false }
  try {
    const r1 = await db.user.updateMany({
      where: { email: email.toLowerCase() },
      data: { marketingOptIn: false },
    })
    result.user = r1.count > 0
  } catch (e) {
    console.error('unsubscribe user failed:', e)
  }
  try {
    const r2 = await db.newsletterSubscriber.updateMany({
      where: { email: email.toLowerCase(), optIn: true },
      data: { optIn: false, unsubscribedAt: new Date() },
    })
    result.subscriber = r2.count > 0
  } catch (e) {
    console.error('unsubscribe subscriber failed:', e)
  }
  return result
}

// -----------------------------------------------------------------------------
// Campaign HTML — brand wrapper + link rewriting + pixel + unsubscribe
// -----------------------------------------------------------------------------
/** Rewrite http(s) + root-relative links in the campaign body through the
 *  click tracker. mailto:/tel:/# anchors are left untouched. */
export function rewriteCampaignLinks(html: string, campaignId: string, recipientId: string): string {
  const base = marketingBaseUrl()
  return html.replace(/href\s*=\s*"(https?:\/\/[^"]+|\/[^"]*)"/g, (m, url: string) => {
    // Never wrap our own tracking endpoints (avoid loops)
    if (url.includes('/api/marketing/track/')) return m
    const tracked = `${base}/api/marketing/track/click?c=${campaignId}&r=${recipientId}&url=${encodeURIComponent(url)}`
    return `href="${tracked}"`
  })
}

// -----------------------------------------------------------------------------
// Plain-text → email HTML (the owner writes like a normal person)
// -----------------------------------------------------------------------------
/** Convert a plain-text message into clean, safe email HTML.
 *
 *  The owner types the campaign message the same way he would type a
 *  WhatsApp message — no HTML knowledge needed:
 *    - a blank line starts a new paragraph
 *    - a single line break is kept as a line break
 *    - **two stars around words** makes them bold
 *    - a pasted link (https://… or www.…) becomes a clickable link
 *
 *  Everything is HTML-escaped FIRST, so pasted text can never break the
 *  email layout or inject markup into what customers receive. */
export function plainTextToEmailHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

  const autolink = (s: string): string =>
    s.replace(/(^|[\s(])((?:https?:\/\/|www\.)[^\s<)]+)/g, (_m, pre: string, url: string) => {
      const href = url.startsWith('www.') ? `https://${url}` : url
      return `${pre}<a href="${href}" style="color: #0A192F; text-decoration: underline;">${url}</a>`
    })

  const bold = (s: string): string => s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
  const italic = (s: string): string => s.replace(/\*([^*\n]+)\*/g, '<em>$1</em>')

  return escaped
    .split(/\n{2,}/) // blank line = new paragraph
    .map((para) => para.trim())
    .filter((para) => para.length > 0)
    .map((para) => `<p style="margin: 0 0 16px 0;">${italic(bold(autolink(para))).replace(/\n/g, '<br>')}</p>`)
    .join('\n')
}

/** Wrap the admin's body HTML in the Kozy campaign template. Matches the
 *  transactional email look (navy header, gold wordmark) so every email
 *  from the business reads as one brand.
 *
 *  bannerSlug (phase 40): optional header image from /marketing/banners/ —
 *  the newsletter engine fills it from the 52-week library; the composer
 *  lets the owner pick one. Rendered as a plain <img> so every email client
 *  shows it; missing slug → no image, layout unaffected. */
export function wrapCampaignHtml(
  bodyHtml: string,
  opts: {
    campaignId: string
    recipientId: string
    email: string
    preview?: boolean
    bannerSlug?: string | null
  }
): string {
  const base = marketingBaseUrl()
  const pixel = `<img src="${base}/api/marketing/track/open?c=${opts.campaignId}&r=${opts.recipientId}" width="1" height="1" alt="" style="display:none;" />`
  const unsubToken = signUnsubscribeToken(opts.email)
  const unsubUrl = `${base}/api/marketing/unsubscribe?token=${unsubToken}`
  const trackedBody = rewriteCampaignLinks(bodyHtml, opts.campaignId, opts.recipientId)
  const validBanner =
    opts.bannerSlug && NEWSLETTER_BANNERS.some((b) => b.slug === opts.bannerSlug)
      ? opts.bannerSlug
      : null
  const bannerImg = validBanner
    ? `<img src="${base}/marketing/banners/banner-${validBanner}.jpg" width="600" alt="" style="display:block; width:100%; max-width:600px; height:auto; border:0;" />`
    : ''
  const testBanner = opts.preview
    ? `<div style="background:#FEF3C7;color:#92400E;padding:10px 16px;text-align:center;font-size:12px;font-weight:600;">Test copy &mdash; this version went only to you, no customer has received it</div>`
    : ''
  return `<!DOCTYPE html>
<html>
<body style="font-family: Georgia, serif; background: #F8F9FA; margin: 0; padding: 40px 12px;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(10,25,47,0.08);">
    ${testBanner}
    <div style="background: linear-gradient(135deg, #0A192F, #102740); padding: 32px 40px; text-align: center;">
      <h1 style="color: #D4AF37; font-family: Georgia, serif; font-size: 28px; font-weight: 700; margin: 0;">Kozy Care</h1>
      <p style="color: rgba(255,255,255,0.7); font-size: 11px; text-transform: uppercase; letter-spacing: 2px; margin: 4px 0 0 0;">Premium Drycleaning &amp; Laundry</p>
    </div>
    ${bannerImg}
    <div style="padding: 36px 40px; color: #1E2A3A; font-size: 15px; line-height: 1.7;">
      ${trackedBody}
    </div>
    <div style="padding: 20px 40px 32px 40px; border-top: 1px solid #E2E5E9; text-align: center;">
      <p style="color: #6F88A8; font-size: 12px; margin: 0 0 8px 0; line-height: 1.5;">
        Kozy Care · Premium Drycleaning &amp; Laundry<br>
        Lekki, Lagos · Customer care +234 803 175 5230
      </p>
      <p style="color: #9AA7B8; font-size: 11px; margin: 0; line-height: 1.6;">
        You&rsquo;re getting this because you&rsquo;re a Kozy Care customer or you signed up for our updates.
        If you&rsquo;d rather not get emails like this, just tap <a href="${unsubUrl}" style="color: #D4AF37; text-decoration: underline;">Unsubscribe</a>
        &mdash; it takes effect right away, and the emails about your orders will keep coming as normal.
      </p>
    </div>
  </div>
  ${pixel}
</body>
</html>`
}

// -----------------------------------------------------------------------------
// Audience resolution
// -----------------------------------------------------------------------------
export type CampaignSegment = 'ALL' | 'B2C' | 'B2B' | 'INACTIVE'

export const SEGMENT_LABELS: Record<CampaignSegment, string> = {
  ALL: 'All customers + subscribers',
  B2C: 'Retail customers only',
  B2B: 'Corporate customers only',
  INACTIVE: 'Win-back — no order in 60+ days',
}

export interface CampaignRecipient {
  email: string
  userId: string | null
  source: 'customer' | 'subscriber'
}

const INACTIVE_DAYS = 60

/** Resolve the audience for a segment. ALWAYS excludes opted-out customers
 *  (User.marketingOptIn=false). Footer subscribers ride along with the ALL
 *  segment only — their account type is unknown. */
export async function resolveSegmentRecipients(segment: CampaignSegment): Promise<CampaignRecipient[]> {
  const customerWhere: Record<string, unknown> = {
    role: { in: ['B2C', 'B2B'] },
    marketingOptIn: true,
  }
  if (segment === 'B2C') customerWhere.role = 'B2C'
  if (segment === 'B2B') customerWhere.role = 'B2B'
  if (segment === 'INACTIVE') {
    customerWhere.orders = {
      none: { createdAt: { gte: new Date(Date.now() - INACTIVE_DAYS * 24 * 60 * 60 * 1000) } },
    }
  }

  const [customers, subscribers] = await Promise.all([
    db.user.findMany({
      where: customerWhere as any,
      select: { id: true, email: true },
    }),
    // Subscribers only join "ALL" sends
    segment === 'ALL'
      ? db.newsletterSubscriber.findMany({
          where: { optIn: true },
          select: { email: true },
        })
      : Promise.resolve([] as { email: string }[]),
  ])

  const seen = new Set<string>()
  const recipients: CampaignRecipient[] = []
  for (const c of customers) {
    const email = c.email.toLowerCase()
    if (seen.has(email)) continue
    seen.add(email)
    recipients.push({ email, userId: c.id, source: 'customer' })
  }
  for (const s of subscribers) {
    const email = s.email.toLowerCase()
    if (seen.has(email)) continue
    seen.add(email)
    recipients.push({ email, userId: null, source: 'subscriber' })
  }
  return recipients
}

// -----------------------------------------------------------------------------
// Sending
// -----------------------------------------------------------------------------
const SEND_BATCH_SIZE = 20
const SEND_BATCH_GAP_MS = 400

export interface SendCampaignResult {
  campaignId: string
  total: number
  sentCount: number
  failedCount: number
}

/** Send (or resume sending) a campaign to its resolved audience.
 *
 *  - Recipient rows are created only for emails not already on the campaign
 *    (unique on [campaignId, email]) → re-running never duplicates.
 *  - Only PENDING rows are sent → an interrupted run resumes.
 *  - The campaign flips SENDING → SENT when the queue drains; a campaign
 *    already SENT with no PENDING rows is a no-op (idempotent).
 *  - Records a CAMPAIGN_SENT NotificationEvent so the owner sees the send
 *    in the console feed, even without opening the Marketing tab.
 */
export async function sendCampaignNow(campaignId: string): Promise<SendCampaignResult> {
  const campaign = await db.newsletterCampaign.findUnique({ where: { id: campaignId } })
  if (!campaign) throw new Error('Campaign not found')
  if (campaign.status === 'SENT') {
    // idempotent re-run: nothing pending unless a send previously failed
    const pending = await db.newsletterRecipient.count({
      where: { campaignId, deliveryStatus: 'PENDING' },
    })
    if (pending === 0) {
      return { campaignId, total: campaign.sentCount, sentCount: campaign.sentCount, failedCount: 0 }
    }
  }
  if (campaign.status === 'CANCELLED') throw new Error('Campaign was cancelled')

  // 1) Resolve audience + create any missing recipient rows
  const audience = await resolveSegmentRecipients(campaign.segment as CampaignSegment)
  const existing = await db.newsletterRecipient.findMany({
    where: { campaignId },
    select: { email: true },
  })
  const existingEmails = new Set(existing.map((r) => r.email.toLowerCase()))
  const newRows = audience.filter((a) => !existingEmails.has(a.email))
  if (newRows.length > 0) {
    await db.newsletterRecipient.createMany({
      data: newRows.map((a) => ({
        campaignId,
        userId: a.userId,
        email: a.email,
        source: a.source,
      })),
      skipDuplicates: true,
    })
  }

  await db.newsletterCampaign.update({
    where: { id: campaignId },
    data: { status: 'SENDING' },
  })

  // 2) Send every PENDING recipient in batches
  const queue = await db.newsletterRecipient.findMany({
    where: { campaignId, deliveryStatus: 'PENDING' },
    orderBy: { createdAt: 'asc' },
  })

  let sentCount = 0
  let failedCount = 0
  for (let i = 0; i < queue.length; i += SEND_BATCH_SIZE) {
    const batch = queue.slice(i, i + SEND_BATCH_SIZE)
    await Promise.all(
      batch.map(async (r) => {
        try {
          const html = wrapCampaignHtml(campaign.htmlContent, {
            campaignId,
            recipientId: r.id,
            email: r.email,
            bannerSlug: campaign.bannerSlug,
          })
          await sendEmail({
            to: r.email,
            subject: campaign.subject,
            html,
            tags: ['kozy-marketing'],
          })
          await db.newsletterRecipient.update({
            where: { id: r.id },
            data: { sentAt: new Date(), deliveryStatus: 'SENT' },
          })
          sentCount++
        } catch (e) {
          console.error(`Campaign send to ${r.email} failed:`, e)
          await db.newsletterRecipient
            .update({ where: { id: r.id }, data: { deliveryStatus: 'FAILED' } })
            .catch(() => undefined)
          failedCount++
        }
      })
    )
    if (i + SEND_BATCH_SIZE < queue.length) {
      await new Promise((res) => setTimeout(res, SEND_BATCH_GAP_MS))
    }
  }

  // 3) Finalise counters + status
  const [totalRows, totalSent] = await Promise.all([
    db.newsletterRecipient.count({ where: { campaignId } }),
    db.newsletterRecipient.count({ where: { campaignId, deliveryStatus: 'SENT' } }),
  ])
  await db.newsletterCampaign.update({
    where: { id: campaignId },
    data: { status: 'SENT', sentAt: new Date(), sentCount: totalSent },
  })

  // 4) Console feed event (never throws)
  try {
    await db.notificationEvent.create({
      data: {
        type: 'CAMPAIGN_SENT',
        title: `Campaign sent — ${campaign.name}`,
        body: `"${campaign.subject}" went to ${totalSent} of ${totalRows} recipients${
          failedCount > 0 ? ` (${failedCount} failed)` : ''
        }.`,
        data: JSON.stringify({ campaignId, sent: totalSent, failed: failedCount, segment: campaign.segment }),
        linkTab: 'marketing',
        emailStatus: failedCount === 0 ? 'SENT' : failedCount === totalRows ? 'FAILED' : 'PARTIAL',
      },
    })
  } catch (e) {
    console.error('CAMPAIGN_SENT event failed:', e)
  }

  return { campaignId, total: totalRows, sentCount: totalSent, failedCount }
}

/** Send a test copy of the campaign to a single address (admin preview).
 *  Records testSentAt — a live blast is only allowed after the owner has
 *  seen the email in his own inbox first (the test-first guard). */
export async function sendCampaignTest(campaignId: string, to: string): Promise<void> {
  const campaign = await db.newsletterCampaign.findUnique({ where: { id: campaignId } })
  if (!campaign) throw new Error('Campaign not found')
  // A test needs a recipient row id for the tracking pixel — use a synthetic
  // marker so the trackers can attribute it to the preview (no DB row).
  const html = wrapCampaignHtml(campaign.htmlContent, {
    campaignId,
    recipientId: 'test',
    email: to,
    preview: true,
    bannerSlug: campaign.bannerSlug,
  })
  await sendEmail({
    to,
    subject: `[TEST] ${campaign.subject}`,
    html,
    tags: ['kozy-marketing', 'kozy-test'],
  })
  await db.newsletterCampaign.update({ where: { id: campaignId }, data: { testSentAt: new Date() } })
}

/** Render the exact HTML a campaign would send — WITHOUT sending anything.
 *  Powers the in-console preview (composer live preview + the Preview
 *  button on saved campaigns). The yellow "test copy" banner is always
 *  included so a preview can never be confused with a real send. */
export function buildCampaignPreviewHtml(
  campaign: { id: string; htmlContent: string; bannerSlug?: string | null },
  viewerEmail: string
): string {
  return wrapCampaignHtml(campaign.htmlContent, {
    campaignId: campaign.id,
    recipientId: 'preview',
    email: viewerEmail,
    preview: true,
    bannerSlug: campaign.bannerSlug,
  })
}

/** Process every SCHEDULED campaign whose time has come. Used by the cron
 *  endpoint AND the lazy scheduler (the marketing view calls it on mount,
 *  so scheduled sends still go out on the days the owner checks the console
 *  even if the cron is delayed).
 *
 *  Phase 40: also nudges the newsletter engine — if the owner's cadence slot
 *  is close and no draft exists yet, the next 52-week-library draft is
 *  created (a DRAFT, never auto-sent). */
export async function processDueCampaigns(): Promise<{ processed: string[]; failed: { id: string; error: string }[] }> {
  // Auto-draft first (never throws into the send loop)
  try {
    await ensureNextAutoDraft()
  } catch (e) {
    console.error('ensureNextAutoDraft failed:', e)
  }
  const due = await db.newsletterCampaign.findMany({
    where: { status: 'SCHEDULED', scheduledAt: { lte: new Date() } },
    select: { id: true },
  })
  const processed: string[] = []
  const failed: { id: string; error: string }[] = []
  for (const c of due) {
    try {
      await sendCampaignNow(c.id)
      processed.push(c.id)
    } catch (e) {
      failed.push({ id: c.id, error: e instanceof Error ? e.message : String(e) })
    }
  }
  return { processed, failed }
}

// -----------------------------------------------------------------------------
// Newsletter automation engine (phase 40)
// -----------------------------------------------------------------------------
// The owner's cadence, the 52-week content library, and the one rule that
// makes it accident-proof: the engine DRAFTS, the owner APPROVES.
//
//   ensureNextAutoDraft()  — called by processDueCampaigns (cron + lazy) and
//                            by the explicit "Prepare now" button. Creates
//                            at most ONE pending automation campaign at a
//                            time, ~3 days before the slot (DRAFT_LEAD_DAYS).
//   approve → the UI PATCHes the campaign to SCHEDULED (slot date) — the
//             existing cron/lazy scheduler then delivers it, identical to
//             any hand-scheduled campaign. Nothing is ever auto-sent.
//   skip → deletes the DRAFT (only drafts) and moves the engine to the next
//          slot. The rhythm holds; the content pointer advances.
//
// Lagos is UTC+1 with no DST, so wall-clock math is a fixed offset.
const LAGOS_OFFSET_MIN = 60
const DRAFT_LEAD_DAYS = 3 // drafts appear this many days before the slot
const MIN_SLOT_LEAD_MIN = 60 * 24 // never target a slot less than ~24h out

export interface MarketingScheduleView {
  enabled: boolean
  cadenceWeeks: number
  dayOfWeek: number
  sendTime: string
  currentWeekIndex: number
  nextSlotDate: Date | null
}

export async function getOrCreateSchedule() {
  const existing = await db.marketingSchedule.findUnique({ where: { id: 'main' } })
  if (existing) return existing
  return db.marketingSchedule.create({ data: { id: 'main' } }).catch(async () => {
    // racing create (two requests, same singleton) — the row exists now
    return (await db.marketingSchedule.findUnique({ where: { id: 'main' } }))!
  })
}

/** Next occurrence of dayOfWeek+sendTime (Africa/Lagos) at least ~24h out. */
export function nextOccurrenceLagos(
  dayOfWeek: number,
  sendTime: string,
  from: Date = new Date()
): Date {
  const [h, m] = sendTime.split(':').map((x) => parseInt(x, 10))
  const hour = Number.isFinite(h) ? Math.min(Math.max(h || 0, 0), 23) : 9
  const minute = Number.isFinite(m) ? Math.min(Math.max(m || 0, 0), 59) : 0
  const lagosNow = new Date(from.getTime() + LAGOS_OFFSET_MIN * 60_000)
  for (let add = 0; add <= 8; add++) {
    const candidate = new Date(
      Date.UTC(
        lagosNow.getUTCFullYear(),
        lagosNow.getUTCMonth(),
        lagosNow.getUTCDate() + add,
        hour,
        minute,
        0,
        0
      )
    )
    if (
      candidate.getUTCDay() === dayOfWeek &&
      candidate.getTime() >= lagosNow.getTime() + MIN_SLOT_LEAD_MIN * 60_000
    ) {
      return new Date(candidate.getTime() - LAGOS_OFFSET_MIN * 60_000)
    }
  }
  // unreachable for valid dayOfWeek, but keep types honest
  return new Date(from.getTime() + MIN_SLOT_LEAD_MIN * 60_000 + 7 * 86_400_000)
}

/** The pending automation campaign, if one exists (DRAFT or SCHEDULED). */
export async function getPendingAutomationCampaign() {
  return db.newsletterCampaign.findFirst({
    where: { source: 'automation', status: { in: ['DRAFT', 'SCHEDULED'] } },
    orderBy: { createdAt: 'desc' },
  })
}

/** Create the next automation draft if the slot is close (or force=true).
 *  Returns the created campaign, or null when there is nothing to do:
 *  disabled engine, a draft already waiting, or a slot still far away. */
export async function ensureNextAutoDraft(force = false) {
  const sched = await getOrCreateSchedule()
  if (!sched.enabled) return null
  if (await getPendingAutomationCampaign()) return null

  // Resolve the slot: the stored one if it is still sensibly in the future,
  // otherwise the next occurrence of the owner's day/time.
  let slot = sched.nextSlotDate
  if (!slot || slot.getTime() < Date.now() + MIN_SLOT_LEAD_MIN * 60_000) {
    slot = nextOccurrenceLagos(sched.dayOfWeek, sched.sendTime)
    await db.marketingSchedule.update({
      where: { id: 'main' },
      data: { nextSlotDate: slot },
    })
  }
  if (!force && slot.getTime() - Date.now() > DRAFT_LEAD_DAYS * 86_400_000) {
    return null // not close enough — nothing to prepare yet
  }

  const entry = getNewsletterEntry(sched.currentWeekIndex)
  const campaign = await db.newsletterCampaign.create({
    data: {
      name: `Week ${entry.week} — ${entry.title}`,
      subject: entry.subject,
      htmlContent: plainTextToEmailHtml(entry.bodyText),
      bodyText: entry.bodyText,
      segment: 'ALL',
      status: 'DRAFT',
      source: 'automation',
      slotDate: slot,
      // pre-fill the schedule so "Approve" is one click; status stays DRAFT
      // so processDueCampaigns will never pick it up before approval.
      scheduledAt: slot,
      bannerSlug: entry.banner,
    },
  })
  // Advance: content pointer +1, next slot +cadence (rhythm holds even if
  // this draft is skipped — the engine never stacks a second one).
  await db.marketingSchedule.update({
    where: { id: 'main' },
    data: {
      currentWeekIndex: (sched.currentWeekIndex + 1) % NEWSLETTER_LIBRARY_TOTAL,
      nextSlotDate: new Date(slot.getTime() + sched.cadenceWeeks * 7 * 86_400_000),
    },
  })
  return campaign
}

/** Skip the pending automation DRAFT: delete it and prepare the next one.
 *  SCHEDULED campaigns cannot be skipped (already approved — delete it from
 *  the campaign list instead if the plan changed). */
export async function skipAutoDraft(campaignId: string) {
  const campaign = await db.newsletterCampaign.findUnique({ where: { id: campaignId } })
  if (!campaign || campaign.source !== 'automation') {
    throw new Error('Campaign not found')
  }
  if (campaign.status !== 'DRAFT') {
    throw new Error('Only a draft can be skipped — this one is already approved')
  }
  await db.newsletterCampaign.delete({ where: { id: campaignId } })
  const next = await ensureNextAutoDraft(true)
  return next
}

/** Everything the automation panel needs in one call. */
export async function getAutomationState() {
  const sched = await getOrCreateSchedule()
  const [pending, lastSent] = await Promise.all([
    getPendingAutomationCampaign(),
    db.newsletterCampaign.findFirst({
      where: { source: 'automation', status: 'SENT' },
      orderBy: { sentAt: 'desc' },
      select: { id: true, name: true, subject: true, sentAt: true, sentCount: true },
    }),
  ])
  const upcoming = getNewsletterEntry(sched.currentWeekIndex)
  return {
    schedule: {
      enabled: sched.enabled,
      cadenceWeeks: sched.cadenceWeeks,
      dayOfWeek: sched.dayOfWeek,
      sendTime: sched.sendTime,
      currentWeekIndex: sched.currentWeekIndex,
      nextSlotDate: sched.nextSlotDate,
    } satisfies MarketingScheduleView,
    pending: pending
      ? {
          id: pending.id,
          name: pending.name,
          subject: pending.subject,
          status: pending.status,
          slotDate: pending.slotDate,
          scheduledAt: pending.scheduledAt,
          testSentAt: pending.testSentAt,
          bannerSlug: pending.bannerSlug,
        }
      : null,
    lastSent,
    nextUp: {
      week: upcoming.week,
      title: upcoming.title,
      subject: upcoming.subject,
      season: upcoming.season,
      category: upcoming.category,
    },
    libraryTotal: NEWSLETTER_LIBRARY_TOTAL,
  }
}

// -----------------------------------------------------------------------------
// Coupon rules — shared by /api/marketing/coupons/validate (preview) and
// the authoritative checkout in /api/orders
// -----------------------------------------------------------------------------
export interface CouponRecord {
  id: string
  name: string
  code: string | null
  type: string // PERCENTAGE | FIXED
  value: number
  active: boolean
  appliesTo: string // ALL | SIGNUP | FIRST_ORDER | B2C | B2B
  minOrderValue: number | null
  maxDiscount: number | null
  maxUsesTotal: number | null
  maxUsesPerUser: number | null
  currentUses: number
  startDate: Date | null
  endDate: Date | null
}

export interface CouponCheckContext {
  /** User role (B2C/B2B/…) — null for an anonymous validator. */
  userRole?: string | null
  /** Is this the customer's first order? */
  isFirstOrder: boolean
  /** The customer's user id — null/undefined for anonymous validation. */
  userId?: string | null
  /** The customer's email — used for per-user usage counts when the
   *  customer is a guest (DiscountUsage stores an email snapshot). */
  userEmail?: string | null
}

export interface CouponCheckResult {
  ok: boolean
  /** Machine reason, e.g. EXPIRED | NOT_ACTIVE | SEGMENT | MIN_ORDER | ... */
  reason?: string
  /** Human sentence, safe to show to a customer. */
  message?: string
}

/** All coupon rule checks EXCEPT the amount computation. */
export async function checkCouponEligibility(
  coupon: CouponRecord,
  ctx: CouponCheckContext,
  serviceSubtotal: number
): Promise<CouponCheckResult> {
  if (!coupon.active) {
    return { ok: false, reason: 'NOT_ACTIVE', message: 'This coupon is no longer active.' }
  }
  const now = new Date()
  if (coupon.startDate && now < coupon.startDate) {
    return { ok: false, reason: 'NOT_STARTED', message: 'This coupon is not active yet.' }
  }
  if (coupon.endDate && now > coupon.endDate) {
    return { ok: false, reason: 'EXPIRED', message: 'This coupon has expired.' }
  }
  // Segment eligibility (SIGNUP rows are policy gates, never valid codes)
  if (coupon.appliesTo === 'SIGNUP') {
    return { ok: false, reason: 'NOT_A_COUPON', message: 'This code cannot be applied at checkout.' }
  }
  if (coupon.appliesTo === 'B2C' && ctx.userRole && ctx.userRole !== 'B2C') {
    return { ok: false, reason: 'SEGMENT', message: 'This coupon is for retail customers only.' }
  }
  if (coupon.appliesTo === 'B2B' && ctx.userRole && ctx.userRole !== 'B2B') {
    return { ok: false, reason: 'SEGMENT', message: 'This coupon is for corporate accounts only.' }
  }
  if (coupon.appliesTo === 'FIRST_ORDER' && !ctx.isFirstOrder) {
    return { ok: false, reason: 'FIRST_ORDER_ONLY', message: 'This offer is only valid on a first order.' }
  }
  // Minimum basket
  if ((coupon.minOrderValue ?? 0) > 0 && serviceSubtotal < (coupon.minOrderValue ?? 0)) {
    return {
      ok: false,
      reason: 'MIN_ORDER',
      message: `This coupon needs a service total of at least ${formatNaira(coupon.minOrderValue!)}.`,
    }
  }
  // Total usage limit
  if (coupon.maxUsesTotal != null && coupon.currentUses >= coupon.maxUsesTotal) {
    return { ok: false, reason: 'MAX_TOTAL', message: 'This coupon has reached its usage limit.' }
  }
  // Per-user usage limit (by userId, falling back to the email snapshot)
  if (coupon.maxUsesPerUser != null) {
    const email = (ctx.userEmail ?? '').toLowerCase()
    if (ctx.userId || email) {
      const used = await db.discountUsage.count({
        where: {
          discountId: coupon.id,
          ...(ctx.userId ? { userId: ctx.userId } : { userEmail: email }),
        },
      })
      if (used >= coupon.maxUsesPerUser) {
        return { ok: false, reason: 'MAX_PER_USER', message: 'You have already used this coupon.' }
      }
    }
  }
  return { ok: true }
}

/** Compute the ₦ discount for an eligible coupon against a service subtotal. */
export function computeCouponAmount(coupon: CouponRecord, serviceSubtotal: number): number {
  let amount = 0
  if (coupon.type === 'PERCENTAGE') {
    amount = serviceSubtotal * (Math.max(0, Math.min(coupon.value, 100)) / 100)
    if (coupon.maxDiscount != null && amount > coupon.maxDiscount) amount = coupon.maxDiscount
  } else {
    amount = coupon.value
  }
  // Never discount more than the service charge itself
  return Math.max(0, Math.min(Math.round(amount), Math.round(serviceSubtotal)))
}

/** Auto-generate an admin-friendly coupon code (no ambiguous chars). */
export function generateCouponCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

// -----------------------------------------------------------------------------
// Welcome email for new footer subscribers
// -----------------------------------------------------------------------------
export async function sendSubscriberWelcome(email: string): Promise<void> {
  const base = marketingBaseUrl()
  const unsubToken = signUnsubscribeToken(email)
  const unsubUrl = `${base}/api/marketing/unsubscribe?token=${unsubToken}`
  await sendEmail({
    to: email,
    subject: 'Welcome to the Kozy Care circle',
    html: `<!DOCTYPE html>
<html>
<body style="font-family: Georgia, serif; background: #F8F9FA; margin: 0; padding: 40px 12px;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(10,25,47,0.08);">
    <div style="background: linear-gradient(135deg, #0A192F, #102740); padding: 32px 40px; text-align: center;">
      <h1 style="color: #D4AF37; font-family: Georgia, serif; font-size: 28px; font-weight: 700; margin: 0;">Kozy Care</h1>
      <p style="color: rgba(255,255,255,0.7); font-size: 11px; text-transform: uppercase; letter-spacing: 2px; margin: 4px 0 0 0;">Premium Drycleaning &amp; Laundry</p>
    </div>
    <div style="padding: 36px 40px; color: #1E2A3A; font-size: 15px; line-height: 1.7;">
      <h2 style="color: #0A192F; font-family: Georgia, serif; font-size: 22px; margin: 0 0 16px 0;">You're on the list</h2>
      <p style="color: #6F88A8; margin: 0 0 16px 0;">
        Thank you for subscribing. From now on you'll hear from us when it matters:
        seasonal offers and coupon codes, care tips that keep your wardrobe looking new,
        and first word when we open new pickup routes.
      </p>
      <p style="color: #6F88A8; margin: 0 0 16px 0;">
        Ready when you are — book a pickup and experience the Kozy standard:
        garment-safe cleaning, careful finishing, and door-to-door service.
      </p>
      <a href="${base}/book" style="display: inline-block; background: linear-gradient(135deg, #E3BE4F, #D4AF37, #B8962B); color: #0A192F; padding: 14px 32px; border-radius: 9999px; text-decoration: none; font-weight: 700; font-size: 15px; box-shadow: 0 4px 14px rgba(212,175,55,0.35);">Book a pickup</a>
    </div>
    <div style="padding: 20px 40px 32px 40px; border-top: 1px solid #E2E5E9; text-align: center;">
      <p style="color: #9AA7B8; font-size: 11px; margin: 0;">
        Kozy Care · Lekki, Lagos · Customer care +234 803 175 5230<br>
        <a href="${unsubUrl}" style="color: #D4AF37;">Unsubscribe</a> at any time.
      </p>
    </div>
  </div>
</body>
</html>`,
    tags: ['kozy-marketing'],
  })
}
