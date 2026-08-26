// =============================================================================
// Brevo email service — sends transactional emails via Brevo API
// =============================================================================
// Used for: email verification on signup, order notifications (Phase 5)
// =============================================================================

interface SendEmailParams {
  to: string
  subject: string
  html: string
}

export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY
  // Sender must be a Brevo-VERIFIED email or Brevo silently rejects the send.
  // concierge@kozy.ng is NOT verified in Brevo yet, so we use the verified
  // personal address until it is. Once verified in the Brevo dashboard:
  //   1. Set BREVO_VERIFIED_SENDER_EMAIL=concierge@kozy.ng on Vercel
  //   2. Remove this fallback
  const senderEmail =
    process.env.BREVO_VERIFIED_SENDER_EMAIL || 'chigozieubahesq@gmail.com'
  const senderName = process.env.BREVO_SENDER_NAME || 'Kozy Care'

  if (!apiKey) {
    console.warn('BREVO_API_KEY not set — skipping email send')
    return
  }

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'content-type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('Brevo send failed:', err)
    throw new Error(`Failed to send email: ${res.status}`)
  }
}

export async function sendVerificationEmail(email: string, name: string, token: string): Promise<void> {
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const verifyUrl = `${baseUrl}/verify-email?token=${token}`

  await sendEmail({
    to: email,
    subject: 'Verify your Kozy Care account',
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Georgia, serif; background: #F8F9FA; padding: 40px 0; margin: 0;">
        <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(10,25,47,0.08);">
          <div style="background: linear-gradient(135deg, #0A192F, #102740); padding: 32px 40px; text-align: center;">
            <h1 style="color: #D4AF37; font-family: Georgia, serif; font-size: 28px; font-weight: 700; margin: 0;">Kozy Care</h1>
            <p style="color: rgba(255,255,255,0.7); font-size: 11px; text-transform: uppercase; letter-spacing: 2px; margin: 4px 0 0 0;">Drycleaning &amp; Laundry</p>
          </div>
          <div style="padding: 40px;">
            <h2 style="color: #0A192F; font-family: Georgia, serif; font-size: 22px; margin: 0 0 16px 0;">Welcome to Kozy Care, ${name}!</h2>
            <p style="color: #6F88A8; line-height: 1.6; font-size: 15px; margin: 0 0 24px 0;">
              Please verify your email address to activate your account and start booking pickups.
            </p>
            <a href="${verifyUrl}" style="display: inline-block; background: linear-gradient(135deg, #E3BE4F, #D4AF37, #B8962B); color: #0A192F; padding: 14px 32px; border-radius: 9999px; text-decoration: none; font-weight: 700; font-size: 15px; box-shadow: 0 4px 14px rgba(212,175,55,0.35);">
              Verify my email
            </a>
            <p style="color: #6F88A8; font-size: 12px; margin: 24px 0 0 0; line-height: 1.5;">
              Or paste this link into your browser:<br>
              <span style="color: #0A192F; word-break: break-all;">${verifyUrl}</span>
            </p>
            <p style="color: #6F88A8; font-size: 11px; margin: 32px 0 0 0; border-top: 1px solid #E2E5E9; padding-top: 16px;">
              If you didn&apos;t create a Kozy Care account, you can safely ignore this email.
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
  })
}
