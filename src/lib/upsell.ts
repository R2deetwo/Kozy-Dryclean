// =============================================================================
// The checkout-to-membership conversion engine (Task 86, owner directive)
// =============================================================================
// GOAL: convert one-off customers into Kozy Circle members.
//
// 1. AT CHECKOUT (every applicable one): on the review step, before payment,
//    a basket totalling ₦15,000+ is pitched the tier its spend maps to —
//      ₦15,000–29,999 → The Essentials  (₦30,000/mo, 1 person)
//      ₦30,000–49,999 → The Household   (₦50,000/mo, 3 people)
//      ₦50,000+       → The Whole Home  (₦80,000/mo, 5 people)
//    The pitch is the owner's own offer: THIS basket — exactly as mixed as
//    it is — becomes the member's FIRST Kozy Bag, free. No scrutinising
//    whether it "ought" to hold 7-of-everything; the first bag is honoured
//    as-is and rides as the first weekly pickup of the plan.
//
// 2. BY EMAIL (monthly): customers whose trailing 60-day spend lands in a
//    band get the same pitch by email, deep-linking to the plan's join
//    dialog. Non-joiners get it every month while their spend stays in a
//    band (sweep Job 4 — see member-emails.ts).
//
// This module is CLIENT-SAFE (no server imports): the wizard, the JoinDialog
// and the email sweep's copy all share the same bands and the same promise,
// so the offer can never drift between surfaces. Plan NAMES/PRICES shown to
// the customer come from the live plan rows, not from here — this module
// only carries the band → planCode mapping and the copy shapes.
// =============================================================================

/** Where the pitch starts. Below this, a one-off checkout stays a checkout. */
export const UPSELL_MIN_TOTAL = 15_000

/** The owner's spend bands → the tier each one is pitched. */
export const UPSELL_BANDS: ReadonlyArray<{
  min: number
  max: number | null // null = no ceiling
  planCode: 'ESSENTIALS' | 'HOUSEHOLD' | 'WHOLEHOME'
}> = [
  { min: 15_000, max: 29_999.99, planCode: 'ESSENTIALS' },
  { min: 30_000, max: 49_999.99, planCode: 'HOUSEHOLD' },
  { min: 50_000, max: null, planCode: 'WHOLEHOME' },
]

/** Which tier a checkout total (or a trailing spend figure) should be
 *  pitched. Null = too small to pitch (stay quiet, keep the checkout). */
export function upsellPlanForTotal(total: number): string | null {
  if (!Number.isFinite(total) || total < UPSELL_MIN_TOTAL) return null
  for (const band of UPSELL_BANDS) {
    if (band.max === null || total <= band.max) return band.planCode
  }
  return null
}

// Client-safe import of the shared enum (types-only — no server code rides
// along with this module).
import type { ServiceSpeed } from '@/lib/types'

// -----------------------------------------------------------------------------
// The first-bag marker (localStorage) — carries the claim from the checkout
// card to the JoinDialog across the signup → verify → login detour, exactly
// like the booking draft carries the basket itself.
// -----------------------------------------------------------------------------

const FIRSTBAG_KEY = 'kozy.firstbag.v1'
const FIRSTBAG_TTL_MS = 7 * 24 * 60 * 60 * 1000 // matches the draft's 7 days

export interface FirstBagMarker {
  savedAt: number
  planCode: string
  /** The basket as the wizard built it (mirrors the booking draft's shape,
   *  so the server can validate both the same way). */
  items: Record<string, number>
  pickupAddress: string
  pickupDate: string
  pickupSlot: string
  deliveryAddress: string
  modeOfWash?: 'MACHINE' | 'HANDWASH' | 'IRON_ONLY'
  serviceSpeed?: ServiceSpeed
  alterationNotes?: string
  /** The one-off estimate they were shown — informational, never charged. */
  estimatedTotal: number
}

export function saveFirstBagMarker(m: Omit<FirstBagMarker, 'savedAt'>): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      FIRSTBAG_KEY,
      JSON.stringify({ ...m, savedAt: Date.now() } satisfies FirstBagMarker)
    )
  } catch {
    /* quota/private mode — the join flow still works without the pitch */
  }
}

export function loadFirstBagMarker(): FirstBagMarker | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(FIRSTBAG_KEY)
    if (!raw) return null
    const m = JSON.parse(raw)
    if (!m || typeof m.savedAt !== 'number') return null
    if (Date.now() - m.savedAt > FIRSTBAG_TTL_MS) return null
    if (!m.items || typeof m.items !== 'object' || Array.isArray(m.items)) return null
    return m as FirstBagMarker
  } catch {
    return null
  }
}

export function clearFirstBagMarker(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(FIRSTBAG_KEY)
  } catch {
    /* ignore */
  }
}

