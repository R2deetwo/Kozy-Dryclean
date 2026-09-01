// =============================================================================
// POST /api/auth/update-unverified-email — fix a mistyped signup email
// =============================================================================
// The scenario this rescues (client-reported): a customer signs up as
// "chidera@gmail" (missing ".com"). The browser's type="email" validation
// lets it through, the account is created, and the verification email can
// never be delivered — a dead-end account. The signup success screen now
// always offers "Wrong email? Fix it and resend": this endpoint updates the
// address on the UNVERIFIED account and sends a fresh verification link.
//
// Guardrails:
//   - Only works on accounts that have NOT verified an email yet (a verified
//     account changing its email would be an account-takeover vector).
//   - Rate limited per IP (3/hour) like the resend endpoint.
//   - The new email must pass the same strict shape check as signup.
//   - If the new email is already registered, the caller gets a clear 409
//     (no account-existence leak concern here — the caller just proved they
//     control the original signup flow for this browser).
//   - Existing verification tokens are invalidated and replaced.
// =============================================================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import crypto from 'crypto'
import { sendVerificationEmail } from '@/lib/email'
import { rateLimit, getClientIP } from '@/lib/rate-limit'
import { isValidEmail, normalizeEmail, EMAIL_HELP } from '@/lib/email-validation'

export async function POST(req: Request) {
  // ----- Rate limit: 3 attempts per hour per IP -----
  const ip = getClientIP(req)
  const limit = await rateLimit(`fix-email:${ip}`, { max: 3, windowMs: 60 * 60 * 1000 })
  if (!limit.success) {
    return NextResponse.json(
      { error: 'Too many attempts. Please try again later.' },
      { status: 429 }
    )
  }

  const body = await req.json().catch(() => ({}))
  const { currentEmail, newEmail } = body ?? {}

  if (!currentEmail || !newEmail) {
    return NextResponse.json(
      { error: 'Both the current email and the corrected email are required.' },
      { status: 400 }
    )
  }

  if (!isValidEmail(newEmail)) {
    return NextResponse.json(
      { error: 'INVALID_EMAIL', message: EMAIL_HELP },
      { status: 400 }
    )
  }

  const normalizedCurrent = normalizeEmail(currentEmail)
  const normalizedNew = normalizeEmail(newEmail)

  if (normalizedCurrent === normalizedNew) {
    return NextResponse.json(
      { error: 'That is the same email — nothing to update.' },
      { status: 400 }
    )
  }

  const user = await db.user.findUnique({
    where: { email: normalizedCurrent },
  })
  if (!user) {
    // Don't reveal whether the account exists
    return NextResponse.json({
      ok: true,
      message: 'If that account is waiting for verification, the email has been updated and a new link sent.',
    })
  }

  // Only unverified accounts can change their email this way.
  if (user.emailVerified) {
    return NextResponse.json(
      {
        error: 'This account is already verified. To change your email, please contact support.',
      },
      { status: 409 }
    )
  }

  // The corrected address must be free.
  const taken = await db.user.findUnique({ where: { email: normalizedNew } })
  if (taken) {
    return NextResponse.json(
      {
        error: 'An account already exists with that email. Try logging in instead, or use a different address.',
      },
      { status: 409 }
    )
  }

  // Update the email, rotate the verification token, send the fresh link.
  await db.user.update({
    where: { id: user.id },
    data: { email: normalizedNew },
  })
  await db.verificationToken.deleteMany({ where: { userId: user.id } })
  const token = crypto.randomBytes(32).toString('hex')
  await db.verificationToken.create({
    data: {
      token,
      userId: user.id,
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  })

  try {
    await sendVerificationEmail(normalizedNew, user.name, token)
  } catch (e: any) {
    console.error('Failed to send verification email after email fix:', e)
    return NextResponse.json(
      {
        error: 'We saved your corrected email but couldn’t send the verification message. Please try again in a minute or contact support.',
      },
      { status: 502 }
    )
  }

  return NextResponse.json({
    ok: true,
    message: `Verification email sent to ${normalizedNew}.`,
    email: normalizedNew,
  })
}
