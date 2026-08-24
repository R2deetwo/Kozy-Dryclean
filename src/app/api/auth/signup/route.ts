// =============================================================================
// POST /api/auth/signup — create a new user account + send verification email
// =============================================================================
// Flow:
//   1. Validate email + password + name + phone
//   2. Check email isn't already registered
//   3. Hash password with bcrypt
//   4. Create user (emailVerified = null)
//   5. Generate verification token (random 32-char hex)
//   6. Send verification email via Brevo
//   7. Return success (user is NOT logged in yet — must verify email first)
// =============================================================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { sendVerificationEmail } from '@/lib/email'

export async function POST(req: Request) {
  const body = await req.json()
  const { email, password, name, phone, role } = body

  // ----- Validate -----
  if (!email || !password || !name || !phone) {
    return NextResponse.json(
      { error: 'Email, password, name, and phone are all required' },
      { status: 400 }
    )
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: 'Password must be at least 8 characters' },
      { status: 400 }
    )
  }

  // ----- Check for existing user -----
  const existing = await db.user.findUnique({
    where: { email: email.toLowerCase() },
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
      email: email.toLowerCase(),
      name,
      phone,
      role: role || 'B2C',
      passwordHash,
      emailVerified: null,
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

  // ----- Send verification email -----
  try {
    await sendVerificationEmail(user.email, user.name, token)
  } catch (e) {
    console.error('Failed to send verification email:', e)
    // Don't fail the signup — user can request a new verification email
  }

  return NextResponse.json(
    { ok: true, message: 'Account created. Check your email for a verification link.' },
    { status: 201 }
  )
}
