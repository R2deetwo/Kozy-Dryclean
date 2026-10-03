// =============================================================================
// Google reviews engine (Task 87, owner directive)
// =============================================================================
// "Let the Google review be the thing." Google is now the SINGLE place
// customers are asked to review Kozy Care:
//
//   1. THE ASK — the delivered-order email (and a one-time sweep backfill
//      for recent deliveries) invites the customer to review us on Google,
//      through a TRACKED link. The tracking is the anti-harassment memory:
//      the first tap on the Google link is our honest proxy for "they left
//      a review" (Google shares no per-reviewer signal we could match), so
//      from that moment they are NEVER asked again. Every ask email also
//      carries a one-tap "never ask me again" opt-out. Caps: at most one
//      ask per 30 days, at most 6 lifetime, never twice for the same
//      delivery. A customer whose private in-app feedback was unhappy
//      (< 4 stars) is never asked to take it public.
//
//   2. THE WALL — the site's testimonials come from the Google Business
//      Profile: a sync pulls the listing's reviews (Places API — needs
//      GOOGLE_MAPS_API_KEY, which the office adds in Vercel when ready),
//      and the office can also type a review in from the public listing
//      (source MANUAL). Selection is the same pattern the old in-app
//      reviews had: AUTO mode shows every synced review rated >= 4 that is
//      not hidden; MANUAL mode shows only the rows the office approved.
//
// No per-customer data is ever inferred from review content — the ask
// cadence is driven purely by OUR email/link telemetry, which we disclose
// in the privacy policy.
// =============================================================================

import crypto from 'crypto'
import { db } from '@/lib/db'
import { GOOGLE_BUSINESS, GOOGLE_REVIEW_URL } from '@/lib/local-seo'
import { getAppSettings } from '@/lib/app-settings'
import type { Testimonial } from '@/lib/types'

// -----------------------------------------------------------------------------
// The ask-state machine (anti-harassment)
// -----------------------------------------------------------------------------

/** The caps that keep a review invitation from ever feeling like spam. */
export const REVIEW_ASK_CAPS = {
  /** Minimum gap between asks, no matter how many deliveries happen. */
  gapMs: 30 * 24 * 60 * 60 * 1000,
  /** Lifetime cap. */
  maxAsks: 6,
} as const

export interface AskState {
  asksTotal: number
  lastAskedAt: Date | null
  clickedThroughAt: Date | null
  optedOutAt: Date | null
  lastOrderId: string | null
}

/** Read (or lazily create) a customer's ask state. */
export async function getAskState(userId: string): Promise<AskState> {
  let row = await db.reviewAskState.findUnique({ where: { userId } })
  if (!row) {
    try {
      row = await db.reviewAskState.create({ data: { userId } })
    } catch {
      // A concurrent create (delivered email + sweep race) — re-read.
      row = await db.reviewAskState.findUnique({ where: { userId } })
    }
  }
  if (!row) return { asksTotal: 0, lastAskedAt: null, clickedThroughAt: null, optedOutAt: null, lastOrderId: null }
  return {
    asksTotal: row.asksTotal,
    lastAskedAt: row.lastAskedAt,
    clickedThroughAt: row.clickedThroughAt,
    optedOutAt: row.optedOutAt,
    lastOrderId: row.lastOrderId,
  }
}

/** May this customer be asked to review Google for this delivery? All the
 *  harassment guards in one honest answer. */
export async function eligibleForReviewAsk(
  userId: string,
  opts: { orderId?: string; now?: number } = {}
): Promise<boolean> {
  const state = await getAskState(userId)
  const now = opts.now ?? Date.now()
  if (state.optedOutAt) return false
  // They already went to Google through one of our links — assume reviewed,
  // never ask again.
  if (state.clickedThroughAt) return false
  if (state.asksTotal >= REVIEW_ASK_CAPS.maxAsks) return false
  if (state.lastAskedAt && now - new Date(state.lastAskedAt).getTime() < REVIEW_ASK_CAPS.gapMs) {
    return false
  }
  if (opts.orderId && state.lastOrderId === opts.orderId) return false
  // Never invite an unhappy customer to take it public: if their most recent
  // private order feedback (last 180 days) was below 4 stars, the next thing
  // they should hear from us is a fix, not a review request.
  try {
    const unhappy = await db.review.findFirst({
      where: { userId, rating: { lt: 4 }, createdAt: { gte: new Date(now - 180 * 24 * 60 * 60 * 1000) } },
      orderBy: { createdAt: 'desc' },
    })
    if (unhappy) return false
  } catch {
    /* a failed guard-check never blocks the ask pipeline */
  }
  return true
}

/** Record that an ask email actually went out (or is about to). */
export async function recordReviewAskSent(userId: string, orderId?: string): Promise<void> {
  await getAskState(userId) // ensures the row exists
  try {
    await db.reviewAskState.update({
      where: { userId },
      data: { asksTotal: { increment: 1 }, lastAskedAt: new Date(), ...(orderId ? { lastOrderId: orderId } : {}) },
    })
  } catch (e) {
    console.error('[google-reviews] ask-state write failed:', e)
  }
}

/** They tapped the Google link — set the never-ask-again marker. */
export async function recordReviewClick(userId: string): Promise<void> {
  await getAskState(userId)
  try {
    await db.reviewAskState.update({
      where: { userId },
      data: { clickedThroughAt: new Date() },
    })
  } catch (e) {
    console.error('[google-reviews] click-state write failed:', e)
  }
}

/** They tapped "never ask me again". */
export async function optOutReviewAsks(userId: string): Promise<void> {
  await getAskState(userId)
  try {
    await db.reviewAskState.update({
      where: { userId },
      data: { optedOutAt: new Date() },
    })
  } catch (e) {
    console.error('[google-reviews] opt-out write failed:', e)
  }
}

// -----------------------------------------------------------------------------
// Tracked links (HMAC-signed — no auth needed, they arrive by email)
// -----------------------------------------------------------------------------

function askSecret(): string {
  return process.env.NEXTAUTH_SECRET || 'kozy-review-ask-dev-secret'
}

function askSig(userId: string, scope: string): string {
  return crypto.createHmac('sha256', askSecret()).update(`${scope}:${userId}`).digest('hex').slice(0, 32)
}

/** The tracked Google-review link for one customer (and the order the ask
 *  rides on). Clicking it marks them as having reviewed — never asked again. */
export function googleReviewAskLink(userId: string, orderId?: string): string {
  const base = process.env.NEXTAUTH_URL || 'https://kozycare.ng'
  const u = encodeURIComponent(userId)
  const t = encodeURIComponent(askSig(userId, 'google-review'))
  const o = orderId ? `&o=${encodeURIComponent(orderId)}` : ''
  return `${base}/api/reviews/google-redirect?u=${u}${o}&t=${t}`
}

/** The one-tap "never ask me for reviews again" link. */
export function reviewAskOptOutLink(userId: string): string {
  const base = process.env.NEXTAUTH_URL || 'https://kozycare.ng'
  const u = encodeURIComponent(userId)
  const t = encodeURIComponent(askSig(userId, 'review-optout'))
  return `${base}/api/reviews/google-optout?u=${u}&t=${t}`
}

/** Validate a link's token. */
export function verifyAskToken(userId: string, token: string, scope: string): boolean {
  if (!userId || !token) return false
  const expected = askSig(userId, scope)
  const a = Buffer.from(expected)
  const b = Buffer.from(token)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

// -----------------------------------------------------------------------------
// The sync (Places API → GoogleReview rows) + the wall selection
// -----------------------------------------------------------------------------

/** Raw shape of a Google Places review (the fields we consume). */
interface PlacesReview {
  author_name?: string
  rating?: number
  text?: string
  relative_time_description?: string
  time?: number // epoch seconds
}

export interface SyncResult {
  ok: boolean
  status: 'SYNCED' | 'NOT_CONFIGURED' | 'ERROR'
  fetched?: number
  created?: number
  updated?: number
  rating?: number
  reviewCount?: number
  message: string
}

/** Stable identity for a review inside Google's listing — makes the sync
 *  idempotent (re-syncing the same review updates, never duplicates). */
function googleKeyFor(r: PlacesReview): string {
  const seed = `${r.author_name ?? ''}|${r.time ?? ''}|${(r.text ?? '').slice(0, 80)}`
  return crypto.createHash('sha256').update(seed).digest('hex')
}

/**
 * Pull the listing's reviews from the Google Places API and upsert them.
 * Google returns the 5 most recent reviews per call (their documented
 * limit) — repeated syncs keep the wall fresh. Requires
 * GOOGLE_MAPS_API_KEY in the environment; without it the result is an
 * honest NOT_CONFIGURED the admin UI explains how to fix.
 */
export async function syncGoogleReviews(): Promise<SyncResult> {
  const key = process.env.GOOGLE_MAPS_API_KEY?.trim()
  if (!key) {
    return {
      ok: false,
      status: 'NOT_CONFIGURED',
      message:
        'GOOGLE_MAPS_API_KEY is not set. Add it in Vercel (Project → Settings → Environment Variables) after enabling the Places API in Google Cloud — then sync works. Until then, reviews can be entered manually from the public Google listing.',
    }
  }
  try {
    const url =
      `https://maps.googleapis.com/maps/api/place/details/json` +
      `?place_id=${encodeURIComponent(GOOGLE_BUSINESS.placeId)}` +
      `&fields=rating,user_rating_count,reviews&reviews_sort=newest&key=${key}`
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) {
      return { ok: false, status: 'ERROR', message: `Places API responded ${res.status}.` }
    }
    const data = (await res.json()) as {
      status?: string
      error_message?: string
      result?: { rating?: number; user_rating_count?: number; reviews?: PlacesReview[] }
    }
    if (data.status !== 'OK' || !data.result) {
      return {
        ok: false,
        status: 'ERROR',
        message: `Places API said "${data.status}"${data.error_message ? ` — ${data.error_message}` : ''}`,
      }
    }
    const reviews = data.result.reviews ?? []
    let created = 0
    let updated = 0
    for (const r of reviews) {
      if (!r.author_name || !r.rating) continue
      const googleKey = googleKeyFor(r)
      const row = {
        googleKey,
        authorName: r.author_name.slice(0, 120),
        rating: Math.max(1, Math.min(5, Math.round(r.rating))),
        text: r.text?.slice(0, 2000) || null,
        relativeTime: r.relative_time_description?.slice(0, 60) || null,
        reviewedAt: r.time ? new Date(r.time * 1000) : null,
        syncedAt: new Date(),
      }
      const existing = await db.googleReview.findUnique({ where: { googleKey } })
      if (existing) {
        await db.googleReview.update({ where: { googleKey }, data: row })
        updated++
      } else {
        await db.googleReview.create({ data: row })
        created++
      }
    }
    // The aggregate (rating + count) lands in AppSetting so the trust bar
    // and the admin UI can quote Google's own numbers.
    try {
      await db.appSetting.upsert({
        where: { key: 'google_rating' },
        update: { value: JSON.stringify(data.result.rating ?? 0) },
        create: { key: 'google_rating', value: JSON.stringify(data.result.rating ?? 0) },
      })
      await db.appSetting.upsert({
        where: { key: 'google_review_count' },
        update: { value: JSON.stringify(data.result.user_rating_count ?? 0) },
        create: { key: 'google_review_count', value: JSON.stringify(data.result.user_rating_count ?? 0) },
      })
      await db.appSetting.upsert({
        where: { key: 'google_review_synced_at' },
        update: { value: JSON.stringify(new Date().toISOString()) },
        create: { key: 'google_review_synced_at', value: JSON.stringify(new Date().toISOString()) },
      })
    } catch (e) {
      console.error('[google-reviews] aggregate settings write failed:', e)
    }
    return {
      ok: true,
      status: 'SYNCED',
      fetched: reviews.length,
      created,
      updated,
      rating: data.result.rating,
      reviewCount: data.result.user_rating_count,
      message: `Synced ${reviews.length} review${reviews.length === 1 ? '' : 's'} from Google (${created} new, ${updated} refreshed). Google reports ${data.result.rating ?? '—'} stars across ${data.result.user_rating_count ?? 0} reviews.`,
    }
  } catch (e) {
    return { ok: false, status: 'ERROR', message: `Sync failed: ${(e as Error).message}` }
  }
}

/** Google's aggregate stats for the listing, as synced (null = never
 *  synced / not configured — callers fall back honestly). */
export async function googleReviewStats(): Promise<{ rating: number; count: number; syncedAt: string | null } | null> {
  try {
    const rows = await db.appSetting.findMany({
      where: { key: { in: ['google_rating', 'google_review_count', 'google_review_synced_at'] } },
    })
    const map = new Map(rows.map((r) => [r.key, r.value]))
    const syncedAt = map.get('google_review_synced_at')
    if (!syncedAt) return null
    const rating = Number(JSON.parse(map.get('google_rating') ?? '0'))
    const count = Number(JSON.parse(map.get('google_review_count') ?? '0'))
    if (!Number.isFinite(rating) || rating <= 0) return null
    return { rating, count, syncedAt: (() => { try { return JSON.parse(syncedAt) } catch { return null } })() }
  } catch {
    return null
  }
}

/** The reviews selected for the public wall, per the office's mode. */
export async function selectedGoogleReviews(limit = 12): Promise<Testimonial[]> {
  const settings = await getAppSettings()
  const where = settings.googleReviewAutoSelect
    ? { hidden: false, rating: { gte: 4 } } // AUTO — everything decent, office hides exceptions
    : { hidden: false, approved: true } // MANUAL — only the office's picks
  const rows = await db.googleReview.findMany({
    where,
    orderBy: [{ reviewedAt: 'desc' }, { createdAt: 'desc' }],
    take: limit,
  })
  return rows.map((r) => ({
    id: r.id,
    displayName: r.authorName,
    rating: r.rating,
    comment: r.text?.trim() || '(No written review — rated on Google)',
    relativeTime: r.relativeTime ?? undefined,
    createdAt: (r.reviewedAt ?? r.createdAt).toISOString(),
    source: 'GOOGLE' as const,
  }))
}

/** ADMIN: every Google review row (for the moderation list). */
export async function allGoogleReviews() {
  const rows = await db.googleReview.findMany({
    orderBy: [{ reviewedAt: 'desc' }, { createdAt: 'desc' }],
  })
  return rows.map((r) => ({
    id: r.id,
    authorName: r.authorName,
    rating: r.rating,
    text: r.text,
    relativeTime: r.relativeTime,
    reviewedAt: r.reviewedAt?.toISOString() ?? null,
    approved: r.approved,
    hidden: r.hidden,
    source: r.source,
    syncedAt: r.syncedAt.toISOString(),
  }))
}
