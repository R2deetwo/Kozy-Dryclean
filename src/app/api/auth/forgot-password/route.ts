// =============================================================================
// POST /api/auth/forgot-password — send password reset email
// =============================================================================

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import crypto from 'crypto'
import { sendEmail } from '@/lib/email'
import { rateLimit, getClientIP } from '@/lib/rate-limit'
import { isValidEmail, EMAIL_HELP } from '@/lib/email-validation'

export async function POST(req: Request) {
  const ip = getClientIP(req)
  const limit = await rateLimit(`forgot:${ip}`, { max: 3, windowMs: 60 * 60 * 1000 })
  if (!limit.success) {
    return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 })
  }

  const { email } = await req.json()
  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  // Reject mistyped addresses up front (same strict shape check as signup —
  // "name@gmail" would otherwise hide behind the vague success message).
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'INVALID_EMAIL', message: EMAIL_HELP }, { status: 400 })
  }

  const user = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } })
  if (!user) {
    // Don't reveal whether email exists
    return NextResponse.json({ ok: true, message: 'If an account exists, a reset link has been sent.' })
  }

  // Generate reset token (valid for 1 hour)
  const token = crypto.randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + 60 * 60 * 1000)

  // Delete existing tokens for this user
  await db.verificationToken.deleteMany({ where: { userId: user.id } })

  // Create new token
  await db.verificationToken.create({
    data: { token, userId: user.id, expires },
  })

  // Send reset email
  const baseUrl = process.env.NEXTAUTH_URL || 'https://kozycare.ng'
  const resetUrl = `${baseUrl}/reset-password?token=${token}`

  try {
    await sendEmail({
      to: user.email,
      subject: 'Reset your Kozy Care password',
      html: `
        <!DOCTYPE html><html><body style="font-family: Georgia, serif; background: #F8F9FA; padding: 40px 0; margin: 0;">
          <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(10,25,47,0.08);">
            <div style="background: linear-gradient(135deg, #0A192F, #102740); padding: 32px 40px; text-align: center;">
              <h1 style="color: #D4AF37; font-family: Georgia, serif; font-size: 28px; font-weight: 700; margin: 0;">Kozy Care</h1>
              <p style="color: rgba(255,255,255,0.7); font-size: 11px; text-transform: uppercase; letter-spacing: 2px; margin: 4px 0 0 0;">Drycleaning &amp; Laundry</p>
            </div>
            <div style="padding: 40px;">
              <h2 style="color: #0A192F; font-family: Georgia, serif; font-size: 22px; margin: 0 0 16px 0;">Reset your password</h2>
              <p style="color: #6F88A8; line-height: 1.6; font-size: 15px; margin: 0 0 24px 0;">
                Click the button below to set a new password for your Kozy Care account. This link expires in 1 hour.
              </p>
              <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #E3BE4F, #D4AF37, #B8962B); color: #0A192F; padding: 14px 32px; border-radius: 9999px; text-decoration: none; font-weight: 700; font-size: 15px;">
                Reset password
              </a>
              <p style="color: #6F88A8; font-size: 12px; margin: 24px 0 0 0;">
                If you didn't request this, you can safely ignore this email.
              </p>
            </div>
          </div>
        </body></html>
      `,
    })
  } catch (e) {
    console.error('Failed to send reset email:', e)
  }

  return NextResponse.json({ ok: true, message: 'If an account exists, a reset link has been sent.' })
}
