// =============================================================================
// Loyalty — "after 10 washes, the 11th is free" (phase 53)
// =============================================================================
// The owner's brief: a customer who completes ten paid services gets their
// next one free. The offline version of this is settled by hand (the owner
// keeps his own paper trail with regulars) — the online platform simply
// mirrors the promise, quietly:
//
//   - Counting: a "wash" is one DELIVERED order. The earned complimentary
//     order itself, once delivered, does NOT punch the next card — only
//     paid services count toward the next ten.
//   - Visibility (owner's explicit rule): NOTHING is shown to a customer
//     with fewer than 5 completed paid washes. From the 5th paid wash the
//     portal shows a quiet countdown ("5 of 10", "6 of 10"…) so the
//     customer can look forward to it. At ten paid washes the countdown
//     becomes "your next service is on the house" and stays until used.
//   - Redemption: automatic and silent. The customer's next retail order
//     after earning is priced at zero (loyaltyFree on the order) — nothing
//     to type, nothing to remember, no code. KG/bulk orders are priced at
//     the station, so the earned service simply waits for their next
//     retail basket.
//   - Tone: premium and understated. No "points", no "rewards program"
//     branding, no countdown timers. The offline paper offer is never
//     referenced online.
//
// The card arithmetic (paid = delivered & not complimentary, free =
// delivered & complimentary):
//
//   earned  = floor(paid / 10)          how many free services are earned
//   pending = earned - free             free services earned but not yet used
//   punches = paid % 10                 progress on the CURRENT card
//
//   pending > 0        -> "your next service is on the house"
//   punches in [5..9]  -> countdown "punches/10" (owner's reveal-at-5 rule)
//   anything else      -> render nothing at all
// =============================================================================

import { db } from '@/lib/db'

/** Paid services required to earn the complimentary one. */
export const LOYALTY_TARGET = 10
/** The countdown first becomes visible at this many paid washes. */
export const LOYALTY_REVEAL_AT = 5

export interface LoyaltyState {
  /** Delivered orders that were NOT complimentary — the punches that count. */
  paidWashes: number
  /** Delivered orders that WERE the complimentary service. */
  freeWashes: number
  /** Progress on the current card: paidWashes % 10 (0..9). */
  punches: number
  /** Complimentary services earned so far (floor(paidWashes / 10)). */
  earned: number
  /** Complimentary services earned but not yet used (>0 → next is free). */
  pending: number
  /** Whether any loyalty UI should render at all (owner's reveal-at-5 rule). */
  visible: boolean
  /** True when the customer's next service is the complimentary one. */
  unlocked: boolean
}

/** Compute a customer's loyalty state from their delivered orders. */
export async function getLoyaltyState(userId: string): Promise<LoyaltyState> {
  const [paidWashes, freeWashes] = await Promise.all([
    db.order.count({
      where: { userId, status: 'DELIVERED', loyaltyFree: false },
    }),
    db.order.count({
      where: { userId, status: 'DELIVERED', loyaltyFree: true },
    }),
  ])
  const earned = Math.floor(paidWashes / LOYALTY_TARGET)
  const pending = Math.max(0, earned - freeWashes)
  const punches = paidWashes % LOYALTY_TARGET
  return {
    paidWashes,
    freeWashes,
    punches,
    earned,
    pending,
    unlocked: pending > 0,
    visible: pending > 0 || punches >= LOYALTY_REVEAL_AT,
  }
}
