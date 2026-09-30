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

import { sendEmail, emailOverrideTarget } from '@/lib/email'
import { formatNaira, renewalPriceFor, renewalSavingFor } from '@/lib/types'
import { getAppSettings } from '@/lib/app-settings'
import { isValidEmail, normalizeEmail } from '@/lib/email-validation'
import { db } from '@/lib/db'
import type { NotificationEventType, NotificationEmailStatus } from '@/lib/types'

type NotifiableOrder = {
  id: string
  orderNumber: string
  status: string
  type: string
  totalPrice?: number | null
  /** Phase 53 loyalty: this order is the customer's earned complimentary
   *  service ("after 10 washes, the 11th is free") — priced at zero. */
  loyaltyFree?: boolean
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

// ---------------------------------------------------------------------
// CUSTOMER EMAIL CADENCE (owner's directive, phase 54)
// "We don't really want users to be getting messages at every step…"
// The Kanban has ten columns, but only the moments where the customer
// must DO something (pay, be reachable, check their garments) or where
// something genuinely lands at their door earn an email:
//   AWAITING PAYMENT  — they need to know we're verifying their transfer
//   READY TO PICK UP — their pickup is now scheduled (payment confirmed)
//   FINISHING        — their garments are being pressed (the final update)
//   OUT FOR DELIVERY — the rider is on the way; keep the phone nearby
//   DELIVERED        — the feedback ask + 24h guarantee window
//   CANCELLED        — rare and always needs explaining
// Deliberately QUIET (no email, no SMS): REQUESTED (the booking
// confirmation email already covers the moment the order is placed),
// PICKED_UP, AT_STATION, PROCESSING — operational stages the customer
// cannot act on. The portal still shows live status for every step.
const CUSTOMER_EMAIL_STATUSES = new Set([
  'PAYMENT_PENDING_VERIFICATION',
  'PAYMENT_VERIFIED',
  'FINISHING',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
])

// Statuses worth an SMS (actionable, time-sensitive — same curation
// philosophy as the email set: "no need to tell them that you picked it
// up", so PICKED_UP lost its SMS in phase 54)
const SMS_STATUSES = new Set(['OUT_FOR_DELIVERY', 'DELIVERED'])

function baseUrl(): string {
  // Phase 55: when the EMAIL_OVERRIDE_TO test valve is active, emails are
  // being sent from a DEV server but previewed as production mail — every
  // link inside them must point at the live site. Before this guard, test
  // emails carried http://localhost:3000 CTAs ("Open the rider app" →
  // blank screen on the owner's phone). Production runs without the
  // override and keeps resolving NEXTAUTH_URL / NEXT_PUBLIC_APP_URL as before.
  if (emailOverrideTarget()) {
    return process.env.EMAIL_OVERRIDE_BASE_URL || 'https://kozycare.ng'
  }
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
  category: string
  heading: string
  intro: string
  order: NotifiableOrder
  extraRows?: { label: string; value: string }[]
  cta?: { label: string; url: string }
  footer?: string
}): Promise<{ subject: string; html: string }> {
  const { category, heading, intro, order, extraRows = [], cta, footer } = opts
  const { contactPhone } = await getAppSettings()
  const rows: { label: string; value: string }[] = [
    { label: 'Order', value: `#${order.orderNumber}` },
    { label: 'Pickup', value: `${fmtDate(order.pickupDate)} · ${order.pickupTimeSlot}` },
    { label: 'Pickup address', value: order.pickupAddress },
  ]
  if (order.serviceSpeed && order.serviceSpeed !== 'STANDARD') {
    rows.push({ label: 'Turnaround', value: turnaroundCopy(order.serviceSpeed) })
  }
  if (order.loyaltyFree) {
    rows.push({ label: 'Total', value: 'On the house — ₦0' })
  } else if (order.totalPrice) {
    rows.push({ label: 'Total', value: formatNaira(order.totalPrice) })
  }
  rows.push(...extraRows)

  // Phase 56: brand + category lead the subject so an inbox list is
  //  triageable at a glance (the order number tail already identifies it).
  const subject = `[Kozy Care · ${categoryTag(category)}] ${heading} — Order #${order.orderNumber}`

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
      category: 'payment',
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
    // Phase 53 loyalty: this order is the earned complimentary service —
    // the confirmation must say so plainly instead of showing a bare ₦0.
    const complimentary = order.loyaltyFree === true
    const { subject, html } = await brandedEmail({
      category: 'booking',
      heading: complimentary
        ? 'Your booking is confirmed — with our compliments'
        : 'Your booking is confirmed',
      intro: complimentary
        ? 'Thank you for choosing Kozy Care — ten services in, this one is on the house. Here are your pickup details; keep this email for your records.'
        : 'Thank you for choosing Kozy Care. Here are your pickup details — keep this email for your records.',
      order,
      extraRows: complimentary
        ? [{ label: 'Payment', value: 'Nothing due — this service is on the house' }]
        : [],
      cta: { label: 'Track your order', url: `${baseUrl()}/portal` },
    })
    await sendEmail({ to: order.user.email, subject, html })

    await sendSMS(
      order.user.phone,
      complimentary
        ? `Kozy Care: Booking confirmed! Order #${order.orderNumber}, pickup ${fmtDate(order.pickupDate)} (${order.pickupTimeSlot}) — this one is on the house. Track: ${baseUrl()}/portal`
        : `Kozy Care: Booking confirmed! Order #${order.orderNumber}, pickup ${fmtDate(order.pickupDate)} (${order.pickupTimeSlot}). Track: ${baseUrl()}/portal`
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
      category: 'account',
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

    // Phase 54 cadence gate: quiet stages (REQUESTED / PICKED_UP /
    // AT_STATION / PROCESSING) never email or SMS the customer — see
    // CUSTOMER_EMAIL_STATUSES above. The stage-dedup in the PATCH route
    // still advances lastNotifiedStage so a later re-move stays silent
    // too; the portal timeline keeps showing every step live.
    if (!CUSTOMER_EMAIL_STATUSES.has(newStatus)) {
      console.log(
        `[notify] quiet stage — no customer email/SMS for ${newStatus} (order #${order.orderNumber})`
      )
      return
    }

    // DELIVERED is the FEEDBACK moment (owner's directive): the customer
    // has their garments back and everything is still crisp — a rating
    // request that lands NOW, seconds after the admin marks the order
    // received, converts far better than one sent days later. The same
    // email closes the guarantee loop: check your items, 24 hours to
    // flag anything (that window is also when the condition-photo
    // evidence expires, so the two stories reinforce each other).
    const isDelivered = newStatus === 'DELIVERED'
    const firstName = order.user?.name ? order.user.name.split(' ')[0] : ''
    const heading = isDelivered
      ? 'Your order was delivered — how did we do?'
      : copy.title
    const intro = isDelivered
      ? `${firstName ? `${firstName}, your` : 'Your'} garments are back with you — freshly cleaned, pressed and ready for the week. If everything looks and feels exactly right, we would love a quick rating: it takes about 30 seconds and it genuinely helps other Lagos households choose well.${
          (order as any).guaranteeActive
            ? ' If anything is NOT as it should be, check your items now — you have 24 hours from delivery to tell us under the Return-as-Received Guarantee, and your pre-pickup photos are on file.'
            : ''
        }`
      : copy.body

    // Phase 56 category per stage — the customer inbox can be triaged
    // without opening anything: Payment while money moves, Delivery while
    // garments travel, Feedback at the rating moment, Order otherwise.
    const STATUS_CATEGORY: Record<string, string> = {
      PAYMENT_PENDING_VERIFICATION: 'payment',
      PAYMENT_VERIFIED: 'payment',
      FINISHING: 'order',
      OUT_FOR_DELIVERY: 'delivery',
      DELIVERED: 'feedback',
      CANCELLED: 'order',
    }

    // Email — every (non-quiet) status change
    const { subject, html } = await brandedEmail({
      category: STATUS_CATEGORY[newStatus] ?? 'order',
      heading,
      intro,
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

// ----- Staff question to the customer (phase 54) -----
// The owner's rule: the only mid-order message a customer should get, apart
// from the curated status cadence above, is a genuine QUESTION from the
// team ("which gate should the rider call at?", "we found a second shirt —
// is it yours?"). Sent from the admin order modal's "Ask the customer"
// composer — email first (the question in full) + a best-effort SMS so a
// time-sensitive question reaches them even away from their inbox.
export async function notifyCustomerQuestion(
  order: NotifiableOrder,
  question: string,
  senderName: string
): Promise<void> {
  try {
    const { contactPhone } = await getAppSettings()
    const firstName = order.user?.name ? order.user.name.split(' ')[0] : 'there'
    const { subject, html } = await brandedEmail({
      category: 'question',
      heading: 'A quick question about your order',
      intro: `${firstName}, our team needs one quick detail from you to keep order #${order.orderNumber} moving smoothly. Could you help us with this?`,
      order,
      extraRows: [
        { label: 'From', value: `${senderName} — Kozy Care team` },
        { label: 'Question', value: question },
      ],
      cta: { label: 'View your order', url: `${baseUrl()}/portal` },
      footer: `A quick reply keeps everything on schedule: call or message us on ${contactPhone} with your answer (Mon–Sat, 8am–6pm). We only email you when it genuinely matters.<br>Kozy Care — Uncompromising care. Exceptional convenience.`,
    })
    await sendEmail({ to: order.user.email, subject, html })

    // Best-effort SMS (never throws hard): trimmed to the first ~120 chars
    // so the full question stays legible within one SMS segment.
    const shortQuestion =
      question.length > 120 ? `${question.slice(0, 117).trim()}…` : question
    await sendSMS(
      order.user.phone,
      `Kozy Care: Quick question about order #${order.orderNumber} — ${shortQuestion} Reply/call ${contactPhone}.`
    )
  } catch (e) {
    console.error('notifyCustomerQuestion failed:', e)
  }
}

// ----- Payment verified via Paystack webhook -----
export async function notifyPaymentVerified(order: NotifiableOrder): Promise<void> {
  try {
    const { subject, html } = await brandedEmail({
      category: 'payment',
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
      category: 'payment',
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

/** Resolve where admin alerts go + which types are enabled.
 *
 * The destination setting accepts a comma/semicolon-separated LIST of
 * addresses (client request: alerts must reach BOTH kozygarmentcare@gmail.com
 * and practiceprosystems@gmail.com). Fallback chain if none of the stored
 * values parse: ADMIN_ALERTS_EMAIL env → contact email → the owners. */
function parseAlertEmails(raw: string | null | undefined): string[] {
  if (!raw) return []
  const list = raw
    .split(/[,;\n]/)
    .map((s) => normalizeEmail(s.trim()))
    .filter((s) => isValidEmail(s))
  return [...new Set(list)]
}

async function adminAlertConfig(): Promise<{
  emails: string[]
  newSignup: boolean
  newOrder: boolean
  paymentPending: boolean
}> {
  const settings = await getAppSettings()
  const emails = parseAlertEmails(settings.adminAlertsEmail)
  const fallback = parseAlertEmails(
    process.env.ADMIN_ALERTS_EMAIL || settings.contactEmail || 'kozygarmentcare@gmail.com'
  )
  return {
    emails: emails.length > 0 ? emails : fallback,
    newSignup: settings.adminAlertsNewSignup !== false,
    newOrder: settings.adminAlertsNewOrder !== false,
    paymentPending: settings.adminAlertsPaymentPending !== false,
  }
}

/**
 * Subject-line taxonomy (phase 56): EVERY email Kozy Care sends carries a
 * category token right after the brand so an inbox can be triaged at a
 * glance — the owner reads a mail list, not a mail body.
 *
 *   [Kozy Care Ops · Incident]  Damage reported on order #KZ-1001
 *   [Kozy Care Ops · Order]     New order #KZ-1002
 *   [Kozy Care · Booking]       Your booking is confirmed — Order #KZ-1002
 *   [Kozy Care · Rider]         Welcome to the rider team, Ada!
 *
 * "Ops" marks the INTERNAL emails (they go to admin inboxes); the plain
 * "Kozy Care · <Category>" form marks customer-facing mail. The dot keeps
 * the brand readable; the category is always one short word.
 */
const CATEGORY_TEXT: Record<string, string> = {
  booking: 'Booking',
  payment: 'Payment',
  order: 'Order',
  delivery: 'Delivery',
  question: 'Question',
  invoice: 'Invoice',
  loyalty: 'Loyalty',
  account: 'Account',
  rider: 'Rider',
  team: 'Team',
  signup: 'Signup',
  feedback: 'Feedback',
  review: 'Review',
  referral: 'Referral',
  incident: 'Incident',
  membership: 'Membership',
  partner: 'Partner',
  test: 'Test',
}

function categoryTag(key: string): string {
  return CATEGORY_TEXT[key] ?? key
}

/** Compact operational email wrapper for admin alerts (scannable, not marketing-pretty). */
function adminEmail(opts: {
  category: string
  badge: string
  heading: string
  intro: string
  rows: { label: string; value: string }[]
  cta: { label: string; url: string }
}): { subject: string; html: string } {
  const { category, badge, heading, intro, rows, cta } = opts
  return {
    subject: `[Kozy Care Ops · ${categoryTag(category)}] ${heading}`,
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

// ----- In-app operations feed + multi-recipient delivery -----
//
// Every admin alert is ALSO recorded as a NotificationEvent row the moment
// it happens, together with the per-recipient email result. Why: alert
// emails sent FROM a gmail.com address via Brevo can land in Gmail's spam
// folder (no DMARC alignment) — the owner missed signups and payment
// confirmations entirely. The in-app feed (Admin → Notifications) now
// guarantees the owners SEE every event regardless of email fate, and the
// recorded emailStatus shows whether the send itself succeeded.

type RecipientResult = { to: string; ok: boolean; error?: string }

async function deliverAdminAlert(opts: {
  type: NotificationEventType
  title: string
  body: string
  emails: string[]
  email?: { subject: string; html: string }
  enabled: boolean
  data?: Record<string, unknown>
  linkTab?: string
}): Promise<void> {
  const { type, title, body, emails, email, enabled, data, linkTab } = opts
  let eventId: string | null = null

  // 1) Record the event immediately — the feed must exist even if every
  //    later step fails. Never throws upward.
  try {
    const event = await db.notificationEvent.create({
      data: {
        type,
        title,
        body,
        data: data ? JSON.stringify(data) : undefined,
        linkTab,
        recipients: JSON.stringify(emails),
        emailStatus: 'NONE',
      },
    })
    eventId = event.id
  } catch (e) {
    console.error('NotificationEvent create failed:', e)
  }

  // 2) Send the email to EVERY configured recipient (toggle-gated), one
  //    result per address. Phase 53: while the EMAIL_OVERRIDE_TO test valve
  //    is open, all recipients collapse into the single test inbox — one
  //    send, not N identical copies — while the event still records the real
  //    configured recipients.
  const override = emailOverrideTarget()
  const sendTargets = override ? [override] : emails
  const shouldSend = enabled && !!email
  const results: RecipientResult[] = shouldSend
    ? await Promise.all(
        sendTargets.map(async (to): Promise<RecipientResult> => {
          try {
            await sendEmail({ to, subject: email!.subject, html: email!.html })
            return { to, ok: true }
          } catch (e: unknown) {
            const error = e instanceof Error ? e.message : String(e)
            console.error(`Admin alert to ${to} failed:`, error)
            return { to, ok: false, error }
          }
        })
      )
    : []

  // 3) Persist the delivery outcome on the event row.
  let status: NotificationEmailStatus
  if (!enabled) status = 'DISABLED'
  else if (emails.length === 0) status = 'FAILED'
  else if (results.length === 0) status = 'DISABLED'
  else if (results.every((r) => r.ok)) status = 'SENT'
  else if (results.some((r) => r.ok)) status = 'PARTIAL'
  else status = 'FAILED'

  if (eventId) {
    try {
      await db.notificationEvent.update({
        where: { id: eventId },
        data: {
          emailStatus: status,
          emailDetail: JSON.stringify({
            attempted: emails,
            results,
            note: override
              ? `EMAIL_OVERRIDE_TO is active — every send was redirected to ${override}.`
              : !enabled
                ? 'This alert type is switched off in Settings → Notifications.'
                : emails.length === 0
                  ? 'No valid alert recipients configured in Settings → Notifications.'
                  : undefined,
          }),
        },
      })
    } catch (e) {
      console.error('NotificationEvent update failed:', e)
    }
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
    const accountType =
      user.role === 'B2B' ? `Corporate${user.company ? ` — ${user.company}` : ''}` : 'Personal'
    const { subject, html } = adminEmail({
      category: 'signup',
      badge: 'New customer',
      heading: `${user.name} just signed up`,
      intro:
        'A new account was created and is waiting for the customer to verify their email. They’ll show up in the CRM with a NEW badge for their first week.',
      rows: [
        { label: 'Name', value: user.name },
        { label: 'Email', value: user.email },
        { label: 'Phone', value: user.phone },
        { label: 'Account type', value: accountType },
      ],
      cta: { label: 'Open the CRM', url: `${baseUrl()}/admin` },
    })
    await deliverAdminAlert({
      type: 'NEW_SIGNUP',
      title: `${user.name} just signed up`,
      body: `${user.email} · ${user.phone} · ${accountType} account`,
      emails: cfg.emails,
      email: { subject, html },
      enabled: cfg.newSignup,
      data: { userName: user.name, userEmail: user.email, userPhone: user.phone, role: user.role },
      linkTab: 'customers',
    })
  } catch (e) {
    console.error('notifyAdminNewCustomer failed:', e)
  }
}

/** A new order was placed (authed customer or guest checkout). */
export async function notifyAdminNewOrder(order: NotifiableOrder): Promise<void> {
  try {
    const cfg = await adminAlertConfig()
    let itemCount = '—'
    try {
      const parsed = JSON.parse((order as any).itemsManifest || '[]')
      if (Array.isArray(parsed) && parsed.length > 0) itemCount = `${parsed.length} item${parsed.length === 1 ? '' : 's'}`
    } catch {
      /* KG orders have no manifest */
    }
    const isTransfer =
      (order as any).payments?.some?.((p: any) => p.status === 'PENDING') ||
      order.status === 'PAYMENT_PENDING_VERIFICATION'
    const { subject, html } = adminEmail({
      category: 'order',
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
        {
          label: 'Total',
          value: order.loyaltyFree
            ? 'On the house — loyalty (ten services)'
            : order.totalPrice
              ? formatNaira(order.totalPrice)
              : 'To be weighed',
        },
        {
          label: 'Payment',
          value: order.loyaltyFree
            ? 'Nothing due — complimentary service'
            : isTransfer
              ? 'Bank transfer — verify it now'
              : 'Bank transfer / card',
        },
      ],
      cta: { label: 'Open the Orders board', url: `${baseUrl()}/admin` },
    })
    await deliverAdminAlert({
      type: 'NEW_ORDER',
      title: `New order #${order.orderNumber}`,
      body:
        `${order.user.name} · ${order.type === 'KG' ? 'Bulk (per-kg)' : itemCount} · ` +
        `${order.totalPrice ? formatNaira(order.totalPrice) : 'to be weighed'} · ` +
        `pickup ${fmtDate(order.pickupDate)}`,
      emails: cfg.emails,
      email: { subject, html },
      enabled: cfg.newOrder,
      data: {
        orderNumber: order.orderNumber,
        orderId: order.id,
        customer: order.user.name,
        customerPhone: order.user.phone,
        total: order.totalPrice ?? null,
      },
      linkTab: 'kanban',
    })
  } catch (e) {
    console.error('notifyAdminNewOrder failed:', e)
  }
}

/** A customer confirmed a bank transfer — needs admin verification NOW. */
export async function notifyAdminTransferPending(order: NotifiableOrder): Promise<void> {
  try {
    const cfg = await adminAlertConfig()
    const { subject, html } = adminEmail({
      category: 'payment',
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
    await deliverAdminAlert({
      type: 'TRANSFER_PENDING',
      title: `Customer says they’ve paid — #${order.orderNumber}`,
      body:
        `${order.user.name} confirmed a transfer of ${formatNaira(order.totalPrice ?? 0)}. ` +
        'Verify it in the payment queue to release the pickup.',
      emails: cfg.emails,
      email: { subject, html },
      enabled: cfg.paymentPending,
      data: {
        orderNumber: order.orderNumber,
        orderId: order.id,
        customer: order.user.name,
        customerEmail: order.user.email,
        amount: order.totalPrice ?? null,
      },
      linkTab: 'payments',
    })
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
  totalPrice: number,
  onlineDiscountPercent = 0
): Promise<void> {
  try {
    const settings = await getAppSettings()
    const gross = Math.round(billableKg * settings.pricePerKg)
    const { subject, html } = await brandedEmail({
      category: 'invoice',
      heading: 'Your bulk invoice is ready',
      intro:
        `We weighed your items and your invoice is ready: ${billableKg}kg billable at ${formatNaira(settings.pricePerKg)}/kg${
          onlineDiscountPercent > 0
            ? ` — with your ${onlineDiscountPercent}% online-order discount applied as a registered customer`
            : ''
        }. Kindly complete the bank transfer below with your order number as the narration — your pickup/delivery is released as soon as we verify it.`,
      order,
      extraRows: [
        { label: 'Billable weight', value: `${billableKg}kg (minimum ${settings.minimumKg}kg)` },
        { label: 'Rate', value: `${formatNaira(settings.pricePerKg)}/kg` },
        ...(onlineDiscountPercent > 0
          ? [
              { label: 'Subtotal', value: formatNaira(gross) },
              {
                label: `Online order discount (${onlineDiscountPercent}%)`,
                value: `−${formatNaira(Math.round(gross * (onlineDiscountPercent / 100)))}`,
              },
            ]
          : []),
        { label: 'Amount due', value: formatNaira(totalPrice) },
        { label: 'Pay to', value: `${settings.bankName} · ${settings.accountName} · ${settings.accountNumber}` },
        { label: 'Narration', value: `#${order.orderNumber}` },
      ],
      cta: { label: 'Check payment status', url: `${baseUrl()}/payment/pending?order=${order.orderNumber}&email=${encodeURIComponent(order.user.email)}` },
    })
    await sendEmail({ to: order.user.email, subject, html })

    await sendSMS(
      order.user.phone,
      `Kozy Care: Invoice for order #${order.orderNumber} — ${billableKg}kg${
        onlineDiscountPercent > 0 ? ` less ${onlineDiscountPercent}% online discount` : ''
      }, ${formatNaira(totalPrice)}. Transfer with #${order.orderNumber} as narration. Thank you!`
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
      category: 'feedback',
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
    await deliverAdminAlert({
      type: 'FEEDBACK',
      title: `New ${typeLabel.toLowerCase()} from ${feedback.name}`,
      body: feedback.message.slice(0, 300),
      emails: cfg.emails,
      email: { subject, html },
      enabled: true,
      data: {
        feedbackType: feedback.type,
        from: feedback.name,
        fromEmail: feedback.email,
        reference: feedback.reference ?? null,
      },
      linkTab: 'feedback',
    })
  } catch (e) {
    console.error('notifyAdminNewFeedback failed:', e)
  }
}

// =============================================================================
// Phase 52 — service milestone, silent referrals, review alerts
// =============================================================================

/** A customer submitted an ORDER review (star rating + comment). The owner
 *  asked to see ALL customer feedback by email — order reviews previously
 *  reached the database silently and the owner only discovered them when a
 *  5-star review happened to go public. Fires for every rating; the intro
 *  tells the owner whether it is already on the wall or waiting. */
export async function notifyAdminNewReview(review: {
  rating: number
  comment: string
  customerName: string
  customerEmail: string
  orderNumber: string
  isApproved: boolean
}): Promise<void> {
  try {
    const cfg = await adminAlertConfig()
    const stars = '★'.repeat(Math.round(review.rating)) + '☆'.repeat(Math.max(0, 5 - Math.round(review.rating)))
    const { subject, html } = adminEmail({
      category: 'review',
      badge: 'Review',
      heading: `New review — ${stars} from ${review.customerName}`,
      intro: review.isApproved
        ? 'A delivered-order review came in at 4.5 stars or above, so it is already live on the testimonial wall (it passed the content screen automatically).'
        : 'A delivered-order review came in below 4.5 stars, so it is held for your moderation before anything shows publicly. Worth reading soon — a quiet complaint left unanswered is how premium clients slip away.',
      rows: [
        { label: 'From', value: `${review.customerName} (${review.customerEmail})` },
        { label: 'Rating', value: `${review.rating}/5` },
        { label: 'Order', value: `#${review.orderNumber}` },
        {
          label: 'Publicly visible',
          value: review.isApproved ? 'Yes — auto-approved' : 'No — awaiting moderation',
        },
        { label: 'Comment', value: review.comment },
      ],
      cta: { label: 'Open the Reviews console', url: `${baseUrl()}/admin` },
    })
    await deliverAdminAlert({
      type: 'REVIEW',
      title: `New review (${review.rating}/5) from ${review.customerName}`,
      body: review.comment.slice(0, 300),
      emails: cfg.emails,
      email: { subject, html },
      enabled: true,
      data: {
        rating: review.rating,
        from: review.customerName,
        fromEmail: review.customerEmail,
        orderNumber: review.orderNumber,
        approved: review.isApproved,
      },
      linkTab: 'reviews',
    })
  } catch (e) {
    console.error('notifyAdminNewReview failed:', e)
  }
}

/** A friend booked their first order with a customer's referral code —
 *  quiet operations alert so the owner sees the silent program working. */
export async function notifyAdminReferralRedeemed(opts: {
  code: string
  referrerName: string
  referrerEmail: string
  friendName: string
  friendEmail: string
  orderNumber: string
  friendDiscountAmount: number
}): Promise<void> {
  try {
    const cfg = await adminAlertConfig()
    const { subject, html } = adminEmail({
      category: 'referral',
      badge: 'Referral',
      heading: `Referral code ${opts.code} redeemed`,
      intro:
        'A new customer booked their first order with a personal referral code. The thank-you credit lands on the referrer\u2019s account automatically when this order is delivered — nothing for you to do, this is just so you can see it working.',
      rows: [
        { label: 'Code', value: opts.code },
        { label: 'Friend', value: `${opts.friendName} (${opts.friendEmail})` },
        { label: 'Order', value: `#${opts.orderNumber}` },
        { label: 'Courtesy given', value: formatNaira(opts.friendDiscountAmount) },
        { label: 'Referred by', value: `${opts.referrerName} (${opts.referrerEmail})` },
      ],
      cta: { label: 'Open the Orders board', url: `${baseUrl()}/admin` },
    })
    await deliverAdminAlert({
      type: 'REFERRAL_REDEEMED',
      title: `Referral ${opts.code} redeemed by ${opts.friendName}`,
      body: `${opts.friendName} booked a first order with ${opts.referrerName}'s code (${opts.code}) — courtesy ${formatNaira(opts.friendDiscountAmount)}.`,
      emails: cfg.emails,
      email: { subject, html },
      enabled: true,
      data: {
        code: opts.code,
        friend: opts.friendName,
        referrer: opts.referrerName,
        orderNumber: opts.orderNumber,
      },
      linkTab: 'kanban',
    })
  } catch (e) {
    console.error('notifyAdminReferralRedeemed failed:', e)
  }
}

/** The ten-service milestone email — appreciation + the loyalty reveal
 *  ("after 10 washes, the 11th is free") + a general (relationship-level)
 *  feedback ask. Premium tone throughout; the reasoning behind the timing
 *  stays internal. Phase 53: the reveal switched from the (now dormant)
 *  referral code to the complimentary next service. */
export async function notifyMilestoneReached(opts: {
  to: string
  name: string
  paidWashes: number
  token: string
}): Promise<void> {
  try {
    const first = opts.name.split(' ')[0] || 'there'
    const countWord = opts.paidWashes === 10 ? 'Ten' : String(opts.paidWashes)
    const milestoneUrl = `${baseUrl()}/milestone?token=${encodeURIComponent(opts.token)}`
    const subject = `[Kozy Care · Loyalty] ${countWord} services — your next one is on us`
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
            <h2 style="color: #0A192F; font-family: Georgia, serif; font-size: 22px; margin: 0 0 16px 0;">A quiet thank-you, ${first}.</h2>
            <p style="color: #6F88A8; line-height: 1.7; font-size: 15px; margin: 0 0 18px 0;">
              ${countWord} services now. The suits, the shirts, the household pieces — entrusted to us again and again.
              That kind of consistency is the truest compliment a care service can receive, and we do not take it lightly.
            </p>
            <div style="margin: 24px 0; padding: 20px 24px; background: #F7F0DC; border: 1px solid #E3BE4F; border-radius: 12px; text-align: center;">
              <p style="color: #0A192F; font-family: Georgia, serif; font-size: 17px; font-weight: 700; margin: 0 0 6px 0;">The next one is on us</p>
              <p style="color: #6F88A8; line-height: 1.6; font-size: 14px; margin: 0;">
                Your next service is complimentary — our way of marking ten. Nothing to remember and nothing to type:
                it applies itself the next time you book a pickup.
              </p>
            </div>
            <p style="color: #6F88A8; line-height: 1.7; font-size: 15px; margin: 0 0 24px 0;">
              We would also love to hear how the whole experience has felt — not about one order, but the relationship itself:
              what stands out, and where we could serve you even better. Two minutes, and it goes straight to the people
              who make the decisions.
            </p>
            <div style="text-align: center; margin: 28px 0 8px 0;">
              <a href="${milestoneUrl}" style="display: inline-block; background: linear-gradient(135deg, #E3BE4F, #D4AF37, #B8962B); color: #0A192F; padding: 14px 32px; border-radius: 9999px; text-decoration: none; font-weight: 700; font-size: 15px; box-shadow: 0 4px 14px rgba(212,175,55,0.35);">Share your thoughts</a>
            </div>
            <p style="color: #6F88A8; font-size: 12px; margin: 12px 0 0 0; line-height: 1.5;">Or paste this link into your browser:<br><span style="color: #0A192F; word-break: break-all;">${milestoneUrl}</span></p>
            <p style="color: #6F88A8; font-size: 11px; margin: 32px 0 0 0; border-top: 1px solid #E2E5E9; padding-top: 16px; line-height: 1.6;">
              Kozy Care — Uncompromising care. Exceptional convenience.
            </p>
          </div>
        </div>
      </body>
      </html>`
    await sendEmail({ to: opts.to, subject, html })
  } catch (e) {
    console.error('notifyMilestoneReached failed:', e)
  }
}

/** The friend's first referred order was delivered — the referrer's
 *  thank-you credit has landed. Quiet, factual, gratitude-shaped. */
export async function notifyReferralRewardGranted(opts: {
  to: string
  referrerName: string
  friendName: string
  amount: number
}): Promise<void> {
  try {
    const first = opts.referrerName.split(' ')[0] || 'there'
    const friendFirst = opts.friendName.split(' ')[0] || 'a friend'
    const subject = '[Kozy Care · Loyalty] A thank-you is on your account'
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
            <h2 style="color: #0A192F; font-family: Georgia, serif; font-size: 22px; margin: 0 0 16px 0;">A small thank-you, ${first}.</h2>
            <p style="color: #6F88A8; line-height: 1.7; font-size: 15px; margin: 0 0 18px 0;">
              ${friendFirst} booked with your code, and their first order was delivered today. Because it came from you,
              a ${formatNaira(opts.amount)} thank-you credit is now on your account.
            </p>
            <p style="color: #6F88A8; line-height: 1.7; font-size: 15px; margin: 0 0 24px 0;">
              There is nothing to remember and nothing to type — it applies automatically the next time you book a pickup.
            </p>
            <div style="text-align: center; margin: 28px 0 8px 0;">
              <a href="${baseUrl()}/portal" style="display: inline-block; background: linear-gradient(135deg, #E3BE4F, #D4AF37, #B8962B); color: #0A192F; padding: 14px 32px; border-radius: 9999px; text-decoration: none; font-weight: 700; font-size: 15px; box-shadow: 0 4px 14px rgba(212,175,55,0.35);">Book your next pickup</a>
            </div>
            <p style="color: #6F88A8; font-size: 11px; margin: 32px 0 0 0; border-top: 1px solid #E2E5E9; padding-top: 16px; line-height: 1.6;">
              Kozy Care — Uncompromising care. Exceptional convenience.
            </p>
          </div>
        </div>
      </body>
      </html>`
    await sendEmail({ to: opts.to, subject, html })
  } catch (e) {
    console.error('notifyReferralRewardGranted failed:', e)
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
      category: 'rider',
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
    await deliverAdminAlert({
      type: 'RIDER_APPLICATION',
      title: `${app.fullName} applied to ride for Kozy`,
      body: `${app.phone}${app.altPhone ? ` / ${app.altPhone}` : ''} · ${app.lga} · ${app.bikeModel} (${app.bikeYear})`,
      emails: cfg.emails,
      email: { subject, html },
      enabled: true,
      data: {
        name: app.fullName,
        phone: app.phone,
        altPhone: app.altPhone ?? null,
        email: app.email ?? null,
        lga: app.lga,
      },
      linkTab: 'help',
    })
  } catch (e) {
    console.error('notifyAdminRiderApplication failed:', e)
  }
}

// =============================================================================
// RIDER ONBOARDING emails (phase 54)
// =============================================================================
// The owner commissioned riders offline and pointed them at the business
// directly — applicants were emailing staff inboxes with no system behind
// it. Phase 54 turns /join-riders into a real pipeline: the applicant now
// gets an immediate confirmation (email + SMS) with a reference code, and
// an approval email that carries their rider-app credentials and the
// onboarding steps, so "how do I actually start riding?" has an answer.

/** 1) Application received — sent to the APPLICANT right after they submit.
 *  Email only when they gave one; SMS always (Nigerian riders live on their
 *  phones — email is optional on the form). Never throws. */
export async function notifyRiderApplicationReceived(app: {
  fullName: string
  email?: string | null
  phone: string
  lga: string
  refCode: string
}): Promise<void> {
  try {
    // (No phone number is quoted in this email — which office or line makes
    // the review call may change as the team grows, and naming a specific
    // number at this early stage only creates confusion or mistrust when a
    // different line calls.)
    const firstName = app.fullName.split(' ')[0]

    if (app.email) {
      const bodyHtml = `
        <p style="color: #6F88A8; line-height: 1.6; font-size: 15px; margin: 0 0 20px 0;">
          Thank you for applying to ride with Kozy Care, <strong style="color:#0A192F;">${firstName}</strong>.
          Your application is in our review queue — here is what happens next:
        </p>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 8px 0; color: #6F88A8; width: 150px; vertical-align: top; border-bottom: 1px solid #F0F2F5;">Your reference</td>
            <td style="padding: 8px 0; color: #0A192F; font-weight: 600; border-bottom: 1px solid #F0F2F5;"><code style="background:#F8F9FA; padding:2px 6px; border-radius:4px; font-family:monospace; font-size:13px;">${app.refCode}</code></td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6F88A8; vertical-align: top; border-bottom: 1px solid #F0F2F5;">Step 1 — Review</td>
            <td style="padding: 8px 0; color: #0A192F; border-bottom: 1px solid #F0F2F5;">We review applications within <strong>48 hours</strong> (Mon–Sat).</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6F88A8; vertical-align: top; border-bottom: 1px solid #F0F2F5;">Step 2 — Call</td>
            <td style="padding: 8px 0; color: #0A192F; border-bottom: 1px solid #F0F2F5;">A short call from <strong>our team</strong> to talk availability, your bike and your area (${app.lga}).</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6F88A8; vertical-align: top;">Step 3 — Welcome</td>
            <td style="padding: 8px 0; color: #0A192F;">If it's a fit, you'll receive your rider-app sign-in by email and your first route follows.</td>
          </tr>
        </table>
        <p style="color: #6F88A8; line-height: 1.6; font-size: 13px; margin: 24px 0 0 0;">
          Keep your phone close — the review call is how every rider starts. Nothing is needed from you until then.
        </p>`

      const { subject, html } = staffEmailChrome({
        category: 'rider',
        heading: `Application received — ${firstName}`,
        bodyHtml,
        cta: undefined,
        footer: 'This is an application confirmation, not a contract of employment.<br>Kozy Care — Uncompromising care. Exceptional convenience.',
      })
      await sendEmail({ to: app.email, subject, html })
    }

    await sendSMS(
      app.phone,
      `Kozy Care: Application received (${app.refCode}). We'll call you within 48 hours (Mon-Sat) about riding in ${app.lga}. Keep your phone close.`
    )
  } catch (e) {
    console.error('notifyRiderApplicationReceived failed:', e)
  }
}

/** 2) Application approved — the WELCOME email: rider-app credentials +
 *  the four onboarding steps. Same recipe as the staff invite (system
 *  generates the password, rider sets their own at first sign-in) plus
 *  rider-specific "how the job works" guidance. Returns the delivery
 *  outcome so the API can tell the admin whether the email landed. */
export async function notifyRiderApproved(opts: {
  to: string
  name: string
  password: string
  managerName: string
  refCode: string
  lga: string
  note?: string
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const { to, name, password, managerName, refCode, lga, note } = opts
    const loginUrl = `${baseUrl()}/login?email=${encodeURIComponent(to)}`
    const firstName = name.split(' ')[0]

    const bodyHtml = `
        <p style="color: #6F88A8; line-height: 1.6; font-size: 15px; margin: 0 0 20px 0;">
          Good news, <strong style="color:#0A192F;">${firstName}</strong> — your Kozy Care rider application (${refCode}) is approved.
          Welcome to the team. Your rider app is ready: sign in below and your route screen appears the moment the team assigns you a pickup or delivery.
        </p>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 8px 0; color: #6F88A8; width: 150px; vertical-align: top; border-bottom: 1px solid #F0F2F5;">Sign-in email</td>
            <td style="padding: 8px 0; color: #0A192F; font-weight: 600; border-bottom: 1px solid #F0F2F5;">${to}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6F88A8; vertical-align: top; border-bottom: 1px solid #F0F2F5;">Initial password</td>
            <td style="padding: 8px 0; color: #0A192F; font-weight: 600; border-bottom: 1px solid #F0F2F5;"><code style="background:#F8F9FA; padding:2px 6px; border-radius:4px; font-family:monospace; font-size:13px;">${password}</code></td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6F88A8; vertical-align: top;">Your area</td>
            <td style="padding: 8px 0; color: #0A192F;">${lga}</td>
          </tr>
        </table>
        <p style="color: #6F88A8; line-height: 1.6; font-size: 14px; margin: 20px 0 0 0;"><strong style="color:#0A192F;">How your first week works:</strong></p>
        <ol style="color: #0A192F; font-size: 14px; line-height: 1.7; margin: 8px 0 0 0; padding-left: 20px;">
          <li>Sign in with the button below — the app will ask you to choose your own password.</li>
          <li>Keep your phone's location ON while on duty; your route list updates automatically.</li>
          <li>Each stop shows the address, a Navigate button and the customer's phone — call them when you arrive.</li>
          <li>Swipe to confirm every pickup and delivery. That confirmation is what moves the customer's order along.</li>
        </ol>
        ${
          note
            ? `<div style="margin: 20px 0 0 0; padding: 14px 16px; background: #F8F9FA; border-left: 3px solid #D4AF37; border-radius: 4px;">
                 <p style="color: #0A192F; font-size: 14px; margin: 0; line-height: 1.6;"><strong>Message from ${managerName}:</strong><br>${note}</p>
               </div>`
            : ''
        }
        <p style="color: #6F88A8; line-height: 1.6; font-size: 13px; margin: 24px 0 0 0;">
          Ride safe — you are the face of Kozy Care at every door. Keep this email private until you have set your own password. Support: ${await supportLine()}.
        </p>`

    const { subject, html } = staffEmailChrome({
      category: 'rider',
      heading: `Welcome to the rider team, ${firstName}!`,
      bodyHtml,
      cta: { label: 'Open the rider app', url: loginUrl },
    })

    await sendEmail({ to, subject, html })
    return { ok: true }
  } catch (e: any) {
    console.error('Rider welcome email failed:', e)
    return { ok: false, error: e?.message ?? 'unknown error' }
  }
}

/** The contact line for rider-facing emails (settings value, with a sane
 *  fallback so the copy never renders an empty string). */
async function supportLine(): Promise<string> {
  try {
    const { contactPhone } = await getAppSettings()
    return contactPhone || '+234 803 175 5230'
  } catch {
    return '+234 803 175 5230'
  }
}

// =============================================================================
// RIDER INCIDENT alerts (phase 55) — the "what if a rider steals, damages
// or misplaces the items?" backbone
// =============================================================================
// The rider app's Report-a-problem button posts an incident (damage / loss /
// theft / accident). The whole point is SPEED + AUDIT TRAIL: the moment a
// rider reports, (1) the admins get an urgent alert email, (2) the incident
// lands in the notifications feed with the order + rider attached, and
// (3) a StatusEvent note records it on the order timeline. A late or hidden
// incident is how a small problem becomes an unresolvable dispute — this
// pipeline makes "report it immediately" the easiest path for the rider.
export async function notifyRiderIncident(incident: {
  orderNumber: string
  orderId: string
  riderName: string
  riderPhone: string
  customerName: string
  customerPhone: string
  kind: string
  description: string
  atStop: string
}): Promise<void> {
  try {
    const cfg = await adminAlertConfig()
    const kindLabel: Record<string, string> = {
      // Phase 56 wording: what the ADMIN needs to know at a glance is that
      // something was REPORTED (and what class of problem it is) — the
      // specifics of what was affected live in the report body. "Damaged
      // garment(s)" read awkwardly and aged badly; these read as actions.
      DAMAGE: 'Damage reported',
      LOSS: 'Loss reported',
      THEFT: 'Theft reported',
      ACCIDENT: 'Accident reported',
      OTHER: 'Problem reported',
    }
    const { subject, html } = adminEmail({
      category: 'incident',
      badge: 'Rider incident — action needed',
      heading: `${kindLabel[incident.kind] ?? 'Incident'} on order #${incident.orderNumber}`,
      intro:
        'A rider reported a problem mid-route. Incidents are time-sensitive: speak to the rider, check the order timeline, and decide the customer remedy (re-clean, replacement, guarantee claim or refund) before the delivery window closes. The full report is below — it is also on the order timeline.',
      rows: [
        { label: 'Rider', value: `${incident.riderName} · ${incident.riderPhone}` },
        { label: 'Customer', value: `${incident.customerName} · ${incident.customerPhone}` },
        { label: 'Order', value: `#${incident.orderNumber}` },
        { label: 'Stop', value: incident.atStop },
        { label: 'Reported', value: new Date().toLocaleString('en-NG') },
        { label: 'What happened', value: incident.description },
      ],
      cta: { label: 'Open the order', url: `${baseUrl()}/admin` },
    })
    await deliverAdminAlert({
      type: 'RIDER_INCIDENT',
      title: `${kindLabel[incident.kind] ?? 'Incident'} reported on #${incident.orderNumber}`,
      body: `${incident.riderName} reported ${incident.kind.toLowerCase()} at ${incident.atStop} — "${incident.description.slice(0, 140)}${incident.description.length > 140 ? '…' : ''}"`,
      emails: cfg.emails,
      email: { subject, html },
      enabled: true,
      data: {
        orderId: incident.orderId,
        orderNumber: incident.orderNumber,
        riderName: incident.riderName,
        kind: incident.kind,
      },
      linkTab: 'kanban',
    })
  } catch (e) {
    console.error('notifyRiderIncident failed:', e)
  }
}

/** Manual delivery check — the "Send test email" button in Settings →
 * Notifications. Sends to every configured recipient and records the result
 * so the owner can instantly see whether alerts reach each inbox (and, if
 * not, whether the send failed or the email was accepted but filtered). */
export async function notifyAdminTestEmails(): Promise<{
  recipients: string[]
  results: RecipientResult[]
}> {
  const cfg = await adminAlertConfig()
  const { subject, html } = adminEmail({
    category: 'test',
    badge: 'Test alert',
    heading: 'This is a test alert — delivery check',
    intro:
      'You asked for a test from Settings → Notifications. If this landed in your inbox, admin alerts are reaching this address. If it landed in SPAM, open it and click "Not spam" (and add the sender to your contacts) — that trains your provider to deliver future signup, order and payment alerts.',
    rows: [
      { label: 'Recipients', value: cfg.emails.join(', ') || 'none configured' },
      { label: 'Sent at', value: new Date().toLocaleString('en-NG') },
    ],
    cta: { label: 'Open the Notifications feed', url: `${baseUrl()}/admin` },
  })

  // Test sends always attempt delivery (they are explicitly requested), and
  // the per-recipient outcome is returned to the Settings UI live.
  let results: RecipientResult[] = []
  try {
    results = await Promise.all(
      cfg.emails.map(async (to): Promise<RecipientResult> => {
        try {
          await sendEmail({ to, subject, html })
          return { to, ok: true }
        } catch (e: unknown) {
          return { to, ok: false, error: e instanceof Error ? e.message : String(e) }
        }
      })
    )
  } catch (e) {
    console.error('notifyAdminTestEmails failed:', e)
  }

  const status: NotificationEmailStatus =
    results.length === 0
      ? 'FAILED'
      : results.every((r) => r.ok)
        ? 'SENT'
        : results.some((r) => r.ok)
          ? 'PARTIAL'
          : 'FAILED'

  try {
    await db.notificationEvent.create({
      data: {
        type: 'TEST',
        title: 'Test alert sent from Settings',
        body:
          results.length === 0
            ? 'No valid alert recipients are configured.'
            : results.map((r) => `${r.to}: ${r.ok ? 'accepted by email provider' : 'FAILED — ' + (r.error ?? 'unknown error')}`).join(' · '),
        recipients: JSON.stringify(cfg.emails),
        emailStatus: status,
        emailDetail: JSON.stringify({ attempted: cfg.emails, results }),
        linkTab: 'settings',
      },
    })
  } catch (e) {
    console.error('Test NotificationEvent create failed:', e)
  }

  return { recipients: cfg.emails, results }
}

// =============================================================================
// STAFF-ACCESS emails (phase 31)
// =============================================================================
// Super admins invite staff from the console's Staff tab; the account's
// initial password is set by the admin and delivered by email. These emails
// never throw — a failed send is reported to the API caller so the admin can
// hand the credentials over manually instead of silently losing them.

/** Shared brand chrome for staff emails (same look as the customer emails). */
function staffEmailChrome(opts: {
  category: string
  heading: string
  bodyHtml: string
  cta?: { label: string; url: string }
  footer?: string
}): { subject: string; html: string } {
  const { category, heading, bodyHtml, cta, footer } = opts
  const subject = `[Kozy Care · ${categoryTag(category)}] ${heading}`
  const html = `
  <!DOCTYPE html>
  <html>
  <body style="font-family: Georgia, serif; background: #F8F9FA; padding: 40px 0; margin: 0;">
    <div style="max-width: 520px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(10,25,47,0.08);">
      <div style="background: linear-gradient(135deg, #0A192F, #102740); padding: 32px 40px; text-align: center;">
        <h1 style="color: #D4AF37; font-family: Georgia, serif; font-size: 28px; font-weight: 700; margin: 0;">Kozy Care</h1>
        <p style="color: rgba(255,255,255,0.7); font-size: 11px; text-transform: uppercase; letter-spacing: 2px; margin: 4px 0 0 0;">Drycleaning &amp; Laundry · Staff Console</p>
      </div>
      <div style="padding: 40px;">
        <h2 style="color: #0A192F; font-family: Georgia, serif; font-size: 22px; margin: 0 0 16px 0;">${heading}</h2>
        ${bodyHtml}
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
            'This is an automated message from the Kozy Care staff console.<br>Kozy Care — Uncompromising care. Exceptional convenience.'
          }
        </p>
      </div>
    </div>
  </body>
  </html>`
  return { subject, html }
}

/**
 * Invite / credentials email for a staff member. Returns the delivery
 * outcome so the API can tell the admin exactly what happened (the
 * password MUST reach the staff member one way or another).
 */
export async function notifyStaffInvite(opts: {
  to: string
  name: string
  password: string
  managerName: string
  note?: string
  isReset?: boolean
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const { to, name, password, managerName, note, isReset } = opts
    const loginUrl = `${baseUrl()}/login?email=${encodeURIComponent(to)}`
    const firstName = name.split(' ')[0]

    const bodyHtml = `
        <p style="color: #6F88A8; line-height: 1.6; font-size: 15px; margin: 0 0 20px 0;">
          ${isReset ? `Your Kozy Care staff password has been reset by <strong style="color:#0A192F;">${managerName}</strong>.` : `You have been added to the Kozy Care team by <strong style="color:#0A192F;">${managerName}</strong>.`} Sign in to the operations console to manage orders, payments and customers.
        </p>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 8px 0; color: #6F88A8; width: 140px; vertical-align: top; border-bottom: 1px solid #F0F2F5;">Sign-in email</td>
            <td style="padding: 8px 0; color: #0A192F; font-weight: 600; border-bottom: 1px solid #F0F2F5;">${to}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6F88A8; vertical-align: top; border-bottom: 1px solid #F0F2F5;">${isReset ? 'New password' : 'Initial password'}</td>
            <td style="padding: 8px 0; color: #0A192F; font-weight: 600; border-bottom: 1px solid #F0F2F5;"><code style="background:#F8F9FA; padding:2px 6px; border-radius:4px; font-family:monospace; font-size:13px;">${password}</code></td>
          </tr>
        </table>
        ${
          note
            ? `<div style="margin: 20px 0 0 0; padding: 14px 16px; background: #F8F9FA; border-left: 3px solid #D4AF37; border-radius: 4px;">
                 <p style="color: #0A192F; font-size: 14px; margin: 0; line-height: 1.6;"><strong>Message from ${managerName}:</strong><br>${note}</p>
               </div>`
            : ''
        }
        <p style="color: #6F88A8; line-height: 1.6; font-size: 13px; margin: 24px 0 0 0;">
          <strong style="color: #0A192F;">After your first sign-in,</strong> the console will ask you to choose your own password — keep this email private until then, because it is the only place this password appears. This is an operational account message (not marketing).
        </p>`

    const { subject, html } = staffEmailChrome({
      category: 'team',
      heading: isReset ? `New password, ${firstName}` : `Welcome to the team, ${firstName}!`,
      bodyHtml,
      cta: { label: 'Open the staff console', url: loginUrl },
    })

    await sendEmail({ to, subject, html })
    return { ok: true }
  } catch (e: any) {
    console.error('Staff invite email failed:', e)
    return { ok: false, error: e?.message ?? 'unknown error' }
  }
}

/** "Your access is back on" email (un-pause). Never throws. */
export async function notifyStaffAccessRestored(opts: {
  to: string
  name: string
  managerName: string
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const { to, name, managerName } = opts
    const loginUrl = `${baseUrl()}/login?email=${encodeURIComponent(to)}`
    const firstName = name.split(' ')[0]
    const bodyHtml = `
        <p style="color: #6F88A8; line-height: 1.6; font-size: 15px; margin: 0 0 20px 0;">
          Your access to the Kozy Care operations console has been restored by <strong style="color:#0A192F;">${managerName}</strong>. You can sign in and pick up where you left off — your password is unchanged.
        </p>`
    const { subject, html } = staffEmailChrome({
      category: 'team',
      heading: `Your access is back on, ${firstName}`,
      bodyHtml,
      cta: { label: 'Sign in', url: loginUrl },
    })
    await sendEmail({ to, subject, html })
    return { ok: true }
  } catch (e: any) {
    console.error('Staff access-restored email failed:', e)
    return { ok: false, error: e?.message ?? 'unknown error' }
  }
}

/** Log a staff-management event to the admin operations feed (never throws). */
export async function logStaffEvent(opts: {
  type: 'STAFF_INVITE' | 'RIDER_DECISION' | 'RIDER_PAYOUT' | 'PARTNER_DECISION' | 'PARTNER_SETTLEMENT'
  title: string
  body: string
  staffEmail: string
  emailStatus: NotificationEmailStatus
  detail?: Record<string, unknown>
  /** Console tab the event deep-links to (phase 54: rider decisions open
   *  the Riders tab instead of Staff). Defaults to 'staff'. */
  linkTab?: string
}): Promise<void> {
  try {
    await db.notificationEvent.create({
      data: {
        type: opts.type,
        title: opts.title,
        body: opts.body,
        data: JSON.stringify({ staffEmail: opts.staffEmail, ...opts.detail }),
        recipients: JSON.stringify([opts.staffEmail]),
        emailStatus: opts.emailStatus,
        emailDetail: opts.detail ? JSON.stringify(opts.detail) : undefined,
        linkTab: opts.linkTab ?? 'staff',
      },
    })
  } catch (e) {
    console.error('Staff NotificationEvent create failed:', e)
  }
}

// =============================================================================
// MEMBERSHIPS (phase 62) — The Kozy Circle notifications
// =============================================================================
// Same taxonomy as everything else: [Kozy Care Ops · Membership] for the
// admin inbox, [Kozy Care · Membership] for the member. Every function
// never-throws, exactly like the order notifications above.

/** A customer just joined (payment still pending) — admin alert. */
export async function notifyAdminNewSubscription(opts: {
  user: { name: string; email: string; phone: string }
  plan: { name: string; code: string; priceMonthly: number }
  paymentMethod: string
  subscriptionId: string
}): Promise<void> {
  try {
    const cfg = await adminAlertConfig()
    const { subject, html } = adminEmail({
      category: 'membership',
      badge: 'New membership',
      heading: `${opts.user.name} joined ${opts.plan.name}`,
      intro:
        opts.paymentMethod === 'PAYSTACK'
          ? 'A new Kozy Circle member paid by card — the membership activates itself the moment Paystack confirms the charge.'
          : 'A new Kozy Circle member chose bank transfer. Verify the receipt in Memberships → Subscribers to activate their month.',
      rows: [
        { label: 'Member', value: opts.user.name },
        { label: 'Email', value: opts.user.email },
        { label: 'Phone', value: opts.user.phone },
        { label: 'Plan', value: `${opts.plan.name} (${opts.plan.code})` },
        { label: 'Monthly', value: formatNaira(opts.plan.priceMonthly) },
        { label: 'Payment', value: opts.paymentMethod === 'PAYSTACK' ? 'Paystack (card)' : 'Bank transfer — awaiting receipt/verification' },
      ],
      // Task 82: the CTA lands DIRECTLY on the Members tab — never a bare
      // dashboard dump that still needs a second click.
      cta: { label: 'Open Memberships', url: `${baseUrl()}/admin?tab=memberships` },
    })
    await deliverAdminAlert({
      type: 'SUBSCRIPTION',
      title: `${opts.user.name} joined ${opts.plan.name}`,
      body: `${formatNaira(opts.plan.priceMonthly)}/mo · ${opts.paymentMethod === 'PAYSTACK' ? 'card' : 'transfer pending'}`,
      emails: cfg.emails,
      email: { subject, html },
      enabled: cfg.newOrder,
      data: { planCode: opts.plan.code, userEmail: opts.user.email, subscriptionId: opts.subscriptionId },
      linkTab: 'memberships',
    })
  } catch (e) {
    console.error('notifyAdminNewSubscription failed:', e)
  }
}

/** The membership is LIVE (transfer verified or card charged) — member email. */
export async function notifyMembershipActive(opts: {
  user: { name: string; email: string }
  planName: string
  pricePaid: number
  periodEnd: Date
  unitName: string
  includedUnits: number
  /** Phase 76: a multi-month prepay covers several cycles — the email says
   *  so plainly ("your next 3 months are covered" instead of a silent
   *  far-future date). Defaults to 1. */
  months?: number
}): Promise<void> {
  try {
    const firstName = opts.user.name.split(' ')[0]
    const months = Math.min(Math.max(Math.round(opts.months ?? 1), 1), 12)
    const covered =
      months > 1
        ? `Your next <strong style="color:#0A192F;">${months} months</strong> are covered — <strong style="color:#0A192F;">${formatNaira(opts.pricePaid)}</strong> for the whole stretch.`
        : `Paid: <strong style="color:#0A192F;">${formatNaira(opts.pricePaid)}</strong>.`
    const bodyHtml = `
      <p style="color: #6F88A8; line-height: 1.6; font-size: 15px; margin: 0 0 20px 0;">
        Welcome to the Kozy Circle, <strong style="color:#0A192F;">${firstName}</strong>.
        Your <strong style="color:#0A192F;">${opts.planName}</strong> membership is active — here is your month at a glance:
      </p>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr>
          <td style="padding: 8px 0; color: #6F88A8; width: 150px; vertical-align: top; border-bottom: 1px solid #F0F2F5;">Your month${months > 1 ? 's' : ''}</td>
          <td style="padding: 8px 0; color: #0A192F; border-bottom: 1px solid #F0F2F5;">Active until <strong>${fmtDate(opts.periodEnd)}</strong> (renews automatically unless you cancel).</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6F88A8; vertical-align: top; border-bottom: 1px solid #F0F2F5;">Included</td>
          <td style="padding: 8px 0; color: #0A192F; border-bottom: 1px solid #F0F2F5;"><strong>${opts.includedUnits} × ${opts.unitName}</strong> pickups — book each week from your portal, one tap.</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #6F88A8; vertical-align: top;">Your kit</td>
          <td style="padding: 8px 0; color: #0A192F;">Your rider hands over the ${opts.unitName} at your first pickup. Fill it, leave the counting to us.</td>
        </tr>
      </table>
      <p style="color: #6F88A8; line-height: 1.6; font-size: 13px; margin: 24px 0 0 0;">
        ${covered} Manage everything from the Membership tab in your portal.
      </p>`
    const { subject, html } = staffEmailChrome({
      category: 'membership',
      heading: `Your ${opts.planName} membership is live`,
      bodyHtml,
      cta: { label: 'Book your first pickup', url: `${baseUrl()}/portal` },
      footer: 'Kozy Care — Uncompromising care. Exceptional convenience.',
    })
    await sendEmail({ to: opts.user.email, subject, html })
  } catch (e) {
    console.error('notifyMembershipActive failed:', e)
  }
}

/** The member set cancel-at-period-end — confirmation email (no guilt trips). */
export async function notifyMembershipCancelled(opts: {
  user: { name: string; email: string }
  planName: string
  periodEnd: Date | null
}): Promise<void> {
  try {
    const firstName = opts.user.name.split(' ')[0]
    const until = opts.periodEnd ? fmtDate(opts.periodEnd) : 'the end of your paid month'
    const bodyHtml = `
      <p style="color: #6F88A8; line-height: 1.6; font-size: 15px; margin: 0 0 20px 0;">
        Done, <strong style="color:#0A192F;">${firstName}</strong> — your <strong style="color:#0A192F;">${opts.planName}</strong> membership will not renew.
      </p>
      <p style="color: #6F88A8; line-height: 1.6; font-size: 15px; margin: 0 0 12px 0;">
        Everything stays exactly as it is until <strong style="color:#0A192F;">${until}</strong> — your remaining pickups, your perks, your priority slots. Nothing stops early.
      </p>
      <p style="color: #6F88A8; line-height: 1.6; font-size: 13px; margin: 24px 0 0 0;">
        Changed your mind? One tap in your portal's Membership tab undoes this before the month ends. And when your ${opts.planName} is returned at your final delivery, that closes the chapter properly.
      </p>`
    const { subject, html } = staffEmailChrome({
      category: 'membership',
      heading: `Your membership will not renew`,
      bodyHtml,
      cta: { label: 'Reconsider', url: `${baseUrl()}/portal` },
      footer: 'Kozy Care — Uncompromising care. Exceptional convenience.',
    })
    await sendEmail({ to: opts.user.email, subject, html })
  } catch (e) {
    console.error('notifyMembershipCancelled failed:', e)
  }
}

// =============================================================================
// MEMBERSHIP RETENTION (phase 75) — the office-triggered nudges
// =============================================================================
// Two one-click emails from the admin drill-down (no cron, no spam):
//   • USAGE nudge — an at-risk member sitting on an unused allowance.
//   • RENEWAL reminder — a transfer member whose month is about to end.
// =============================================================================

/** Task 82 — the stuck-signup recovery email. A member whose FIRST payment
 *  never landed gets ONE calm note pointing at the payment waiting in their
 *  portal (the deep link lands on the banner). Frequency-capped by the sweep
 *  (3-day grace, then at most every 14 days, max 3 per request) — this
 *  template is the whole email; it never references anything but the
 *  member's own request and their payment. */
export async function notifyMembershipFirstPaymentNudge(opts: {
  user: { name: string; email: string }
  planName: string
  priceMonthly: number
  family: 'KIT' | 'SHOES'
  payUrl: string
  contactPhone: string
}): Promise<void> {
  try {
    const firstName = opts.user.name.split(' ')[0]
    const isClub = opts.family === 'SHOES'
    const { subject, html } = memberEmailChrome({
      category: 'membership',
      heading: `Your ${opts.planName} is waiting for its first payment`,
      bodyHtml: `
      <p style="color: #6F88A8; line-height: 1.6; font-size: 15px; margin: 0 0 20px 0;">
        <strong style="color:#0A192F;">${firstName}</strong>, we received your ${opts.planName} request — and it starts
        the moment your first month is paid. Nothing has been charged and nothing is running yet.
      </p>
      <p style="color: #6F88A8; line-height: 1.6; font-size: 15px; margin: 0 0 12px 0;">
        Your payment is waiting in your portal, ready where you left it: one month at
        <strong style="color:#0A192F;">${formatNaira(opts.priceMonthly)}</strong> by bank transfer
        ${isClub ? '— and your pairs start coming back fresh the week it is confirmed' : '— and your first collection follows the moment it is confirmed'}.
      </p>
      <p style="color: #6F88A8; line-height: 1.7; font-size: 13px; margin: 12px 0 0 0;">
        Rather start over or pick a different plan? The same page lets you change it — or call
        <strong style="color:#0A192F;">${opts.contactPhone}</strong> and the office will sort it out in one call.
      </p>`,
      ctas: [
        {
          label: `Complete your first payment — ${formatNaira(opts.priceMonthly)}`,
          url: opts.payUrl,
          variant: 'gold',
        },
      ],
      footer:
        'You receive this because your membership request has not been paid yet.<br>Kozy Care — Uncompromising care. Exceptional convenience.',
    })
    await sendEmail({ to: opts.user.email, subject, html })
  } catch (e) {
    console.error('notifyMembershipFirstPaymentNudge failed:', e)
  }
}

/** "Your pickups are waiting" — sent to members flagged UNUSED_RISK / NO_USAGE_DATA. */
export async function notifyMembershipUsageNudge(opts: {
  user: { name: string; email: string }
  planName: string
  unitName: string
  unitsRemaining: number
  periodEnd: Date
}): Promise<void> {
  try {
    const firstName = opts.user.name.split(' ')[0]
    const days = Math.max(
      1,
      Math.ceil((opts.periodEnd.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
    )
    const bodyHtml = `
      <p style="color: #6F88A8; line-height: 1.6; font-size: 15px; margin: 0 0 20px 0;">
        <strong style="color:#0A192F;">${firstName}</strong>, your ${opts.unitName} pickups are waiting —
        <strong style="color:#0A192F;">${opts.unitsRemaining}</strong> still included on your ${opts.planName},
        and ${days} day${days === 1 ? '' : 's'} of your month remain.
      </p>
      <p style="color: #6F88A8; line-height: 1.6; font-size: 15px; margin: 0 0 12px 0;">
        A full bag is a booking away — one tap in your portal and your rider collects at your usual window.
        Unused pickups don't roll over, so send the bag out while the month is still yours.
      </p>`
    const { subject, html } = staffEmailChrome({
      category: 'membership',
      heading: `Your ${opts.unitName} pickups are waiting`,
      bodyHtml,
      cta: { label: 'Book your next pickup', url: `${baseUrl()}/portal` },
      footer: 'Kozy Care — Uncompromising care. Exceptional convenience.',
    })
    await sendEmail({ to: opts.user.email, subject, html })
  } catch (e) {
    console.error('notifyMembershipUsageNudge failed:', e)
  }
}

/** "Your month renews on X" — for transfer members nearing period end. */
export async function notifyMembershipRenewalReminder(opts: {
  user: { name: string; email: string }
  planName: string
  priceMonthly: number
  periodEnd: Date
}): Promise<void> {
  try {
    const firstName = opts.user.name.split(' ')[0]
    const bodyHtml = `
      <p style="color: #6F88A8; line-height: 1.6; font-size: 15px; margin: 0 0 20px 0;">
        <strong style="color:#0A192F;">${firstName}</strong>, your <strong style="color:#0A192F;">${opts.planName}</strong>
        month runs to <strong style="color:#0A192F;">${fmtDate(opts.periodEnd)}</strong> — a quick note so it renews
        without a hitch.
      </p>
      <p style="color: #6F88A8; line-height: 1.6; font-size: 15px; margin: 0 0 12px 0;">
        Renewal is <strong style="color:#0A192F;">${formatNaira(opts.priceMonthly)}</strong> for the next month of
        pickups. Card members renew automatically — nothing to do. Transfer members: send the renewal before the
        last day and the office will confirm the moment it lands.
      </p>`
    const { subject, html } = staffEmailChrome({
      category: 'membership',
      heading: `Your ${opts.planName} renews ${fmtDate(opts.periodEnd)}`,
      bodyHtml,
      cta: { label: 'View my membership', url: `${baseUrl()}/portal` },
      footer: 'Kozy Care — Uncompromising care. Exceptional convenience.',
    })
    await sendEmail({ to: opts.user.email, subject, html })
  } catch (e) {
    console.error('notifyMembershipRenewalReminder failed:', e)
  }
}

/** A member booking was cancelled — the allowance came back (plain words). */
export async function notifyMemberOrderCancelled(opts: {
  user: { name: string; email: string }
  orderNumber: string
  what: string
  refunded: boolean
}): Promise<void> {
  try {
    const firstName = opts.user.name.split(' ')[0]
    const bodyHtml = `
      <p style="color: #6F88A8; line-height: 1.6; font-size: 15px; margin: 0 0 20px 0;">
        <strong style="color:#0A192F;">${firstName}</strong>, your booking <strong style="color:#0A192F;">${opts.orderNumber}</strong>
        (${opts.what}) has been cancelled.
      </p>
      <p style="color: #6F88A8; line-height: 1.6; font-size: 15px; margin: 0 0 12px 0;">
        ${
          opts.refunded
            ? 'Your included allowance for it is back on your membership — rebook any time from your portal, one tap.'
            : 'Rebook any time from your portal — one tap and your rider collects at your usual window.'
        }
      </p>`
    const { subject, html } = staffEmailChrome({
      category: 'membership',
      heading: `Booking ${opts.orderNumber} cancelled`,
      bodyHtml,
      cta: { label: 'Rebook from my portal', url: `${baseUrl()}/portal` },
      footer: 'Kozy Care — Uncompromising care. Exceptional convenience.',
    })
    await sendEmail({ to: opts.user.email, subject, html })
  } catch (e) {
    console.error('notifyMemberOrderCancelled failed:', e)
  }
}

// =============================================================================
// MEMBERSHIP RETENTION (phase 76 → 77) — the automated member relationship
// =============================================================================
// The monthly summary is the retention workhorse: it lands 3 days before the
// member's period ends, shows the month in review (washes picked up, missed,
// extras), and carries the two prepopulated renewal buttons — next month at
// the plan price, or 3 months at the discounted prepay (the owner's ₦30,000
// plan → ₦85,000 decision) — plus the tier's extra bag/box upsell and, when
// the office has switched the Kozy Store on, ONE quiet product line. The
// paused email is the day-1 nudge for a member whose period ended without a
// renewal. Both are triggered by /api/cron/member-emails — always on for
// members (phase 77); test runs stay inside the woosh test world.
// =============================================================================

/** Member-facing email chrome — same navy/gold language as the staff chrome
 *  but WITHOUT the "Staff Console" subline (the phase-75 member emails
 *  borrowed the staff header verbatim; these new ones read like the
 *  member-facing mail they are). Phase 77: `ctas` renders a STACKED button
 *  pair (the renewal email's next-month gold button + the discounted
 *  3-month button); phase 79: the prepay button is NAVY — the owner's brand
 *  call (green was never a Kozy colour; gold = the primary action, navy =
 *  the longer-cover action). The single `cta` keeps serving every other
 *  mail. */
function memberEmailChrome(opts: {
  category: string
  heading: string
  bodyHtml: string
  cta?: { label: string; url: string }
  ctas?: Array<{
    label: string
    url: string
    variant?: 'gold' | 'navy'
    note?: string
  }>
  footer?: string
}): { subject: string; html: string } {
  const { category, heading, bodyHtml, cta, ctas, footer } = opts
  const subject = `[Kozy Care · ${categoryTag(category)}] ${heading}`
  const goldButton =
    'display: inline-block; background: linear-gradient(135deg, #E3BE4F, #D4AF37, #B8962B); color: #0A192F; padding: 14px 32px; border-radius: 9999px; text-decoration: none; font-weight: 700; font-size: 15px; box-shadow: 0 4px 14px rgba(212,175,55,0.35);'
  const navyButton =
    'display: inline-block; background: linear-gradient(135deg, #0A192F, #1B3A5F); color: #FFFFFF; padding: 14px 32px; border-radius: 9999px; text-decoration: none; font-weight: 700; font-size: 15px; box-shadow: 0 4px 14px rgba(10,25,47,0.35);'
  const fallbackLink = (url: string) =>
    `<span style="color: #0A192F; word-break: break-all;">${url}</span>`
  const html = `
  <!DOCTYPE html>
  <html>
  <body style="font-family: Georgia, serif; background: #F8F9FA; padding: 40px 0; margin: 0;">
    <div style="max-width: 520px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(10,25,47,0.08);">
      <div style="background: linear-gradient(135deg, #0A192F, #102740); padding: 32px 40px; text-align: center;">
        <h1 style="color: #D4AF37; font-family: Georgia, serif; font-size: 28px; font-weight: 700; margin: 0;">Kozy Care</h1>
        <p style="color: rgba(255,255,255,0.7); font-size: 11px; text-transform: uppercase; letter-spacing: 2px; margin: 4px 0 0 0;">Drycleaning &amp; Laundry · The Kozy Circle</p>
      </div>
      <div style="padding: 40px;">
        <h2 style="color: #0A192F; font-family: Georgia, serif; font-size: 22px; margin: 0 0 16px 0;">${heading}</h2>
        ${bodyHtml}
        ${
          ctas && ctas.length > 0
            ? `<div style="text-align: center; margin: 28px 0 8px 0;">
                 ${ctas
                   .map(
                     (b, i) =>
                       `${i > 0 ? '<div style="height: 12px;"></div>' : ''}<a href="${b.url}" style="${b.variant === 'navy' ? navyButton : goldButton}">${b.label}${b.note ? `<br><span style="font-size: 11px; font-weight: 700; letter-spacing: 0.5px; ${b.variant === 'navy' ? 'color: #E3BE4F;' : ''}">${b.note}</span>` : ''}</a>`
                   )
                   .join('')}
               </div>
               <p style="color: #6F88A8; font-size: 12px; margin: 12px 0 0 0; line-height: 1.6;">If the buttons don't work in your email app:<br>${ctas
                 .map((b, i) => `${i > 0 ? '<br>' : ''}${b.note ? '3 months' : 'Next month'} — ${fallbackLink(b.url)}`)
                 .join('')}</p>`
            : cta
            ? `<div style="text-align: center; margin: 28px 0 8px 0;">
                 <a href="${cta.url}" style="${goldButton}">${cta.label}</a>
               </div>
               <p style="color: #6F88A8; font-size: 12px; margin: 12px 0 0 0; line-height: 1.5;">Or paste this link into your browser:<br>${fallbackLink(cta.url)}</p>`
            : ''
        }
        <p style="color: #6F88A8; font-size: 11px; margin: 32px 0 0 0; border-top: 1px solid #E2E5E9; padding-top: 16px; line-height: 1.6;">
          ${
            footer ||
            'You receive this because you are a Kozy Circle member.<br>Kozy Care — Uncompromising care. Exceptional convenience.'
          }
        </p>
      </div>
    </div>
  </body>
  </html>`
  return { subject, html }
}

/** A stat row for the summary table (kept identical in shape so the email
 *  reads as one clean ledger). */
function summaryRow(label: string, value: string, last = false) {
  return `
        <tr>
          <td style="padding: 8px 0; color: #6F88A8; width: 190px; vertical-align: top;${last ? '' : ' border-bottom: 1px solid #F0F2F5;'}">${label}</td>
          <td style="padding: 8px 0; color: #0A192F;${last ? '' : ' border-bottom: 1px solid #F0F2F5;'}">${value}</td>
        </tr>`
}

/** Minimal HTML escape for admin-entered store copy riding along in emails. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** The strategic Kozy Store line (phase 77) — ONE quiet strip at the foot of
 *  the monthly summary, only when the office has switched the store on, at
 *  most two products, never a separate mailshot. */
function storeStrip(
  products: { name: string; tagline?: string | null; price: number }[],
  storeUrl: string
): string {
  if (!products || products.length === 0) return ''
  const items = products
    .map(
      (p) =>
        `<strong style="color:#0A192F;">${esc(p.name)}</strong> — ${formatNaira(p.price)}${p.tagline ? ` · <span style="color:#6F88A8;">${esc(p.tagline)}</span>` : ''}`
    )
    .join('<br>')
  return `
      <p style="color: #6F88A8; line-height: 1.7; font-size: 13px; margin: 16px 0 0 0; border-top: 1px solid #F0F2F5; padding-top: 16px;">
        <strong style="color:#0A192F;">Also from Kozy:</strong> ${items}<br>
        <a href="${storeUrl}" style="color: #0A192F; font-weight: 600; text-decoration: underline; text-decoration-color: #D4AF37;">Add one to your next delivery →</a>
      </p>`
}

/** The monthly usage summary — the retention email. Lands ~3 days before the
 *  period ends: the month in review + the prepopulated renewal buttons (next
 *  month vs the discounted 3-month prepay, phase 77) + the tier-appropriate
 *  bag/box upsell + the strategic Kozy Store strip when the store is lit.
 *  Phase 78: `nudge` carries the ONE behaviour-targeted line (an upgrade for
 *  power users / a deeper prepay rung for proven pre-payers) picked by
 *  pickMembershipNudge; when it is absent the quiet standing ladder line
 *  renders instead, so the deeper options are always findable but never
 *  doubled up. Exactly one of the two ever appears. */
export async function notifyMembershipMonthlySummary(opts: {
  user: { name: string; email: string }
  planName: string
  unitName: string
  includedUnits: number
  usedUnits: number
  extraUnits: number
  missedPickups: number
  deliveredCount: number
  periodStart: Date
  periodEnd: Date
  priceMonthly: number
  /** CARD_AUTOMATIC: card on file + not cancelled → informational renewal
   *  block. NEEDS_PAYMENT: transfer member, cancel-at-period-end, or paused —
   *  the renewal buttons carry the email. */
  renewalMode: 'CARD_AUTOMATIC' | 'NEEDS_PAYMENT'
  renewUrl: string
  contactPhone: string
  /** Phase 77 — the Kozy Store strip (already gated + capped by the caller;
   *  empty array renders nothing). */
  storeProducts?: { name: string; tagline?: string | null; price: number }[]
  /** Phase 78 — the one smart-nudge line (already frequency-capped and
   *  behaviour-picked by the caller; undefined renders the quiet standing
   *  ladder line instead). */
  nudge?: { kind: 'UPGRADE' | 'PREPAY'; line: string }
}): Promise<void> {
  try {
    const firstName = opts.user.name.split(' ')[0]
    const days = Math.max(
      0,
      Math.ceil((opts.periodEnd.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
    )
    const remaining = Math.max(0, opts.includedUnits - opts.usedUnits)
    const monthLabel = new Date(opts.periodStart).toLocaleDateString('en-NG', {
      month: 'long',
    })
    const threeMonthPrice = renewalPriceFor(opts.priceMonthly, 3)
    const threeMonthSaving = renewalSavingFor(opts.priceMonthly, 3)
    const sixMonthPrice = renewalPriceFor(opts.priceMonthly, 6)
    const yearPrice = renewalPriceFor(opts.priceMonthly, 12)
    const yearPerMonth = Math.round(yearPrice / 12)
    // The standing ladder line — permanent policy, never a promo. Renders
    // only when the behavioural nudge did not (never both).
    const ladderLine = `Covering longer saves more, always — 6 months is ${formatNaira(sixMonthPrice)} and a full year ${formatNaira(yearPrice)} (${formatNaira(yearPerMonth)} a month). Every option lives in <a href="${opts.renewUrl}" style="color: #0A192F; font-weight: 600; text-decoration: underline; text-decoration-color: #D4AF37;">your portal</a>.`
    // The one behaviour-targeted line (quiet by design: muted text, no
    // button, no urgency — a suggestion, not a pitch).
    const nudgeHtml = opts.nudge
      ? `<p style="color: #6F88A8; line-height: 1.7; font-size: 13px; margin: 20px 0 0 0; border-top: 1px solid #F0F2F5; padding-top: 16px;">${opts.nudge.line}</p>`
      : ''

    // ----- The month in review -----
    const rows = [
      summaryRow(
        `${opts.unitName} pickups used`,
        `<strong>${opts.usedUnits}</strong> of <strong>${opts.includedUnits}</strong> included — <strong>${remaining}</strong> still yours this month`
      ),
      summaryRow(
        'Extra washes beyond plan',
        opts.extraUnits > 0
          ? `<strong>${opts.extraUnits}</strong> extra ${opts.unitName}${opts.extraUnits === 1 ? '' : 's'} (billed at the member rate)`
          : 'None — you stayed inside your plan'
      ),
      summaryRow(
        'Missed pickups',
        opts.missedPickups > 0
          ? `<strong style="color:#B8422B;">${opts.missedPickups}</strong> — we missed you${opts.missedPickups === 1 ? '' : 's'}; rebook and we'll collect at your usual window`
          : 'None — every pickup day went smoothly'
      ),
      summaryRow(
        'Delivered to you',
        opts.deliveredCount > 0
          ? `<strong>${opts.deliveredCount}</strong> fresh ${opts.unitName}${opts.deliveredCount === 1 ? '' : 's'} delivered`
          : 'Your first delivery of the cycle is on its way'
      ),
      summaryRow(
        'Where the month stands',
        `Ends <strong>${fmtDate(opts.periodEnd)}</strong> — ${days} day${days === 1 ? '' : 's'} left`,
        true
      ),
    ].join('')

    // ----- The renewal block (phase 77: two buttons, a real saving) -----
    let renewalHtml: string
    let cta: { label: string; url: string } | undefined
    let ctas:
      | Array<{ label: string; url: string; variant?: 'gold' | 'navy'; note?: string }>
      | undefined
    if (opts.renewalMode === 'CARD_AUTOMATIC') {
      renewalHtml = `
      <p style="color: #6F88A8; line-height: 1.7; font-size: 15px; margin: 24px 0 0 0;">
        Your next month starts automatically — <strong style="color:#0A192F;">${formatNaira(opts.priceMonthly)}</strong> charges your saved card on
        <strong style="color:#0A192F;">${fmtDate(opts.periodEnd)}</strong>. Nothing to do, nothing to chase.
      </p>
      <p style="color: #6F88A8; line-height: 1.7; font-size: 13px; margin: 12px 0 0 0;">
        Rather settle it less often? One payment covers longer at a kinder rate — 3 months ${formatNaira(threeMonthPrice)}, 6 months ${formatNaira(sixMonthPrice)}, a year ${formatNaira(yearPrice)} — from <a href="${opts.renewUrl}" style="color: #0A192F; font-weight: 600; text-decoration: underline; text-decoration-color: #D4AF37;">your portal</a> whenever you like.
      </p>`
      cta = { label: 'View my membership', url: opts.renewUrl }
    } else {
      renewalHtml = `
      <p style="color: #6F88A8; line-height: 1.7; font-size: 15px; margin: 24px 0 0 0;">
        Your next month is <strong style="color:#0A192F;">${formatNaira(opts.priceMonthly)}</strong> and starts
        <strong style="color:#0A192F;">${fmtDate(opts.periodEnd)}</strong> — renew from your portal and your rider
        collects at your usual window without a pause.
      </p>
      <p style="color: #6F88A8; line-height: 1.7; font-size: 13px; margin: 12px 0 0 0;">
        Pay by card or bank transfer, whichever you prefer — the portal shows both.
      </p>`
      ctas = [
        {
          label: `Pay next month — ${formatNaira(opts.priceMonthly)}`,
          url: opts.renewUrl,
          variant: 'gold',
        },
        {
          label: `Pay 3 months — ${formatNaira(threeMonthPrice)}`,
          url: `${opts.renewUrl}&months=3`,
          variant: 'navy',
          note: `you save ${formatNaira(threeMonthSaving)}`,
        },
      ]
    }

    const { subject, html } = memberEmailChrome({
      category: 'membership',
      heading: `Your ${monthLabel} with Kozy, ${firstName}`,
      bodyHtml: `
      <p style="color: #6F88A8; line-height: 1.6; font-size: 15px; margin: 0 0 20px 0;">
        Here is your month on the <strong style="color:#0A192F;">${opts.planName}</strong> at a glance — the same numbers your portal shows.
      </p>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">${rows}</table>
      ${renewalHtml}
      ${
        // Card members: the informational block above already carries the
        // ladder sentence — only a behavioural nudge may add a line, never
        // the standing ladder (no member sees the ladder twice).
        opts.renewalMode === 'CARD_AUTOMATIC'
          ? nudgeHtml
          : nudgeHtml ||
            `<p style="color: #6F88A8; line-height: 1.7; font-size: 13px; margin: 20px 0 0 0; border-top: 1px solid #F0F2F5; padding-top: 16px;">${ladderLine}</p>`
      }
      <p style="color: #6F88A8; line-height: 1.7; font-size: 13px; margin: 20px 0 0 0; border-top: 1px solid #F0F2F5; padding-top: 16px;">
        Running out of room on busy weeks? A <strong style="color:#0A192F;">second ${opts.unitName}</strong> can ride along with your renewal —
        reply to this email or call <strong style="color:#0A192F;">${opts.contactPhone}</strong> and the office will set it up.
      </p>
      ${storeStrip(opts.storeProducts ?? [], `${baseUrl()}/portal?store=1`)}`,
      cta,
      ctas,
      footer:
        'You receive this monthly summary because you are a Kozy Circle member.<br>Kozy Care — Uncompromising care. Exceptional convenience.',
    })
    await sendEmail({ to: opts.user.email, subject, html })
  } catch (e) {
    console.error('notifyMembershipMonthlySummary failed:', e)
  }
}

/** Day-1 reactivation nudge — the member's period ended without a renewal.
 *  Phase 77: the same two-button renewal pattern (next month vs the
 *  discounted 3-month prepay). */
export async function notifyMembershipPaused(opts: {
  user: { name: string; email: string }
  planName: string
  unitName: string
  includedUnits: number
  periodEnd: Date
  priceMonthly: number
  renewUrl: string
  contactPhone: string
}): Promise<void> {
  try {
    const firstName = opts.user.name.split(' ')[0]
    const threeMonthPrice = renewalPriceFor(opts.priceMonthly, 3)
    const threeMonthSaving = renewalSavingFor(opts.priceMonthly, 3)
    const { subject, html } = memberEmailChrome({
      category: 'membership',
      heading: `Your ${opts.planName} has paused — one tap brings it back`,
      bodyHtml: `
      <p style="color: #6F88A8; line-height: 1.6; font-size: 15px; margin: 0 0 20px 0;">
        <strong style="color:#0A192F;">${firstName}</strong>, your ${opts.planName} month ran to
        <strong style="color:#0A192F;">${fmtDate(opts.periodEnd)}</strong> and we haven't seen a renewal yet —
        so pickups are paused for now.
      </p>
      <p style="color: #6F88A8; line-height: 1.6; font-size: 15px; margin: 0 0 12px 0;">
        Nothing is lost: your <strong style="color:#0A192F;">${opts.unitName}</strong> is still yours, your history is intact, and your
        <strong style="color:#0A192F;">${opts.includedUnits} × ${opts.unitName}</strong> pickups restart the moment you renew.
        Reactivate for <strong style="color:#0A192F;">${formatNaira(opts.priceMonthly)}</strong> and your rider picks up right where you left off.
      </p>
      <p style="color: #6F88A8; line-height: 1.7; font-size: 13px; margin: 12px 0 0 0;">
        Coming back for longer? Cover 3 months in one payment of <strong style="color:#0A192F;">${formatNaira(threeMonthPrice)}</strong> —
        <strong style="color:#0A192F;">${formatNaira(threeMonthSaving)} less</strong> than paying month by month.
        6-month and year-long covers save more still; your portal shows every option.
      </p>
      <p style="color: #6F88A8; line-height: 1.7; font-size: 13px; margin: 20px 0 0 0; border-top: 1px solid #F0F2F5; padding-top: 16px;">
        Prefer to talk it through? Call <strong style="color:#0A192F;">${opts.contactPhone}</strong> — the office is glad to help.
      </p>`,
      ctas: [
        {
          label: `Reactivate for next month — ${formatNaira(opts.priceMonthly)}`,
          url: opts.renewUrl,
          variant: 'gold',
        },
        {
          label: `Reactivate for 3 months — ${formatNaira(threeMonthPrice)}`,
          url: `${opts.renewUrl}&months=3`,
          variant: 'navy',
          note: `you save ${formatNaira(threeMonthSaving)}`,
        },
      ],
      footer:
        'You receive this because your Kozy Circle membership paused without a renewal.<br>Kozy Care — Uncompromising care. Exceptional convenience.',
    })
    await sendEmail({ to: opts.user.email, subject, html })
  } catch (e) {
    console.error('notifyMembershipPaused failed:', e)
  }
}

/** A member claimed a multi-month bank-transfer renewal — office alert.
 *  Confirmation stays human: the drill-down's Renew action (with the
 *  claimed months prefilled) is the money-moving step. */
export async function notifyAdminRenewalTransferPending(opts: {
  member: { name: string; email: string }
  planName: string
  months: number
  amount: number
  transferReference: string
  receiptUrl?: string | null
  /** Phase 79: true when this is the member's FIRST payment completing a
   *  pending membership — the office activates it rather than extending. */
  isInitial?: boolean
}): Promise<void> {
  try {
    const config = await adminAlertConfig()
    if (config.emails.length === 0) return
    const targets = config.emails
    const bodyHtml = `
      <p style="color: #6F88A8; line-height: 1.6; font-size: 15px; margin: 0 0 20px 0;">
        <strong style="color:#0A192F;">${opts.member.name}</strong> (${opts.member.email}) ${
          opts.isInitial
            ? 'is completing the <strong style="color:#0A192F;">first month</strong> of their pending'
            : 'claims a <strong style="color:#0A192F;">' + opts.months + '-month renewal</strong> on the'
        }
        <strong style="color:#0A192F;">${opts.planName}</strong> — <strong style="color:#0A192F;">${formatNaira(opts.amount)}</strong> by bank transfer.
      </p>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        ${summaryRow('Transfer reference', `<strong>${opts.transferReference}</strong>`)}
        ${summaryRow(
          'Receipt',
          opts.receiptUrl
            ? `<a href="${opts.receiptUrl}" style="color: #0A192F; text-decoration: underline; text-decoration-color: #D4AF37;">attached by the member</a>`
            : 'Not attached — verify against the bank statement'
        )}
        ${summaryRow(
          'What to do',
          opts.isInitial
            ? "Memberships → the member's drill-down → Verify &amp; activate (or Renew — months prefilled from the claim). The membership is PENDING until you confirm."
            : 'Memberships → the member\'s drill-down → Renew (months prefilled from the claim). Confirm only what actually landed.',
          true
        )}
      </table>`
    const { subject, html } = staffEmailChrome({
      category: 'membership',
      heading: opts.isInitial
        ? `First-month transfer claimed — activate ${opts.member.name}'s membership`
        : `${opts.months}-month renewal transfer claimed — confirm it`,
      bodyHtml,
      // Task 82: the CTA lands DIRECTLY on the Members tab — never a bare
      // dashboard dump that still needs a second click.
      cta: { label: 'Open Memberships', url: `${baseUrl()}/admin?tab=memberships` },
      footer: 'Kozy Care — the office side of the Kozy Circle.',
    })
    // Task 82: the claim ALSO lands in the Operations feed (it used to be
    // email-only — the owner found nothing to approve on the dashboard).
    // deliverAdminAlert writes the NotificationEvent first (never throws)
    // and delivers the mail; both carry the memberships deep link.
    await deliverAdminAlert({
      type: 'MEMBERSHIP_CLAIM',
      title: opts.isInitial
        ? `${opts.member.name} completed their first payment`
        : `${opts.member.name} claims a ${opts.months}-month renewal`,
      body: `${formatNaira(opts.amount)} by transfer · ref ${opts.transferReference}${opts.receiptUrl ? ' · receipt attached' : ''} · confirm in Members`,
      emails: targets,
      email: { subject, html },
      enabled: config.newOrder,
      data: {
        memberEmail: opts.member.email,
        months: opts.months,
        amount: opts.amount,
        reference: opts.transferReference,
        isInitial: Boolean(opts.isInitial),
      },
      linkTab: 'memberships',
    })
  } catch (e) {
    console.error('notifyAdminRenewalTransferPending failed:', e)
  }
}

/** A customer asked for a Kozy Store product to ride along with their next
 *  delivery (phase 77) — office alert with the one-tap lifecycle reminder.
 *  Never triggers member-side mail: the store line rides inside the monthly
 *  summary only, never its own mailshot. */
export async function notifyAdminStoreRequest(opts: {
  customer: { name: string; email: string; phone: string }
  product: { name: string; price: number }
  qty: number
  note?: string | null
}): Promise<void> {
  try {
    const config = await adminAlertConfig()
    if (config.emails.length === 0) return
    const targets = config.emails
    const bodyHtml = `
      <p style="color: #6F88A8; line-height: 1.6; font-size: 15px; margin: 0 0 20px 0;">
        <strong style="color:#0A192F;">${opts.customer.name}</strong> asked for
        <strong style="color:#0A192F;">${opts.qty} × ${opts.product.name}</strong> (${formatNaira(opts.product.price)}) to ride along with their next delivery.
      </p>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        ${summaryRow('Customer', `${opts.customer.email} · ${opts.customer.phone}`)}
        ${summaryRow('Their note', opts.note ? opts.note : '—')}
        ${summaryRow(
          'What to do',
          'Settings → Store → Requests — confirm it (it joins their next pickup) or decline it. The customer sees the status in their portal.',
          true
        )}
      </table>`
    const { subject, html } = staffEmailChrome({
      category: 'store',
      heading: `Store request — ${opts.qty} × ${opts.product.name}`,
      bodyHtml,
      cta: { label: 'Open Settings → Store', url: `${baseUrl()}/admin` },
      footer: 'Kozy Care — the office side of the Kozy Store.',
    })
    await Promise.all(targets.map((to) => sendEmail({ to, subject, html })))
  } catch (e) {
    console.error('notifyAdminStoreRequest failed:', e)
  }
}

// =============================================================================
// KOZY NETWORK (phase 62) — partner application alert
// =============================================================================

/** An operator applied to join the network — admin alert. */
export async function notifyAdminPartnerApplication(partner: {
  businessName: string
  contactName: string
  email: string
  phone: string
  address: string
  capacityNotes?: string | null
}): Promise<void> {
  try {
    const cfg = await adminAlertConfig()
    const { subject, html } = adminEmail({
      category: 'partner',
      badge: 'Network application',
      heading: `${partner.businessName} applied to join the Kozy Network`,
      intro:
        'A laundry operator wants to run under the Kozy brand — demand, technology and riders from us; processing capacity from them. Review the application, then set their branch and revenue share.',
      rows: [
        { label: 'Business', value: partner.businessName },
        { label: 'Contact', value: `${partner.contactName} · ${partner.phone}` },
        { label: 'Email', value: partner.email },
        { label: 'Location', value: partner.address },
        ...(partner.capacityNotes ? [{ label: 'Capacity', value: partner.capacityNotes }] : []),
      ],
      cta: { label: 'Contact them', url: `tel:${partner.phone.replace(/\s/g, '')}` },
    })
    await deliverAdminAlert({
      type: 'PARTNER_APPLICATION',
      title: `${partner.businessName} applied to join the network`,
      body: `${partner.contactName} · ${partner.phone} · ${partner.address}`,
      emails: cfg.emails,
      email: { subject, html },
      enabled: true,
      data: { businessName: partner.businessName, email: partner.email, phone: partner.phone },
      linkTab: 'partners',
    })
  } catch (e) {
    console.error('notifyAdminPartnerApplication failed:', e)
  }
}

// =============================================================================
// PARTNER PIPELINE (phase 72) — application parity with riders + money receipts
// =============================================================================
// Partners now get the same treatment riders get: a confirmation the moment
// they apply (email + SMS, with a KZP reference), a WELCOME email with their
// portal credentials at approval, and a receipt whenever the office settles
// their share. Riders get the same receipt for payouts — the money side of
// both programs speaks with one voice.
// =============================================================================

/** 1) Application received — mirrors notifyRiderApplicationReceived. */
export async function notifyPartnerApplicationReceived(app: {
  businessName: string
  contactName: string
  email: string
  phone: string
  lga?: string | null
  refCode: string
}): Promise<void> {
  try {
    const firstName = app.contactName.split(' ')[0]

    const bodyHtml = `
        <p style="color: #6F88A8; line-height: 1.6; font-size: 15px; margin: 0 0 20px 0;">
          Thank you for applying to the Kozy Network, <strong style="color:#0A192F;">${firstName}</strong> —
          ${app.businessName} is in our review queue. Here is what happens next:
        </p>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 8px 0; color: #6F88A8; width: 150px; vertical-align: top; border-bottom: 1px solid #F0F2F5;">Your reference</td>
            <td style="padding: 8px 0; color: #0A192F; font-weight: 600; border-bottom: 1px solid #F0F2F5;"><code style="background:#F8F9FA; padding:2px 6px; border-radius:4px; font-family:monospace; font-size:13px;">${app.refCode}</code></td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6F88A8; vertical-align: top; border-bottom: 1px solid #F0F2F5;">Step 1 — Review</td>
            <td style="padding: 8px 0; color: #0A192F; border-bottom: 1px solid #F0F2F5;">We review applications within <strong>48 hours</strong> (Mon–Sat).</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6F88A8; vertical-align: top; border-bottom: 1px solid #F0F2F5;">Step 2 — Call</td>
            <td style="padding: 8px 0; color: #0A192F; border-bottom: 1px solid #F0F2F5;">A call from <strong>our team</strong> to talk capacity, standards and the share that fits your setup${app.lga ? ` (${app.lga})` : ''}.</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6F88A8; vertical-align: top;">Step 3 — Welcome</td>
            <td style="padding: 8px 0; color: #0A192F;">If it's a fit, you'll receive your partner-portal sign-in by email and orders can start routing to you.</td>
          </tr>
        </table>
        <p style="color: #6F88A8; line-height: 1.6; font-size: 13px; margin: 24px 0 0 0;">
          Nothing is owed and nothing is locked until both sides say yes. Keep your phone close — the review call is how every partnership starts.
        </p>`

    const { subject, html } = staffEmailChrome({
      category: 'partner',
      heading: `Application received — ${app.businessName}`,
      bodyHtml,
      cta: undefined,
      footer: 'This is an application confirmation, not a partnership agreement.<br>Kozy Care — Uncompromising care. Exceptional convenience.',
    })
    await sendEmail({ to: app.email, subject, html })

    await sendSMS(
      app.phone,
      `Kozy Care: Network application received (${app.refCode}). We'll call you within 48 hours (Mon-Sat) to talk capacity and the revenue share.`
    )
  } catch (e) {
    console.error('notifyPartnerApplicationReceived failed:', e)
  }
}

/** 2) Partner approved — the WELCOME email with portal credentials (same
 *  recipe as the rider welcome: system-generated password, set-your-own at
 *  first sign-in). Returns the delivery outcome so the approving admin
 *  knows whether it landed. */
export async function notifyPartnerApproved(opts: {
  to: string
  businessName: string
  contactName: string
  password: string
  managerName: string
  refCode: string
  sharePct: number
  note?: string
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const { to, businessName, contactName, password, managerName, refCode, sharePct, note } = opts
    const loginUrl = `${baseUrl()}/login?email=${encodeURIComponent(to)}`
    const firstName = contactName.split(' ')[0]

    const bodyHtml = `
        <p style="color: #6F88A8; line-height: 1.6; font-size: 15px; margin: 0 0 20px 0;">
          Welcome to the Kozy Network, <strong style="color:#0A192F;">${firstName}</strong> —
          ${businessName} (${refCode}) is approved. Your partner portal is ready: sign in below and
          the orders we route to you appear there, with your revenue-share ledger alongside.
        </p>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 8px 0; color: #6F88A8; width: 150px; vertical-align: top; border-bottom: 1px solid #F0F2F5;">Sign-in email</td>
            <td style="padding: 8px 0; color: #0A192F; font-weight: 600; border-bottom: 1px solid #F0F2F5;">${to}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6F88A8; vertical-align: top; border-bottom: 1px solid #F0F2F5;">Initial password</td>
            <td style="padding: 8px 0; color: #0A192F; font-weight: 600; border-bottom: 1px solid #F0F2F5;"><code style="background:#F8F9FA; padding:2px 6px; border-radius:4px; font-family:monospace; font-size:13px;">${password}</code></td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6F88A8; vertical-align: top;">Your share</td>
            <td style="padding: 8px 0; color: #0A192F;">${sharePct}% of the value of every delivered order you process</td>
          </tr>
        </table>
        <p style="color: #6F88A8; line-height: 1.6; font-size: 14px; margin: 20px 0 0 0;"><strong style="color:#0A192F;">How the working day goes:</strong></p>
        <ol style="color: #0A192F; font-size: 14px; line-height: 1.7; margin: 8px 0 0 0; padding-left: 20px;">
          <li>Sign in with the button below — the portal will ask you to choose your own password.</li>
          <li>Our riders bring customer batches to your facility. Each batch appears in the portal as it's routed to you.</li>
          <li>Move each order along as you work it — received, washing, finishing. That's what keeps the customer's tracking honest.</li>
          <li>When finishing is done, our rider collects it for delivery. Your share ledger updates the moment an order is delivered.</li>
          <li>Add your bank details in the portal's Account tab so settlements reach the right account.</li>
        </ol>
        ${
          note
            ? `<div style="margin: 20px 0 0 0; padding: 14px 16px; background: #F8F9FA; border-left: 3px solid #D4AF37; border-radius: 4px;">
                 <p style="color: #0A192F; font-size: 14px; margin: 0; line-height: 1.6;"><strong>Message from ${managerName}:</strong><br>${note}</p>
               </div>`
            : ''
        }
        <p style="color: #6F88A8; line-height: 1.6; font-size: 13px; margin: 24px 0 0 0;">
          Keep this email private until you have set your own password. Support: ${await supportLine()}.
        </p>`

    const { subject, html } = staffEmailChrome({
      category: 'partner',
      heading: `Welcome to the Kozy Network, ${firstName}!`,
      bodyHtml,
      cta: { label: 'Open the partner portal', url: loginUrl },
    })

    await sendEmail({ to, subject, html })
    return { ok: true }
  } catch (e: any) {
    console.error('Partner welcome email failed:', e)
    return { ok: false, error: e?.message ?? 'unknown error' }
  }
}

/** 3) Rider payout receipt — the money side made visible to the rider. */
export async function notifyRiderPayout(opts: {
  to: string
  name: string
  amount: number
  method: string
  reference?: string | null
  pendingAfter: number
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const { to, name, amount, method, reference, pendingAfter } = opts
    const firstName = name.split(' ')[0]
    const methodLabel = method === 'CASH' ? 'Cash' : 'Bank transfer'

    const bodyHtml = `
        <p style="color: #6F88A8; line-height: 1.6; font-size: 15px; margin: 0 0 20px 0;">
          Your payout has been recorded, <strong style="color:#0A192F;">${firstName}</strong> —
          this week's work, settled. Keep this email as your receipt.
        </p>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 8px 0; color: #6F88A8; width: 150px; vertical-align: top; border-bottom: 1px solid #F0F2F5;">Amount paid</td>
            <td style="padding: 8px 0; color: #0A192F; font-weight: 600; border-bottom: 1px solid #F0F2F5;">₦${amount.toLocaleString('en-NG')}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6F88A8; vertical-align: top; border-bottom: 1px solid #F0F2F5;">Method</td>
            <td style="padding: 8px 0; color: #0A192F; border-bottom: 1px solid #F0F2F5;">${methodLabel}${reference ? ` · ref ${reference}` : ''}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6F88A8; vertical-align: top;">Balance after</td>
            <td style="padding: 8px 0; color: #0A192F;">₦${Math.max(pendingAfter, 0).toLocaleString('en-NG')} still to come on your next payout</td>
          </tr>
        </table>
        <p style="color: #6F88A8; line-height: 1.6; font-size: 13px; margin: 24px 0 0 0;">
          Every stop behind this payout is listed in your rider app's Earnings tab. Support: ${await supportLine()}.
        </p>`

    const { subject, html } = staffEmailChrome({
      category: 'rider',
      heading: `Payout recorded — ₦${amount.toLocaleString('en-NG')}`,
      bodyHtml,
      cta: { label: 'See your earnings', url: `${baseUrl()}/driver` },
    })
    await sendEmail({ to, subject, html })
    return { ok: true }
  } catch (e: any) {
    console.error('Rider payout email failed:', e)
    return { ok: false, error: e?.message ?? 'unknown error' }
  }
}

/** 4) Partner settlement receipt — the same voice for the partner's money. */
export async function notifyPartnerSettlement(opts: {
  to: string
  businessName: string
  contactName: string
  amount: number
  method: string
  reference?: string | null
  pendingAfter: number
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const { to, businessName, contactName, amount, method, reference, pendingAfter } = opts
    const firstName = contactName.split(' ')[0]
    const methodLabel = method === 'CASH' ? 'Cash' : 'Bank transfer'

    const bodyHtml = `
        <p style="color: #6F88A8; line-height: 1.6; font-size: 15px; margin: 0 0 20px 0;">
          Your revenue-share settlement has been recorded, <strong style="color:#0A192F;">${firstName}</strong> —
          ${businessName}, settled. Keep this email as your receipt.
        </p>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 8px 0; color: #6F88A8; width: 150px; vertical-align: top; border-bottom: 1px solid #F0F2F5;">Amount settled</td>
            <td style="padding: 8px 0; color: #0A192F; font-weight: 600; border-bottom: 1px solid #F0F2F5;">₦${amount.toLocaleString('en-NG')}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6F88A8; vertical-align: top; border-bottom: 1px solid #F0F2F5;">Method</td>
            <td style="padding: 8px 0; color: #0A192F; border-bottom: 1px solid #F0F2F5;">${methodLabel}${reference ? ` · ref ${reference}` : ''}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6F88A8; vertical-align: top;">Balance after</td>
            <td style="padding: 8px 0; color: #0A192F;">₦${Math.max(pendingAfter, 0).toLocaleString('en-NG')} of earned share still to come</td>
          </tr>
        </table>
        <p style="color: #6F88A8; line-height: 1.6; font-size: 13px; margin: 24px 0 0 0;">
          Every delivered order behind this settlement is listed in your portal's Earnings tab. Support: ${await supportLine()}.
        </p>`

    const { subject, html } = staffEmailChrome({
      category: 'partner',
      heading: `Settlement recorded — ₦${amount.toLocaleString('en-NG')}`,
      bodyHtml,
      cta: { label: 'See your ledger', url: `${baseUrl()}/partner` },
    })
    await sendEmail({ to, subject, html })
    return { ok: true }
  } catch (e: any) {
    console.error('Partner settlement email failed:', e)
    return { ok: false, error: e?.message ?? 'unknown error' }
  }
}
