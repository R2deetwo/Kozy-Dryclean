// =============================================================================
// Server-side password generation (phase 32)
// =============================================================================
// The client brief changed from "the owner sets the staff password" to "the
// system generates it and emails it — the owner never touches credentials."
// This module is the single source of truth for what a system-generated
// password looks like: strong, typeable, and guaranteed to pass the same
// strength rules the schemas enforce (min 10 chars, 2+ character classes).
//
// Used by:
//   - POST /api/staff        (invite: generates + emails, never returned)
//   - PATCH /api/staff/[id]  (resetPassword: same flow)
//
// There is deliberately NO API that returns a generated password to the
// caller — the password only ever travels to the staff member's inbox.

import crypto from 'crypto'

const LOWER = 'abcdefghijkmnopqrstuvwxyz' // no look-alikes l
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ' // no I, O
const DIGITS = '23456789' // no 0, 1
const SYMBOLS = '!@#$%^&*?'
const ALL = LOWER + UPPER + DIGITS + SYMBOLS

/** Guaranteed class coverage, then random fill from the full alphabet.
 *  16 characters ≈ 90+ bits of entropy — comfortably above the 10-char
 *  minimum and unguessable in practice. */
export function generatePassword(): string {
  const pick = (set: string) => set[crypto.randomInt(set.length)]
  // One from each class first…
  const required = [pick(LOWER), pick(UPPER), pick(DIGITS), pick(SYMBOLS)]
  // …then random fill to 16 total.
  while (required.length < 16) required.push(pick(ALL))
  // Fisher–Yates with crypto randomness so the guaranteed classes aren't
  // always in the first four positions.
  for (let i = required.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1)
    ;[required[i], required[j]] = [required[j], required[i]]
  }
  return required.join('')
}
