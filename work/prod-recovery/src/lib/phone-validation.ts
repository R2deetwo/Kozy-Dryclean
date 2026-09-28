// =============================================================================
// Shared Nigerian phone validation + WhatsApp deep-link helper
// (client AND server safe — no server-only imports)
// =============================================================================
// Why this exists (owner-reported, phase 55): a rider applicant filled the
// "delivery experience" box with "it was really nice, i enjoyed it" (he was
// recalling a ride he had done for the owner, not describing past WORK), and
// free-text phone fields accepted anything. This module gives the
// rider-application form (and any future phone entry point) one strict,
// consistent definition of "looks like a reachable Nigerian mobile number":
//   +234 803 222 4455 | 0803 222 4455 | 2348032224455  →  all valid
//   0803 222 445 (too short) | +44 7… (not Nigerian)   →  rejected
// Landlines (01…) are rejected on purpose — riders are reached on mobiles.
// =============================================================================

/** Strip everything except digits (a leading + is tolerated and dropped). */
export function phoneDigits(raw: string): string {
  return (raw || '').replace(/\D+/g, '')
}

/**
 * Nigerian mobile shape, checked on the digits-only string:
 *   234 + [7-9][0-1] + 8 digits   (international form)
 *   0   + [7-9][0-1] + 8 digits   (local form)
 */
const NG_MOBILE_RE = /^(?:234|0)([789][01]\d{8})$/

/** Human-facing help text shown next to phone fields on validation failure. */
export const PHONE_HELP =
  'Enter a Nigerian mobile number, e.g. 0803 222 4455 or +234 803 222 4455 — it must have 11 digits starting 070/080/081/090/091 (or the same number with +234).'

/** Validate a phone number as a Nigerian mobile. Trims + and separators. */
export function isValidNigerianMobile(raw: string): boolean {
  return NG_MOBILE_RE.test(phoneDigits(raw))
}

/**
 * Normalise a Nigerian mobile number to the international digits-only form
 * wa.me and tel: links want: "0803 222 4455" → "2348032224455".
 * Returns null when the number does not look like a Nigerian mobile
 * (callers fall back to whatever they had).
 */
export function toInternationalDigits(raw: string): string | null {
  const m = phoneDigits(raw).match(NG_MOBILE_RE)
  return m ? `234${m[1]}` : null
}

/**
 * WhatsApp deep link (https://wa.me/<number>) — NOT an API integration, just
 * the sanctioned "open WhatsApp on this device with a chat to this customer"
 * button (owner's directive, phase 55: staff should be able to reach the
 * customer on WhatsApp straight from the order, exactly where they already
 * call or email). An optional prefilled message lets the team member start
 * from a sensible opening line instead of a blank chat.
 */
export function whatsappLink(rawPhone: string, prefilledText?: string): string {
  const intl = toInternationalDigits(rawPhone) || phoneDigits(rawPhone)
  const base = `https://wa.me/${intl}`
  return prefilledText ? `${base}?text=${encodeURIComponent(prefilledText)}` : base
}
