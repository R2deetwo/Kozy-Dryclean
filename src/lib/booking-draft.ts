// =============================================================================
// Booking draft + post-auth redirect helpers ("continue where you left off")
// =============================================================================
// The booking wizard auto-saves the customer's in-progress selections
// (garments, addresses, current step, guest contact details) to localStorage.
// If they leave mid-flow — or are sent through sign-in / sign-up by the
// member gate on the condition-photo step — the draft is restored the next
// time the wizard opens, exactly where they stopped.
//
// Photos are intentionally EXCLUDED from the draft: condition photos are
// large data URLs that would blow past localStorage quota. The draft only
// matters for the no-photo path anyway (the gate fires when no photos were
// uploaded), so nothing of value is lost.
//
// A separate "auth redirect" note remembers where a guest should land after
// they finish signing in / signing up (e.g. back to /book with their saved
// basket). It survives the email-verification round trip because it lives in
// localStorage, not in the URL.
// =============================================================================

import type { OrderType, ServiceSpeed } from '@/lib/types'

const DRAFT_KEY = 'kozy.booking.draft.v1'
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

const AUTH_REDIRECT_KEY = 'kozy.auth.redirect.v1'
const AUTH_REDIRECT_TTL_MS = 60 * 60 * 1000 // 1 hour

export interface BookingDraft {
  /** When the draft was saved (epoch ms) */
  savedAt: number
  /** Wizard step the customer reached (1-4) */
  step: number
  type: OrderType
  /** Garment id -> quantity map */
  items: Record<string, number>
  pickupAddress: string
  pickupDate: string
  pickupSlot: string
  /** Turnaround tier (retail orders only) */
  serviceSpeed?: ServiceSpeed
  deliveryAddress: string
  paymentMethod: 'BANK_TRANSFER' | 'PAYSTACK'
  /** Guest contact details (guest checkout only) */
  guestName?: string
  guestEmail?: string
  guestPhone?: string
}

function isSafePath(p: unknown): p is string {
  return typeof p === 'string' && p.startsWith('/') && !p.startsWith('//')
}

// -----------------------------------------------------------------------------
// Draft
// -----------------------------------------------------------------------------

export function loadDraft(): BookingDraft | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const d = JSON.parse(raw)
    if (!d || typeof d.savedAt !== 'number') return null
    if (Date.now() - d.savedAt > DRAFT_TTL_MS) return null
    if (typeof d.step !== 'number' || d.step < 1 || d.step > 4) return null
    if (d.type !== 'ITEM' && d.type !== 'KG') return null
    if (!d.items || typeof d.items !== 'object' || Array.isArray(d.items)) return null
    return d as BookingDraft
  } catch {
    return null
  }
}

export function saveDraft(d: BookingDraft): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(d))
  } catch {
    // Quota exceeded / private mode — drafts are a nicety, never block booking
  }
}

export function clearDraft(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(DRAFT_KEY)
  } catch {
    /* ignore */
  }
}

// -----------------------------------------------------------------------------
// Post-auth redirect
// -----------------------------------------------------------------------------

/** Remember where the customer should land after they sign in / sign up. */
export function rememberAuthRedirect(url: string): void {
  if (typeof window === 'undefined' || !isSafePath(url)) return
  try {
    window.localStorage.setItem(
      AUTH_REDIRECT_KEY,
      JSON.stringify({ url, savedAt: Date.now() })
    )
  } catch {
    /* ignore */
  }
}

/**
 * Return and clear the stored post-auth destination, if it is still fresh.
 * Called once on successful login — the note is consumed regardless of
 * whether it is usable, so stale entries never surprise a later login.
 */
export function consumeAuthRedirect(): string | null {
  if (typeof window === 'undefined') return null
  let stored: { url?: unknown; savedAt?: unknown } | null = null
  try {
    const raw = window.localStorage.getItem(AUTH_REDIRECT_KEY)
    if (raw) {
      window.localStorage.removeItem(AUTH_REDIRECT_KEY)
      stored = JSON.parse(raw)
    }
  } catch {
    return null
  }
  if (!stored) return null
  if (typeof stored.savedAt !== 'number' || Date.now() - stored.savedAt > AUTH_REDIRECT_TTL_MS) {
    return null
  }
  return isSafePath(stored.url) ? stored.url : null
}
