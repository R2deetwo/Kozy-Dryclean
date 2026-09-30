// =============================================================================
// POST /api/subscriptions/renew — a member renews (or reactivates) their own
// membership, optionally prepaying several months (phase 76)
// =============================================================================
// Authed customers only, own membership only. This is the endpoint behind the
// email's prepopulated renewal CTA and the portal's renewal card:
//
//   body: { subscriptionId, months: 1|3|6|12,
//           method: 'PAYSTACK' | 'BANK_TRANSFER', transferReceipt? }
//
//   PAYSTACK      → we initialize a Paystack transaction inline and return
//                   the authorization URL. months=1 keeps the plan's
//                   recurring code (Paystack re-charges monthly from then
//                   on); months>1 is a ONE-OFF charge of months × price that
//                   extends periodEnd on the webhook (metadata.months).
//   BANK_TRANSFER → we record a RENEWAL_INTENT ledger row (the claim, with
//                   the receipt when the member attached one), alert the
//                   office, and return the transfer instructions. Money
//                   still moves only when the office confirms in the
//                   drill-down (Renew, months prefilled from the claim).
// =============================================================================

import { NextResponse, after } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { getAppSettings } from '@/lib/app-settings'
import { effectiveStatus } from '@/lib/subscriptions'
import { notifyAdminRenewalTransferPending } from '@/lib/notifications'
import { RENEWAL_MONTH_CHOICES } from '@/lib/types'

function baseUrl(): string {
  return (
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://kozycare.ng'
  )
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json(
      { error: 'SIGN_IN_REQUIRED', message: 'Please sign in — your membership lives in your account.' },
      { status: 401 }
    )
  }
  const role = (session.user as any)?.role
  if (role !== 'B2C' && role !== 'B2B') {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: 'Memberships are for customer accounts. Please use a personal account.' },
      { status: 403 }
    )
  }
  const userId = (session.user as any).id as string

  // ----- Rate limit: 6 renewal attempts per hour per user -----
  const limit = await rateLimit(`renew:${userId}`, { max: 6, windowMs: 60 * 60 * 1000 })
  if (!limit.success) {
    return NextResponse.json(
      { error: 'RATE_LIMITED', message: 'Too many attempts — please try again in a little while.' },
      { status: 429 }
    )
  }

  const body = await req.json().catch(() => ({}))
  const subscriptionId = typeof body?.subscriptionId === 'string' ? body.subscriptionId : ''
  const months = Number(body?.months)
  const method = body?.method === 'PAYSTACK' ? 'PAYSTACK' : 'BANK_TRANSFER'
  const transferReceipt =
    typeof body?.transferReceipt === 'string' && body.transferReceipt.startsWith('data:image/')
      ? body.transferReceipt.slice(0, 1_500_000)
      : null

  if (!subscriptionId) {
    return NextResponse.json({ error: 'subscriptionId is required' }, { status: 400 })
  }
  if (!(RENEWAL_MONTH_CHOICES as readonly number[]).includes(months)) {
    return NextResponse.json(
      { error: 'INVALID_MONTHS', message: `Months must be one of ${RENEWAL_MONTH_CHOICES.join(', ')}.` },
      { status: 400 }
    )
  }

  const sub = await db.subscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true },
  })
  if (!sub || !sub.plan) {
    return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
  }
  if (sub.userId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ----- Nothing to renew while the INITIAL payment is still pending -----
  if (sub.status === 'PENDING_ACTIVATION') {
    return NextResponse.json(
      {
        error: 'PAYMENT_PENDING',
        message:
          'This membership is still waiting for its first payment to be confirmed — the office will activate it the moment it lands.',
      },
      { status: 409 }
    )
  }
  if (sub.status === 'CANCELLED') {
    return NextResponse.json(
      {
        error: 'CANCELLED',
        message: 'This membership was cancelled. Subscribe again from the Memberships page to come back to the Kozy Circle.',
      },
      { status: 409 }
    )
  }

  const eff = effectiveStatus(sub)
  if (eff !== 'ACTIVE' && eff !== 'EXPIRING' && eff !== 'PAST_DUE' && eff !== 'LAPSED') {
    return NextResponse.json(
      { error: 'NOT_RENEWABLE', message: 'This membership cannot be renewed in its current state.' },
      { status: 409 }
    )
  }

  const amount = Math.round(sub.plan.priceMonthly * months)
  const transferReference = `KZY-RENEW-${sub.id.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase()}`

  // ----- Bank transfer: claim + instructions, office confirms -----
  if (method === 'BANK_TRANSFER') {
    try {
      await db.subscriptionEvent.create({
        data: {
          subscriptionId: sub.id,
          kind: 'RENEWAL_INTENT',
          delta: 0,
          count: 0,
          meta: JSON.stringify({
            months,
            amount,
            reference: transferReference,
            receipt: transferReceipt ? 'attached' : 'none',
          }),
          note: `Member claimed a ${months}-month renewal transfer (${transferReference})`,
        },
      })
    } catch (e) {
      console.error('[memberships] RENEWAL_INTENT ledger write failed:', e)
    }

    const settings = await getAppSettings()
    after(async () => {
      try {
        const user = await db.user.findUnique({ where: { id: userId } })
        if (user) {
          await notifyAdminRenewalTransferPending({
            member: { name: user.name, email: user.email },
            planName: sub.plan!.name,
            months,
            amount,
            transferReference,
            receiptUrl: null,
          })
        }
      } catch (e) {
        console.error('[memberships] renewal transfer alert failed:', e)
      }
    })

    return NextResponse.json({
      transfer: {
        bankName: settings.bankName,
        accountName: settings.accountName,
        accountNumber: settings.accountNumber,
        amount,
        months,
        reference: transferReference,
        note: `Send the amount with reference ${transferReference} — your ${months > 1 ? `${months} months` : 'next month'} applies the moment the office confirms. You can also reply to your summary email with the receipt.`,
      },
    })
  }

  // ----- Card: initialize the Paystack transaction -----
  const secretKey = process.env.PAYSTACK_SECRET_KEY
  if (!secretKey) {
    return NextResponse.json(
      {
        error: 'PAYSTACK_NOT_CONFIGURED',
        message: 'Online payments are not configured yet — please pay by bank transfer and your renewal applies the moment we verify it.',
      },
      { status: 503 }
    )
  }

  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }

  // A FRESH reference every attempt (Paystack references are single-use).
  // The webhook matches the stored paystackRef exactly; metadata carries
  // the months so the multi-month charge extends the right number of cycles.
  const reference = `SUB-${sub.id}-R${Date.now().toString(36).toUpperCase()}`
  const amountKobo = Math.round(amount * 100)

  const res = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: user.email,
      amount: amountKobo,
      reference,
      currency: 'NGN',
      // months=1 stays on the plan's recurring code when one exists (the
      // card keeps auto-charging monthly). A multi-month prepay is a ONE-OFF
      // charge — no plan code, or Paystack would ALSO recur it.
      ...(months === 1 && sub.plan.paystackPlanCode
        ? { plan: sub.plan.paystackPlanCode }
        : {}),
      callback_url: `${baseUrl()}/payment/callback?ref=${encodeURIComponent(reference)}`,
      metadata: {
        subscriptionId: sub.id,
        planCode: sub.plan.code,
        planName: sub.plan.name,
        customerName: user.name,
        kind: 'membership',
        renewal: true,
        months,
      },
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data?.data?.authorization_url) {
    console.error('Paystack renewal initialize failed:', res.status, JSON.stringify(data))
    return NextResponse.json(
      { error: 'Could not start the payment. Please try again or pay by bank transfer.' },
      { status: 502 }
    )
  }

  await db.subscription.update({
    where: { id: sub.id },
    data: { paystackRef: reference },
  })

  return NextResponse.json({
    authorizationUrl: data.data.authorization_url,
    reference,
    amount,
    months,
    recurring: months === 1 && Boolean(sub.plan.paystackPlanCode),
  })
}
