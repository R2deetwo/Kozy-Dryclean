// =============================================================================
// POST /api/auth/resend-verification — resend the verification email
// =============================================================================
// For users who signed up but didn't receive or lost the verification email.
// =============================================================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import crypto from 'crypto'
import { sendVerificationEmail } from '@/lib/email'
import { rateLimit, getClientIP } from '@/lib/rate-limit'

export async function POST(req: Request) {
  // Rate limit: 3 resends per hour per IP
  const ip = getClientIP(req)
  const limit = rateLimit(`resend:${ip}`, { max: 3, windowMs: 60 * 60 * 1000 })
  if (!limit.success) {
    return NextResponse.json(
      { error: 'Too many resend attempts. Please try again later.' },
      { status: 429 }
    )
  }

  const { email } = await req.json()

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  const user = await db.user.findUnique({
    where: { email: email.toLowerCase() },
  })

  if (!user) {
    // Don't reveal whether the email exists — return success
    return NextResponse.json({
      ok: true,
      message: 'If an account exists for that email, a new verification link has been sent.',
    })
  }

  // Already verified?
  if (user.emailVerified) {
    return NextResponse.json({
      ok: true,
      message: 'Your email is already verified. You can log in.',
    })
  }

  // Delete any existing tokens for this user
  await db.verificationToken.deleteMany({
    where: { userId: user.id },
  })

  // Generate new token
  const token = crypto.randomBytes(32).toString('hex')
  await db.verificationToken.create({
    data: {
      token,
      userId: user.id,
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  })

  // Send email
  try {
    await sendVerificationEmail(user.email, user.name, token)
    return NextResponse.json({
      ok: true,
      message: 'A new verification link has been sent to your email.',
    })
  } catch (e: any) {
    return NextResponse.json({
      ok: false,
      error: 'Failed to send email. Please try again or contact support.',
    }, { status: 500 })
  }
}
