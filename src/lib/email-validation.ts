// =============================================================================
// Shared email validation — client AND server safe (no server-only imports)
// =============================================================================
// Why this exists (client-reported bug): a customer signed up with an email
// missing its ".com" ("name@gmail"). The browser's built-in type="email"
// validation accepts that (a@b is valid per the HTML spec), the signup API
// had no format check either, so the account was created — and the
// verification email could never be delivered ("account created but we could
// not send the verification email"). This module gives every email entry
// point one strict, consistent definition of "looks deliverable":
//   - exactly one @
//   - a domain with at least one dot (so "gmail" fails, "gmail.com" passes)
//   - a TLD of 2+ letters (so "user@mail.c" fails)
//   - sane lengths (local ≤ 64, total ≤ 254)
// It is deliberately practical, not full RFC 5322 — the goal is catching
// typos, not validating exotic addresses.
// =============================================================================

/** Strict-but-practical email pattern. Requires a dotted domain + real TLD. */
export const EMAIL_REGEX =
  /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/

/** Human-facing help text shown next to email fields on validation failure. */
export const EMAIL_HELP =
  'Please enter a complete email address, e.g. name@gmail.com — check it ends with .com, .ng or similar.'

/**
 * Validate an email address "shape". Trims whitespace first.
 * Returns true for addresses that look deliverable (dotted domain + TLD).
 */
export function isValidEmail(email: unknown): email is string {
  if (typeof email !== 'string') return false
  const trimmed = email.trim()
  if (trimmed.length === 0 || trimmed.length > 254) return false
  if (/\s/.test(trimmed)) return false
  return EMAIL_REGEX.test(trimmed)
}

/** Normalize an email for storage/lookup: trim + lowercase. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}
