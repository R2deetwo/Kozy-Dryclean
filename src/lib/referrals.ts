// =============================================================================
// Referrals & service milestones (phase 52)
// =============================================================================
// The owner's brief: after ~10 completed orders a customer has reached "a
// certain level of service" — they deserve a genuine thank-you, a broader
// feedback ask (about the RELATIONSHIP, not one order), and — silently —
// the ability to refer friends. Premium positioning, deliberately
// anti-scummy:
//
//   - Nothing on the public site advertises the referral program. No
//     banners, no "invite & earn" badges, no locked-feature teasers. A
//     customer below the milestone sees NOTHING.
//   - The personal code is minted AT the milestone and revealed in exactly
//     three places: the milestone email, the private /milestone page, and a
//     quiet card in their portal.
//   - Mechanics are gratitude-shaped, not commission-shaped: the friend
//     gets a first-order courtesy; the referrer gets a modest thank-you
//     credit that lands only once the friend's order is DELIVERED — no
//     points, no tiers, no countdowns.
//   - The milestone feedback ask is private (admin inbox only) — it never
//     auto-publishes to the testimonial wall.
//
// All money values are admin-tunable AppSettings (referral_friend_discount_percent,
// referral_reward_amount). The marketing psychology behind the timing is
// intentionally NOT surfaced anywhere in customer-facing copy.
// =============================================================================

import crypto from 'crypto'
import { db } from '@/lib/db'
import { getAppSettings } from '@/lib/app-settings'
import { MILESTONE_ORDERS } from '@/lib/types'
import {
  notifyMilestoneReached,
  notifyReferralRewardGranted,
  notifyAdminReferralRedeemed,
} from '@/lib/notifications'

// -----------------------------------------------------------------------------
// Milestone tokens — HMAC-signed, login-free capability links
// -----------------------------------------------------------------------------
// Same pattern as the marketing unsubscribe token: the /milestone link in
// the appreciation email must work without a session (the customer may read
// it on any device), but must not be forgeable. Payload { u: userId }.
const TOKEN_SECRET =
  process.env.NEXTAUTH_SECRET || process.env.MARKETING_SECRET || 'kozy-dev-secret'

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url')
}

export function signMilestoneToken(userId: string): string {
  const payload = b64url(JSON.stringify({ u: userId }))
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

export function verifyMilestoneToken(token: string): string | null {
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return null
  const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString())
    return typeof parsed.u === 'string' ? parsed.u : null
  } catch {
    return null
  }
}

// -----------------------------------------------------------------------------
// Referral codes
// -----------------------------------------------------------------------------

/** Normalize a typed code: uppercase, collapse whitespace. */
export function normalizeReferralCode(input: string): string {
  return input.toUpperCase().trim().replace(/\s+/g, '')
}

/** Mint the customer's personal code: FIRSTNAME-### (readable, personal,
 *  not guessable at scale). Idempotent — returns the existing row if the
 *  customer already has one. Retries on the (unlikely) collision. */
export async function ensureReferralCode(user: { id: string; name: string }) {
  const existing = await db.referralCode.findUnique({ where: { userId: user.id } })
  if (existing) return existing

  const base =
    (user.name.split(' ')[0] || '')
      .replace(/[^A-Za-z]/g, '')
      .toUpperCase()
      .slice(0, 8) || 'KOZY'

  for (let attempt = 0; attempt < 8; attempt++) {
    const code = `${base}-${Math.floor(100 + Math.random() * 900)}`
    try {
      return await db.referralCode.create({ data: { userId: user.id, code } })
    } catch {
      // Unique collision (or concurrent mint) — retry with a new suffix.
      // On the final attempt, fall through to the re-read below.
    }
  }
  // Concurrent mint won the race — return whichever row exists now.
  return db.referralCode.findUniqueOrThrow({ where: { userId: user.id } })
}

/** Shared eligibility check for a referral code at checkout — used by BOTH
 *  POST /api/orders (authoritative) and POST /api/marketing/coupons/validate
 *  (live preview) so the two can never disagree (the phase-36 rule).
 *
 *  Rules: the code must exist, belong to someone ELSE (no self-referral),
 *  and this must be the customer's FIRST order (the courtesy replaces the
 *  standard first-order discount, exactly like the hotel offer code). */
export async function checkReferralEligibility(
  code: string,
  opts: { userId?: string | null; isFirstOrder: boolean }
): Promise<
  | { ok: false; reason: 'NOT_FOUND' | 'SELF' | 'NOT_FIRST_ORDER'; message: string }
  | {
      ok: true
      codeId: string
      code: string
      referrerId: string
      referrerName: string
      discountPercent: number
      previewAmount: (serviceTotal: number) => number
    }
> {
  const row = await db.referralCode.findUnique({
    where: { code: normalizeReferralCode(code) },
    include: { user: { select: { id: true, name: true } } },
  })
  if (!row) {
    return {
      ok: false,
      reason: 'NOT_FOUND',
      message: 'We do not recognise that code.',
    }
  }
  if (opts.userId && row.userId === opts.userId) {
    return {
      ok: false,
      reason: 'SELF',
      message: 'That is your own code — it is for a friend booking their first order.',
    }
  }
  if (!opts.isFirstOrder) {
    return {
      ok: false,
      reason: 'NOT_FIRST_ORDER',
      message: 'Referral codes apply to a first order only.',
    }
  }
  const settings = await getAppSettings()
  const discountPercent = Math.max(0, Math.min(settings.referralFriendDiscountPercent, 50))
  return {
    ok: true,
    codeId: row.id,
    code: row.code,
    referrerId: row.userId,
    referrerName: row.user.name,
    discountPercent,
    previewAmount: (serviceTotal: number) =>
      Math.round(serviceTotal * (discountPercent / 100)),
  }
}

// -----------------------------------------------------------------------------
// Delivery hook — milestone + referral reward, fired when an order is
// first marked DELIVERED (PATCH /api/orders/[id])
// -----------------------------------------------------------------------------
// Everything here runs inside after(): a slow email or a settings hiccup
// must never break the admin's status update. Once-only guarantees use
// conditional updateMany (compare-and-set) instead of read-then-write, so
// two orders delivered in the same second cannot double-fire either event.
export async function processDeliveryMilestones(orderId: string): Promise<void> {
  try {
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { id: true, name: true, email: true, lastMilestoneSent: true } },
        referralRedemption: {
          include: { code: { include: { user: { select: { id: true, name: true, email: true } } } } },
        },
      },
    })
    if (!order) return

    // ----- 1) Referral thank-you credit (this order WAS a referred first
    // order and the reward has not been granted yet) -----
    const redemption = order.referralRedemption
    if (redemption && !redemption.rewardGrantedAt) {
      const settings = await getAppSettings()
      const reward = Math.max(0, Math.round(settings.referralRewardAmount))
      const referrer = redemption.code.user
      // Compare-and-set: only ONE caller ever sees count=1.
      const claimed = await db.referralRedemption.updateMany({
        where: { id: redemption.id, rewardGrantedAt: null },
        data: { rewardGrantedAt: new Date() },
      })
      if (claimed.count === 1 && reward > 0) {
        await db.user.update({
          where: { id: referrer.id },
          data: { referralCredit: { increment: reward } },
        })
        await notifyReferralRewardGranted({
          to: referrer.email,
          referrerName: referrer.name,
          friendName: order.user.name,
          amount: reward,
        })
      }
    }

    // ----- 2) Service milestone (10 delivered orders → appreciation email,
    // general feedback ask + personal referral code) -----
    const deliveredCount = await db.order.count({
      where: { userId: order.userId, status: 'DELIVERED' },
    })
    if (deliveredCount >= MILESTONE_ORDERS && order.user.lastMilestoneSent < 1) {
      // Compare-and-set again: the winner sends the email exactly once.
      const claimed = await db.user.updateMany({
        where: { id: order.userId, lastMilestoneSent: 0 },
        data: { lastMilestoneSent: 1 },
      })
      if (claimed.count === 1) {
        const code = await ensureReferralCode({ id: order.userId, name: order.user.name })
        const settings = await getAppSettings()
        await notifyMilestoneReached({
          to: order.user.email,
          name: order.user.name,
          deliveredCount,
          code: code.code,
          friendDiscountPercent: Math.max(0, Math.min(settings.referralFriendDiscountPercent, 50)),
          rewardAmount: Math.max(0, Math.round(settings.referralRewardAmount)),
          token: signMilestoneToken(order.userId),
        })
      }
    }
  } catch (e) {
    console.error('processDeliveryMilestones failed:', e)
  }
}

// -----------------------------------------------------------------------------
// Redemption bookkeeping — called after a referred order is created
// -----------------------------------------------------------------------------
export async function recordReferralRedemption(opts: {
  codeId: string
  orderId: string
  friendEmail: string
  friendName: string
  friendDiscountAmount: number
  orderNumber: string
}): Promise<void> {
  try {
    await db.referralRedemption.create({
      data: {
        codeId: opts.codeId,
        orderId: opts.orderId,
        friendEmail: opts.friendEmail.toLowerCase(),
        friendName: opts.friendName,
        friendDiscountAmount: opts.friendDiscountAmount,
      },
    })
    // The owner sees every referral working — one quiet operations alert,
    // exactly like the other admin notifications.
    const row = await db.referralRedemption.findUnique({
      where: { orderId: opts.orderId },
      include: { code: { include: { user: { select: { name: true, email: true } } } } },
    })
    if (row) {
      await notifyAdminReferralRedeemed({
        code: row.code.code,
        referrerName: row.code.user.name,
        referrerEmail: row.code.user.email,
        friendName: opts.friendName,
        friendEmail: opts.friendEmail,
        orderNumber: opts.orderNumber,
        friendDiscountAmount: opts.friendDiscountAmount,
      })
    }
  } catch (e) {
    console.error('recordReferralRedemption failed (order still placed):', e)
  }
}
