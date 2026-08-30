// =============================================================================
// POST /api/auth/signup — create a new user account + send verification email
// =============================================================================
// Flow:
//   1. Validate email + password + name + phone
//      (strict email-shape check — a mistyped address like "name@gmail"
//      used to pass and the verification email then never arrived, leaving
//      the customer on a dead-end "we could not send the verification email"
//      screen)
//   2. Check email isn't already registered
//   3. Hash password with bcrypt
//   4. Create user (emailVerified = null)
//   5. Generate verification token (random 32-char hex)
//   6. Send verification email via Brevo (after the response — Brevo latency
//      must not slow the signup)
//   7. Alert the business owner's inbox that a new customer signed up
//   8. Return success (user is NOT logged in yet — must verify email first)
// =============================================================================

import { NextResponse, after } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { sendVerificationEmail } from '@/lib/email'
import { rateLimit, getClientIP } from '@/lib/rate-limit'
import { isValidEmail, normalizeEmail, EMAIL_HELP } from '@/lib/email-validation'
import { notifyAdminNewCustomer } from '@/lib/notifications'

export async function POST(req: Request) {
  // ----- Rate limit: 5 signups per hour per IP -----
  const ip = getClientIP(req)
  const limit = await rateLimit(`signup:${ip}`, { max: 5, windowMs: 60 * 60 * 1000 })
  if (!limit.success) {
    return NextResponse.json(
      { error: 'Too many signup attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((limit.resetAt - Date.now()) / 1000)) } }
    )
  }

  const body = await req.json()
  const { email, password, name, phone, role } = body

  // ----- Validate -----
  if (!email || !password || !name || !phone) {
    return NextResponse.json(
      { error: 'Email, password, name, and phone are all required' },
      { status: 400 }
    )
  }

  // ----- Strict email shape (client-reported bug) -----
  // "name@gmail" passes the browser's type="email" check but no mail provider
  // will deliver to it. Reject it here with a plain-language message so the
  // customer can fix the typo instead of ending up with an unusable account.
  if (!isValidEmail(email)) {
    return NextResponse.json(
      { error: 'INVALID_EMAIL', message: EMAIL_HELP },
      { status: 400 }
    )
  }
  const normalized = normalizeEmail(email)

  if (password.length < 8) {
    return NextResponse.json(
      { error: 'Password must be at least 8 characters' },
      { status: 400 }
    )
  }

  // ----- Check for existing user -----
  const existing = await db.user.findUnique({
    where: { email: normalized },
  })
  if (existing) {
    return NextResponse.json(
      { error: 'An account with this email already exists. Try logging in.' },
      { status: 409 }
    )
  }

  // ----- Create user -----
  const passwordHash = await bcrypt.hash(password, 10)
  const user = await db.user.create({
    data: {
      email: normalized,
      name,
      phone,
      role: role || 'B2C',
      passwordHash,
      emailVerified: null,
      signupDiscountUsed: false, // eligible for signup discount
    },
  })

  // ----- Generate verification token -----
  const token = crypto.randomBytes(32).toString('hex')
  await db.verificationToken.create({
    data: {
      token,
      userId: user.id,
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    },
  })

  // ----- Send verification email + admin alert (after the response) -----
  // Brevo can take seconds, which must not slow the signup. With the strict
  // email-shape check above, delivery failures are now rare; if one still
  // happens, the success screen offers "fix my email and resend" — powered
  // by POST /api/auth/update-unverified-email.
  after(async () => {
    try {
      await sendVerificationEmail(user.email, user.name, token)
    } catch (e: any) {
      console.error('Failed to send verification email:', e)
    }

    // Alert the business owner's inbox (kozygarmentcare@gmail.com by default)
    await notifyAdminNewCustomer({
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      company: (user as any).company ?? null,
    })
  })

  const response: any = {
    ok: true,
    message:
      'Account created. Check your email for a verification link — if it doesn’t arrive within a few minutes, correct your email below and we’ll resend.',
  }

  return NextResponse.json(response, { status: 201 })
}
