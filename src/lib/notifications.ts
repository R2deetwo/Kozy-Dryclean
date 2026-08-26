// =============================================================================
// Order notifications — email (Brevo) + SMS (Termii)
// =============================================================================
// Sends booking confirmations and status-change updates to customers.
//
// Design rules:
//   - NEVER throws: a failed notification must never break an order update.
//     Every public function wraps its work in try/catch and logs failures.
//   - Env-gated: if BREVO_API_KEY / TERMII_API_KEY are not set, the channel
//     is skipped with a console warning (so the feature is safe to deploy
//     before keys are configured).
//   - SMS is reserved for the statuses a customer actually needs to act on
//     (picked up, out for delivery, delivered) to conserve Termii credits.
//     Email is sent for every status change.
// =============================================================================

import { sendEmail } from '@/lib/email'
import { formatNaira } from '@/lib/types'

type NotifiableOrder = {
  id: string
  orderNumber: string
  status: string
  type: string
  totalPrice?: number | null
  pickupAddress: string
  pickupDate: Date | string
  pickupTimeSlot: string
  deliveryAddress?: string | null
  user: {
    id?: string
    name: string
    email: string
    phone: string
  }
}

// ----- Status copy (single source of truth for customer-facing wording) -----
const STATUS_COPY: Record<string, { title: string; body: string }> = {
  REQUESTED: {
    title: 'Booking received',
    body: 'We have your pickup request and will confirm shortly.',
  },
  PAYMENT_PENDING_VERIFICATION: {
    title: 'Payment submitted for review',
    body: 'We received your transfer and are verifying it. This usually takes just a few minutes during business hours.',
  },
  PAYMENT_VERIFIED: {
    title: 'Payment confirmed',
    body: 'Your payment is confirmed. Your pickup is now scheduled.',
  },
  PICKED_UP: {
    title: 'Your garments have been picked up',
    body: 'Our rider has collected your items and they are on the way to our station.',
  },
  AT_STATION: {
    title: 'Items checked in at our station',
    body: 'Your garments have arrived at our facility and are being inspected and logged.',
  },
  PROCESSING: {
    title: 'Cleaning in progress',
    body: 'Your garments are being cleaned with premium care.',
  },
  FINISHING: {
    title: 'Finishing touches',
    body: 'We are pressing and finishing your garments to Kozy standards.',
  },
  OUT_FOR_DELIVERY: {
    title: 'Out for delivery',
    body: 'Your order is on its way back to you. Please keep your phone nearby — our rider may call on arrival.',
  },
  DELIVERED: {
    title: 'Delivered — thank you!',
    body: 'Your order has been delivered. We hope everything is exactly as it should be.',
  },
  CANCELLED: {
    title: 'Order cancelled',
    body: 'This order has been cancelled. If this is unexpected, please contact us.',
  },
}

// Statuses worth an SMS (actionable, time-sensitive)
const SMS_STATUSES = new Set(['PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED'])

function baseUrl(): string {
  return (
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://kozy-dryclean.vercel.app'
  )
}

function fmtDate(d: Date | string): string {
  const date = new Date(d)
  return date.toLocaleDateString('en-NG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

// ----- Branded email wrapper (navy/gold, consistent with verification email) -----
function brandedEmail(opts: {
  heading: string
  intro: string
  order: NotifiableOrder
  extraRows?: { label: string; value: string }[]
  cta?: { label: string; url: string }
  footer?: string
}): { subject: string; html: string } {
  const { heading, intro, order, extraRows = [], cta, footer } = opts
  const rows: { label: string; value: string }[] = [
    { label: 'Order', value: `#${order.orderNumber}` },
    { label: 'Pickup', value: `${fmtDate(order.pickupDate)} · ${order.pickupTimeSlot}` },
    { label: 'Pickup address', value: order.pickupAddress },
  ]
  if (order.totalPrice) {
    rows.push({ label: 'Total', value: formatNaira(order.totalPrice) })
  }
  rows.push(...extraRows)

  const subject = `${heading} — Order #${order.orderNumber} · Kozy Care`

  const html = `
  <!DOCTYPE html>
  <html>
  <body style="font-family: Georgia, serif; background: #F8F9FA; padding: 40px 0; margin: 0;">
    <div style="max-width: 520px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(10,25,47,0.08);">
      <div style="background: linear-gradient(135deg, #0A192F, #102740); padding: 32px 40px; text-align: center;">
        <h1 style="color: #D4AF37; font-family: Georgia, serif; font-size: 28px; font-weight: 700; margin: 0;">Kozy Care</h1>
        <p style="color: rgba(255,255,255,0.7); font-size: 11px; text-transform: uppercase; letter-spacing: 2px; margin: 4px 0 0 0;">Drycleaning &amp; Laundry</p>
      </div>
      <div style="padding: 40px;">
        <h2 style="color: #0A192F; font-family: Georgia, serif; font-size: 22px; margin: 0 0 16px 0;">${heading}, ${order.user.name.split(' ')[0]}!</h2>
        <p style="color: #6F88A8; line-height: 1.6; font-size: 15px; margin: 0 0 24px 0;">${intro}</p>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          ${rows
            .map(
              (r) => `
            <tr>
              <td style="padding: 8px 0; color: #6F88A8; width: 140px; vertical-align: top; border-bottom: 1px solid #F0F2F5;">${r.label}</td>
              <td style="padding: 8px 0; color: #0A192F; font-weight: 600; border-bottom: 1px solid #F0F2F5;">${r.value}</td>
            </tr>`
            )
            .join('')}
        </table>
        ${
          cta
            ? `<div style="text-align: center; margin: 28px 0 8px 0;">
                 <a href="${cta.url}" style="display: inline-block; background: linear-gradient(135deg, #E3BE4F, #D4AF37, #B8962B); color: #0A192F; padding: 14px 32px; border-radius: 9999px; text-decoration: none; font-weight: 700; font-size: 15px; box-shadow: 0 4px 14px rgba(212,175,55,0.35);">${cta.label}</a>
               </div>
               <p style="color: #6F88A8; font-size: 12px; margin: 12px 0 0 0; line-height: 1.5;">Or paste this link into your browser:<br><span style="color: #0A192F; word-break: break-all;">${cta.url}</span></p>`
            : ''
        }
        <p style="color: #6F88A8; font-size: 11px; margin: 32px 0 0 0; border-top: 1px solid #E2E5E9; padding-top: 16px; line-height: 1.6;">
          ${
            footer ||
            'Questions? Call us on +234 800 569 3789 or reply to this email.<br>Kozy Care — Uncompromising care. Exceptional convenience.'
          }
        </p>
      </div>
    </div>
  </body>
  </html>`

  return { subject, html }
}

// ----- Termii SMS -----
async function sendSMS(to: string, message: string): Promise<void> {
  const apiKey = process.env.TERMII_API_KEY
  if (!apiKey) {
    console.warn('TERMII_API_KEY not set — skipping SMS send')
    return
  }
  const senderId = process.env.TERMII_SENDER_ID || 'Kozy'
  const channel = process.env.TERMII_CHANNEL || 'generic'

  const res = await fetch('https://api.ng.termii.com/api/sms/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: to.replace(/\s|-/g, ''),
      from: senderId,
      sms: message,
      type: 'plain',
      channel,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Termii send failed (${res.status}): ${err}`)
  }
}

// =============================================================================
// Public API — all functions are safe to call from any route handler
// =============================================================================

// ----- Booking confirmation (order created — authed or guest) -----
export async function notifyOrderCreated(order: NotifiableOrder): Promise<void> {
  try {
    const { subject, html } = brandedEmail({
      heading: 'Your booking is confirmed',
      intro:
        'Thank you for choosing Kozy Care. Here are your pickup details — keep this email for your records.',
      order,
      cta: { label: 'Track your order', url: `${baseUrl()}/portal` },
    })
    await sendEmail({ to: order.user.email, subject, html })

    await sendSMS(
      order.user.phone,
      `Kozy Care: Booking confirmed! Order #${order.orderNumber}, pickup ${fmtDate(order.pickupDate)} (${order.pickupTimeSlot}). Track: ${baseUrl()}/portal`
    )
  } catch (e) {
    console.error('notifyOrderCreated failed:', e)
  }
}

// ----- Guest account created alongside a booking -----
export async function notifyGuestAccountCreated(
  order: NotifiableOrder,
  email: string
): Promise<void> {
  try {
    const { subject, html } = brandedEmail({
      heading: 'Your booking is confirmed',
      intro:
        'Thank you for choosing Kozy Care. We created an account with this email so you can track this order and book again faster — just set a password with the button below.',
      order,
      cta: {
        label: 'Set my password',
        url: `${baseUrl()}/forgot-password?email=${encodeURIComponent(email)}`,
      },
      footer:
        'You booked as a guest, so no password exists yet. The button above lets you set one — it also works for signing in on future visits.<br>Kozy Care — Uncompromising care. Exceptional convenience.',
    })
    await sendEmail({ to: email, subject, html })

    await sendSMS(
      order.user.phone,
      `Kozy Care: Booking confirmed! Order #${order.orderNumber}, pickup ${fmtDate(order.pickupDate)} (${order.pickupTimeSlot}). Set your password: ${baseUrl()}/forgot-password`
    )
  } catch (e) {
    console.error('notifyGuestAccountCreated failed:', e)
  }
}

// ----- Status change (called from PATCH /api/orders/[id]) -----
export async function notifyOrderStatus(
  order: NotifiableOrder,
  newStatus: string
): Promise<void> {
  try {
    const copy = STATUS_COPY[newStatus]
    if (!copy) return

    // Email — every status change
    const { subject, html } = brandedEmail({
      heading: copy.title,
      intro: copy.body,
      order,
      cta:
        newStatus === 'DELIVERED'
          ? { label: 'Rate your experience', url: `${baseUrl()}/review/${order.id}` }
          : { label: 'Track your order', url: `${baseUrl()}/portal` },
    })
    await sendEmail({ to: order.user.email, subject, html })

    // SMS — only the actionable statuses
    if (SMS_STATUSES.has(newStatus)) {
      const smsText =
        newStatus === 'DELIVERED'
          ? `Kozy Care: Order #${order.orderNumber} delivered. Thank you! Rate your experience: ${baseUrl()}/review/${order.id}`
          : `Kozy Care: ${copy.title} — order #${order.orderNumber}. ${newStatus === 'OUT_FOR_DELIVERY' ? 'Our rider is on the way to you.' : ''}`.trim()
      await sendSMS(order.user.phone, smsText)
    }
  } catch (e) {
    console.error('notifyOrderStatus failed:', e)
  }
}

// ----- Payment verified via Paystack webhook -----
export async function notifyPaymentVerified(order: NotifiableOrder): Promise<void> {
  try {
    const { subject, html } = brandedEmail({
      heading: 'Payment confirmed',
      intro:
        'Your online payment was received and confirmed automatically. Your pickup is now scheduled.',
      order,
      cta: { label: 'Track your order', url: `${baseUrl()}/portal` },
    })
    await sendEmail({ to: order.user.email, subject, html })
  } catch (e) {
    console.error('notifyPaymentVerified failed:', e)
  }
}
