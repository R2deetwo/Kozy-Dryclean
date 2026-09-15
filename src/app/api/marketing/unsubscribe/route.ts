// =============================================================================
// GET /api/marketing/unsubscribe?token=<signed token>
// =============================================================================
// One-click, login-free unsubscribe. The HMAC-signed token carries the email
// (src/lib/marketing.ts signUnsubscribeToken). Clears BOTH opt-in flags for
// the address (User.marketingOptIn + NewsletterSubscriber.optIn) —
// transactional emails (booking confirmations, payment verification,
// password resets) are never affected. Returns a small branded HTML
// confirmation page so the customer lands on something meaningful instead
// of raw JSON.

import { NextRequest, NextResponse } from 'next/server'
import { verifyUnsubscribeToken, applyUnsubscribe } from '@/lib/marketing'

function resultPage(ok: boolean, email: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || ''
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Kozy Care — ${ok ? 'Unsubscribed' : 'Link problem'}</title>
</head>
<body style="font-family: Georgia, serif; background: #F8F9FA; margin: 0; padding: 40px 16px;">
  <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(10,25,47,0.08);">
    <div style="background: linear-gradient(135deg, #0A192F, #102740); padding: 28px 36px; text-align: center;">
      <h1 style="color: #D4AF37; font-family: Georgia, serif; font-size: 24px; font-weight: 700; margin: 0;">Kozy Care</h1>
      <p style="color: rgba(255,255,255,0.7); font-size: 10px; text-transform: uppercase; letter-spacing: 2px; margin: 4px 0 0 0;">Premium Drycleaning &amp; Laundry</p>
    </div>
    <div style="padding: 32px 36px; color: #1E2A3A;">
      ${
        ok
          ? `<h2 style="font-family: Georgia, serif; color: #0A192F; font-size: 20px; margin: 0 0 12px 0;">You're unsubscribed</h2>
      <p style="color: #6F88A8; font-size: 14px; line-height: 1.7; margin: 0 0 12px 0;">
        <strong>${email}</strong> will no longer receive marketing emails from Kozy Care — offers,
        newsletters and updates. Your orders, receipts and payment emails are unaffected.
      </p>
      <p style="color: #6F88A8; font-size: 13px; line-height: 1.6; margin: 0;">
        Changed your mind? Sign up again any time from our website footer.
      </p>`
          : `<h2 style="font-family: Georgia, serif; color: #0A192F; font-size: 20px; margin: 0 0 12px 0;">This link didn't work</h2>
      <p style="color: #6F88A8; font-size: 14px; line-height: 1.7; margin: 0;">
        The unsubscribe link is incomplete or was altered. If you keep receiving emails you
        don't want, reply to any of them and we will remove you the same day.
      </p>`
      }
      <a href="${base || '/'}" style="display: inline-block; margin-top: 20px; background: linear-gradient(135deg, #E3BE4F, #D4AF37, #B8962B); color: #0A192F; padding: 12px 28px; border-radius: 9999px; text-decoration: none; font-weight: 700; font-size: 14px;">Back to Kozy Care</a>
    </div>
  </div>
</body>
</html>`
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')

  if (!token) {
    return new NextResponse(resultPage(false, ''), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  const email = verifyUnsubscribeToken(token)
  if (!email) {
    return new NextResponse(resultPage(false, ''), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  const changed = await applyUnsubscribe(email)
  return new NextResponse(resultPage(true, email), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
