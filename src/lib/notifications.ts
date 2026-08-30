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
import { getAppSettings } from '@/lib/app-settings'
import { isValidEmail, normalizeEmail } from '@/lib/email-validation'

type NotifiableOrder = {
  id: string
  orderNumber: string
  status: string
  type: string
  totalPrice?: number | null
  serviceSpeed?: string | null
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

/** Customer-facing turnaround promise for an order's service-speed tier. */
function turnaroundCopy(speed?: string | null): string {
  if (speed === 'EXPRESS_48') return 'Express 48 — back within 48 hours of pickup'
  if (speed === 'EXPRESS_24') return 'Express 24 — back within 24 hours of pickup'
  return 'Standard — back within 3–5 days'
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
    'https://kozycare.ng'
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
// Async: the footer contact phone comes from AppSetting so the admin can
// change the business line once in Settings and every future email follows
// (previously every template hardcoded +234 803 175 5230 and silently
// contradicted an edited setting).
async function brandedEmail(opts: {
  heading: string
  intro: string
  order: NotifiableOrder
  extraRows?: { label: string; value: string }[]
  cta?: { label: string; url: string }
  footer?: string
}): Promise<{ subject: string; html: string }> {
  const { heading, intro, order, extraRows = [], cta, footer } = opts
  const { contactPhone } = await getAppSettings()
  const rows: { label: string; value: string }[] = [
    { label: 'Order', value: `#${order.orderNumber}` },
    { label: 'Pickup', value: `${fmtDate(order.pickupDate)} · ${order.pickupTimeSlot}` },
    { label: 'Pickup address', value: order.pickupAddress },
  ]
  if (order.serviceSpeed && order.serviceSpeed !== 'STANDARD') {
    rows.push({ label: 'Turnaround', value: turnaroundCopy(order.serviceSpeed) })
  }
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
            footer || `Questions? Call us on ${contactPhone} or reply to this email.<br>Kozy Care — Uncompromising care. Exceptional convenience.`
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

// ----- Bank-transfer order: verification underway -----
// Sent the moment a bank-transfer order is confirmed. This is the email that
// answers "did my payment go through?" — it says clearly that verification is
// underway, another email follows the moment admin confirms, and the customer
// must NOT pay again.
export async function notifyTransferPendingVerification(
  order: NotifiableOrder
): Promise<void> {
  try {
    const amount = order.totalPrice ?? 0
    const { subject, html } = await brandedEmail({
      heading: 'We’re verifying your transfer',
      intro:
        'Thank you for booking with Kozy Care. Your order is in and our team is verifying your bank transfer right now — usually within minutes during business hours (Mon–Sat, 8am–6pm). You’ll get another email the moment it’s confirmed. Please don’t send the transfer again or re-book: if you completed it, we have it, and your rider is dispatched as soon as payment is verified.',
      order,
      extraRows: [
        { label: 'Amount', value: formatNaira(amount) },
        { label: 'Payment', value: 'Bank transfer — being verified' },
        { label: 'Narration reference', value: `Use #${order.orderNumber}` },
      ],
      cta: { label: 'Check payment status', url: `${baseUrl()}/payment/pending?order=${order.orderNumber}&email=${encodeURIComponent(order.user.email)}` },
      footer:
        'The status page updates itself while we verify — no need to refresh or resend anything.<br>Kozy Care — Uncompromising care. Exceptional convenience.',
    })
    await sendEmail({ to: order.user.email, subject, html })

    await sendSMS(
      order.user.phone,
      `Kozy Care: Order #${order.orderNumber} received — we're verifying your transfer of ${formatNaira(amount)}. You'll get an email once confirmed. Please do not pay again.`
    )
  } catch (e) {
    console.error('notifyTransferPendingVerification failed:', e)
  }
}

// ----- Booking confirmation (order created — authed or guest) -----
export async function notifyOrderCreated(order: NotifiableOrder): Promise<void> {
  try {
    const { subject, html } = await brandedEmail({
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
// opts.transferPending: the booking was paid by bank transfer and is awaiting
// verification — the email then leads with that (plus the "don't pay again"
// reassurance) so a first-time guest is never left wondering.
export async function notifyGuestAccountCreated(
  order: NotifiableOrder,
  email: string,
  opts?: { transferPending?: boolean }
): Promise<void> {
  try {
    const transferPending = opts?.transferPending === true
    const { subject, html } = await brandedEmail({
      heading: transferPending ? 'We’re verifying your transfer' : 'Your booking is confirmed',
      intro: transferPending
        ? 'Thank you for booking with Kozy Care. Your order is in and our team is verifying your bank transfer right now — usually within minutes during business hours (Mon–Sat, 8am–6pm). You’ll get another email the moment it’s confirmed, so please don’t send the transfer again or re-book. We also created an account with this email so you can track this order and book again faster — just set a password with the button below.'
        : 'Thank you for choosing Kozy Care. We created an account with this email so you can track this order and book again faster — just set a password with the button below.',
      order,
      extraRows: transferPending
        ? [
            { label: 'Amount', value: formatNaira(order.totalPrice ?? 0) },
            { label: 'Payment', value: 'Bank transfer — being verified' },
            { label: 'Narration reference', value: `Use #${order.orderNumber}` },
          ]
        : [],
      cta: {
        label: transferPending ? 'Check payment status & set password' : 'Set my password',
        url: `${baseUrl()}/forgot-password?email=${encodeURIComponent(email)}`,
      },
      footer: transferPending
        ? 'You booked as a guest, so no password exists yet — the button above lets you set one for future visits. We’ll email you the moment your transfer is verified.<br>Kozy Care — Uncompromising care. Exceptional convenience.'
        : 'You booked as a guest, so no password exists yet. The button above lets you set one — it also works for signing in on future visits.<br>Kozy Care — Uncompromising care. Exceptional convenience.',
    })
    await sendEmail({ to: email, subject, html })

    await sendSMS(
      order.user.phone,
      transferPending
        ? `Kozy Care: Order #${order.orderNumber} received — we're verifying your transfer. You'll get an email once confirmed. Please do not pay again. Set your password: ${baseUrl()}/forgot-password`
        : `Kozy Care: Booking confirmed! Order #${order.orderNumber}, pickup ${fmtDate(order.pickupDate)} (${order.pickupTimeSlot}). Set your password: ${baseUrl()}/forgot-password`
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
    const { subject, html } = await brandedEmail({
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
    const { subject, html } = await brandedEmail({
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

// ----- Bank transfer REJECTED by admin -----
// The customer must act (their transfer didn't match the order), so the email
// spells out exactly what to check and what NOT to do (don't pay twice —
// if they were debited, we sort it out with a phone call).
export async function notifyPaymentRejected(order: NotifiableOrder): Promise<void> {
  try {
    const { contactPhone } = await getAppSettings()
    const { subject, html } = await brandedEmail({
      heading: 'We couldn’t match your transfer',
      intro:
        `Our team checked but couldn’t match a transfer to this order yet. Please check in your banking app that the transfer went through to the correct account. If you were debited, don’t pay again — call us on ${contactPhone} with your order number and we’ll sort it out the same day. If the transfer never left your account, simply send it with your order number as the narration and we’ll verify it right away.`,
      order,
      extraRows: [{ label: 'Payment', value: 'Bank transfer — not matched yet' }],
      cta: { label: 'Check payment status', url: `${baseUrl()}/payment/pending?order=${order.orderNumber}&email=${encodeURIComponent(order.user.email)}` },
      footer:
        'Nothing is lost — your order is safe with us and we’ll get it moving as soon as the payment is sorted.<br>Kozy Care — Uncompromising care. Exceptional convenience.',
    })
    await sendEmail({ to: order.user.email, subject, html })

    await sendSMS(
      order.user.phone,
      `Kozy Care: We couldn't match a transfer for order #${order.orderNumber} yet. If you were debited, do NOT pay again — call ${contactPhone} and we'll sort it out.`
    )
  } catch (e) {
    console.error('notifyPaymentRejected failed:', e)
  }
}

// =============================================================================
// ADMIN ALERTS — ping the business owner's inbox the moment something needs
// their attention (new signup, new order, customer says they've paid).
//
// The destination address + per-alert toggles live in AppSetting (admin
// Settings → Notifications) so the owner can change them without a redeploy.
// Fallback chain: DB setting → ADMIN_ALERTS_EMAIL env → the default contact
// email. Like every notification here: never throws, never blocks a request.
// =============================================================================

/** Resolve where admin alerts go + which types are enabled. */
async function adminAlertConfig(): Promise<{
  email: string
  newSignup: boolean
  newOrder: boolean
  paymentPending: boolean
}> {
  const settings = await getAppSettings()
  const fallback =
    process.env.ADMIN_ALERTS_EMAIL || settings.contactEmail || 'kozygarmentcare@gmail.com'
  return {
    email: isValidEmail(settings.adminAlertsEmail)
      ? normalizeEmail(settings.adminAlertsEmail)
      : normalizeEmail(fallback),
    newSignup: settings.adminAlertsNewSignup !== false,
    newOrder: settings.adminAlertsNewOrder !== false,
    paymentPending: settings.adminAlertsPaymentPending !== false,
  }
}

/** Compact operational email wrapper for admin alerts (scannable, not marketing-pretty). */
function adminEmail(opts: {
  badge: string
  heading: string
  intro: string
  rows: { label: string; value: string }[]
  cta: { label: string; url: string }
}): { subject: string; html: string } {
  const { badge, heading, intro, rows, cta } = opts
  return {
    subject: `[Kozy Care] ${heading}`,
    html: `
    <!DOCTYPE html>
    <html>
    <body style="font-family: Arial, Helvetica, sans-serif; background: #F8F9FA; padding: 32px 0; margin: 0;">
      <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(10,25,47,0.08);">
        <div style="background: #0A192F; padding: 18px 32px;">
          <table style="width: 100%; border-collapse: collapse;"><tr>
            <td style="vertical-align: middle;">
              <span style="color: #D4AF37; font-weight: 700; font-size: 18px; letter-spacing: 0.5px;">Kozy Care</span>
              <span style="color: rgba(255,255,255,0.5); font-size: 11px; text-transform: uppercase; letter-spacing: 2px; margin-left: 10px;">Operations</span>
            </td>
            <td style="vertical-align: middle; text-align: right;">
              <span style="background: #D4AF37; color: #0A192F; font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 1px;">${badge}</span>
            </td>
          </tr></table>
        </div>
        <div style="padding: 28px 32px;">
          <h2 style="color: #0A192F; font-size: 18px; margin: 0 0 10px 0;">${heading}</h2>
          <p style="color: #6F88A8; font-size: 14px; line-height: 1.6; margin: 0 0 18px 0;">${intro}</p>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px; background: #F8F9FA; border-radius: 8px;">
            ${rows
              .map(
                (r) => `
            <tr>
              <td style="padding: 9px 14px; color: #6F88A8; width: 150px; vertical-align: top; border-bottom: 1px solid #EDEFF2;">${r.label}</td>
              <td style="padding: 9px 14px; color: #0A192F; font-weight: 600; border-bottom: 1px solid #EDEFF2;">${r.value}</td>
            </tr>`
              )
              .join('')}
          </table>
          <div style="margin: 22px 0 4px 0; text-align: center;">
            <a href="${cta.url}" style="display: inline-block; background: #0A192F; color: #ffffff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 14px;">${cta.label}</a>
          </div>
          <p style="color: #98A8BD; font-size: 11px; margin: 18px 0 0 0; border-top: 1px solid #E2E5E9; padding-top: 14px; line-height: 1.5;">
            You receive this because admin alerts are on — manage the alert email and toggles in
            Admin → Settings → Notifications.
          </p>
        </div>
      </div>
    </body>
    </html>`,
  }
}

/** A new customer signed up (account created, pending email verification). */
export async function notifyAdminNewCustomer(user: {
  name: string
  email: string
  phone: string
  role: string
  company?: string | null
}): Promise<void> {
  try {
    const cfg = await adminAlertConfig()
    if (!cfg.newSignup) return
    const { subject, html } = adminEmail({
      badge: 'New customer',
      heading: `${user.name} just signed up`,
      intro:
        'A new account was created and is waiting for the customer to verify their email. They’ll show up in the CRM with a NEW badge for their first week.',
      rows: [
        { label: 'Name', value: user.name },
        { label: 'Email', value: user.email },
        { label: 'Phone', value: user.phone },
        { label: 'Account type', value: user.role === 'B2B' ? `Corporate${user.company ? ` — ${user.company}` : ''}` : 'Personal' },
      ],
      cta: { label: 'Open the CRM', url: `${baseUrl()}/admin` },
    })
    await sendEmail({ to: cfg.email, subject, html })
  } catch (e) {
    console.error('notifyAdminNewCustomer failed:', e)
  }
}

/** A new order was placed (authed customer or guest checkout). */
export async function notifyAdminNewOrder(order: NotifiableOrder): Promise<void> {
  try {
    const cfg = await adminAlertConfig()
    if (!cfg.newOrder) return
    let itemCount = '—'
    try {
      const parsed = JSON.parse((order as any).itemsManifest || '[]')
      if (Array.isArray(parsed) && parsed.length > 0) itemCount = `${parsed.length} item${parsed.length === 1 ? '' : 's'}`
    } catch {
      /* KG orders have no manifest */
    }
    const { subject, html } = adminEmail({
      badge: 'New order',
      heading: `New order #${order.orderNumber}`,
      intro:
        order.type === 'KG'
          ? 'A corporate/bulk booking came in — total is quoted after weighing at the station.'
          : 'A new pickup booking came in. It will appear on your Orders board immediately.',
      rows: [
        { label: 'Customer', value: order.user.name },
        { label: 'Phone', value: order.user.phone },
        { label: 'Pickup', value: `${fmtDate(order.pickupDate)} · ${order.pickupTimeSlot}` },
        { label: 'Address', value: order.pickupAddress },
        { label: 'Basket', value: order.type === 'KG' ? 'Bulk (per-kg)' : itemCount },
        { label: 'Total', value: order.totalPrice ? formatNaira(order.totalPrice) : 'To be weighed' },
        {
          label: 'Payment',
          value: (order as any).payments?.some?.((p: any) => p.status === 'PENDING') || order.status === 'PAYMENT_PENDING_VERIFICATION'
            ? 'Bank transfer — verify it now'
            : 'Bank transfer / card',
        },
      ],
      cta: { label: 'Open the Orders board', url: `${baseUrl()}/admin` },
    })
    await sendEmail({ to: cfg.email, subject, html })
  } catch (e) {
    console.error('notifyAdminNewOrder failed:', e)
  }
}

/** A customer confirmed a bank transfer — needs admin verification NOW. */
export async function notifyAdminTransferPending(order: NotifiableOrder): Promise<void> {
  try {
    const cfg = await adminAlertConfig()
    if (!cfg.paymentPending) return
    const { subject, html } = adminEmail({
      badge: 'Payment to verify',
      heading: `Verify payment — order #${order.orderNumber}`,
      intro:
        'A customer just confirmed they’ve made the bank transfer. The customer is watching their payment status page — verifying it releases the pickup.',
      rows: [
        { label: 'Customer', value: `${order.user.name} (${order.user.email})` },
        { label: 'Amount', value: formatNaira(order.totalPrice ?? 0) },
        { label: 'Expected narration', value: `#${order.orderNumber}` },
        { label: 'Pickup', value: `${fmtDate(order.pickupDate)} · ${order.pickupTimeSlot}` },
        { label: 'Receipt', value: (order as any).payments?.[0]?.receiptUrl ? 'Screenshot attached in the queue' : 'Not attached — match on your bank statement' },
      ],
      cta: { label: 'Open the verification queue', url: `${baseUrl()}/admin` },
    })
    await sendEmail({ to: cfg.email, subject, html })
  } catch (e) {
    console.error('notifyAdminTransferPending failed:', e)
  }
}

// ----- B2B invoice ready (admin recorded the weight) -----
// Called when the admin saves a final weight on a per-kg order. The order
// modal has always claimed "Weight recorded — invoice sent"; now the email
// actually exists, priced with the SAME server-side price-per-kg the admin
// edits in Settings (previously the API hardcoded ₦800/kg).
export async function notifyInvoiceReady(
  order: NotifiableOrder,
  billableKg: number,
  totalPrice: number
): Promise<void> {
  try {
    const settings = await getAppSettings()
    const { subject, html } = await brandedEmail({
      heading: 'Your bulk invoice is ready',
      intro:
        `We weighed your items and your invoice is ready: ${billableKg}kg billable at ${formatNaira(settings.pricePerKg)}/kg. Kindly complete the bank transfer below with your order number as the narration — your pickup/delivery is released as soon as we verify it.`,
      order,
      extraRows: [
        { label: 'Billable weight', value: `${billableKg}kg (minimum ${settings.minimumKg}kg)` },
        { label: 'Rate', value: `${formatNaira(settings.pricePerKg)}/kg` },
        { label: 'Amount due', value: formatNaira(totalPrice) },
        { label: 'Pay to', value: `${settings.bankName} · ${settings.accountName} · ${settings.accountNumber}` },
        { label: 'Narration', value: `#${order.orderNumber}` },
      ],
      cta: { label: 'Check payment status', url: `${baseUrl()}/payment/pending?order=${order.orderNumber}&email=${encodeURIComponent(order.user.email)}` },
    })
    await sendEmail({ to: order.user.email, subject, html })

    await sendSMS(
      order.user.phone,
      `Kozy Care: Invoice for order #${order.orderNumber} — ${billableKg}kg, ${formatNaira(totalPrice)}. Transfer with #${order.orderNumber} as narration. Thank you!`
    )
  } catch (e) {
    console.error('notifyInvoiceReady failed:', e)
  }
}

/** A visitor submitted feedback (complaint / question / review) on /feedback. */
export async function notifyAdminNewFeedback(feedback: {
  type: string
  name: string
  email: string
  phone?: string | null
  reference?: string | null
  rating?: number | null
  message: string
}): Promise<void> {
  try {
    const cfg = await adminAlertConfig()
    const typeLabel =
      feedback.type === 'COMPLAINT' ? 'Complaint' : feedback.type === 'QUESTION' ? 'Question' : 'Feedback'
    const { subject, html } = adminEmail({
      badge: typeLabel,
      heading: `New ${typeLabel.toLowerCase()} from ${feedback.name}`,
      intro:
        feedback.type === 'COMPLAINT'
          ? 'A customer filed a complaint — it is waiting in your Feedback inbox. Complaints left unanswered are the fastest way to lose a Lagos customer, so this one pings you directly.'
          : 'A visitor reached out through the feedback form. It is saved in your Feedback inbox.',
      rows: [
        { label: 'From', value: `${feedback.name} (${feedback.email})` },
        ...(feedback.phone ? [{ label: 'Phone', value: feedback.phone }] : []),
        ...(feedback.reference ? [{ label: 'Reference', value: feedback.reference }] : []),
        ...(feedback.rating ? [{ label: 'Rating', value: `${feedback.rating}/5` }] : []),
        { label: 'Message', value: feedback.message },
      ],
      cta: { label: 'Open the Feedback inbox', url: `${baseUrl()}/admin` },
    })
    await sendEmail({ to: cfg.email, subject, html })
  } catch (e) {
    console.error('notifyAdminNewFeedback failed:', e)
  }
}

/** A rider applied to join the Kozy delivery team (/join-riders). */
export async function notifyAdminRiderApplication(app: {
  fullName: string
  email?: string | null
  phone: string
  altPhone?: string | null
  lga: string
  bikeModel: string
  bikeYear: string
  licenseNumber: string
  availability: string
  experience?: string | null
}): Promise<void> {
  try {
    const cfg = await adminAlertConfig()
    const { subject, html } = adminEmail({
      badge: 'Rider application',
      heading: `${app.fullName} applied to ride for Kozy`,
      intro:
        'A new rider application came in through the Join the Team page. Applications are stored in the database — reply to this alert to follow up with them directly.',
      rows: [
        { label: 'Name', value: app.fullName },
        { label: 'Phone', value: app.phone + (app.altPhone ? ` / ${app.altPhone}` : '') },
        ...(app.email ? [{ label: 'Email', value: app.email }] : []),
        { label: 'Preferred area', value: app.lga },
        { label: 'Bike', value: `${app.bikeModel} (${app.bikeYear})` },
        { label: 'License no.', value: app.licenseNumber },
        { label: 'Availability', value: app.availability },
        ...(app.experience ? [{ label: 'Experience', value: app.experience }] : []),
      ],
      cta: { label: 'Contact the rider', url: `tel:${app.phone.replace(/\s/g, '')}` },
    })
    await sendEmail({ to: cfg.email, subject, html })
  } catch (e) {
    console.error('notifyAdminRiderApplication failed:', e)
  }
}
