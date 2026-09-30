// =============================================================================
// POST /api/subscriptions/renew — a member renews (or reactivates) their own
// membership, optionally prepaying months at a saving (phase 76 → 77 → 79 → 81)
// =============================================================================
// Authed customers only, own membership only. This is the endpoint behind the
// email's renewal buttons and the portal's payment surfaces:
//
//   body: { subscriptionId, months: 1|3|6|12,
//           method: 'PAYSTACK' | 'BANK_TRANSFER', transferReceipt?, claim? }
//
//   PAYSTACK      → we initialize a Paystack transaction inline and return
//                   the authorization URL. months=1 keeps the plan's
//                   recurring code (Paystack re-charges monthly from then
//                   on); months>1 is a ONE-OFF charge at the discounted
//                   prepay price (renewalPriceFor) that extends periodEnd on
//                   the webhook (metadata.months).
//   BANK_TRANSFER → returns the transfer instructions (bank, account,
//                   reference — no side effects).
//   BANK_TRANSFER + claim:true (phase 81) → the member pressed "I've made
//                   payment": records the RENEWAL_INTENT ledger row (the
//                   claim) and alerts the office. Kept SEPARATE from the
//                   instructions call so the office is never pinged by a
//                   member who merely opened the details (false alerts were
//                   the old behavior — the claim and the instructions were
//                   one call). The money still moves only when the office
//                   confirms in the drill-down.
//
//   PHASE 79 — PENDING_ACTIVATION: a member whose FIRST payment never landed
//   (card checkout failed / never opened — exactly the "subscribed but cannot
//   pay" complaint) completes their first month HERE: months=1 only, the same
//   transfer claim + card paths. This is the door out of the trap: the portal's
//   first-payment banner renders for pending members; re-subscribing stays
//   blocked (one membership per person).
//
//   PHASE 81 — a member with a SCHEDULED tier switch pays for the plan they
//   are switching TO (the next cycle runs on it; the engine applies the swap
//   when the money lands).
// =============================================================================

import { NextResponse, after } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { getAppSettings } from '@/lib/app-settings'
import { effectiveStatus, openRenewalClaim } from '@/lib/subscriptions'
import { notifyAdminRenewalTransferPending } from '@/lib/notifications'
import { RENEWAL_MONTH_CHOICES, renewalPriceFor, renewalSavingFor, formatNaira } from '@/lib/types'

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
    include: { plan: true, pendingPlan: true },
  })
  if (!sub || !sub.plan) {
    return NextResponse.json({ error: 'Membership not found' }, { status: 404 })
  }
  if (sub.userId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ----- Phase 79: PENDING_ACTIVATION — the FIRST payment, months=1 only -----
  // These members joined but their payment never landed (the card checkout
  // could not open before a Paystack key existed). The ladder opens once the
  // membership is live; the first payment is a single month at plan price.
  const isInitialPayment = sub.status === 'PENDING_ACTIVATION'
  if (isInitialPayment) {
    if (months !== 1) {
      return NextResponse.json(
        {
          error: 'FIRST_MONTH_IS_ONE',
          message:
            'Your first payment covers one month — once your membership is live, the kinder 3/6/12-month rates open up in your portal.',
        },
        { status: 400 }
      )
    }
  } else if (sub.status === 'CANCELLED') {
    return NextResponse.json(
      {
        error: 'CANCELLED',
        message: 'This membership was cancelled. Subscribe again from the Memberships page to come back to the Kozy Circle.',
      },
      { status: 409 }
    )
  }

  // The effective-status gate applies to LIVE memberships only; a pending
  // first payment is completed through this endpoint (phase 79).
  if (!isInitialPayment) {
    const eff = effectiveStatus(sub)
    if (eff !== 'ACTIVE' && eff !== 'EXPIRING' && eff !== 'PAST_DUE' && eff !== 'LAPSED') {
      return NextResponse.json(
        { error: 'NOT_RENEWABLE', message: 'This membership cannot be renewed in its current state.' },
        { status: 409 }
      )
    }
  }

  // The ONE pricing path: 1 month = plan price, 3 months = the discounted
  // prepay (the owner's ₦30,000 → ₦85,000 decision generalised per tier).
  // Phase 81: with a tier switch scheduled, the next cycle runs on the NEW
  // plan — the payment is for it.
  const pricingPlan = sub.pendingPlan ?? sub.plan
  const amount = renewalPriceFor(pricingPlan.priceMonthly, months)
  const saving = renewalSavingFor(pricingPlan.priceMonthly, months)
  const transferReference = `KZY-RENEW-${sub.id.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase()}`

  // ----- Bank transfer -----
  // Phase 81 splits the old single call in two:
  //   (a) instructions only (the member opened the transfer details — no
  //       ledger row, no office ping),
  //   (b) claim:true (the member pressed "I've made payment") — the
  //       RENEWAL_INTENT ledger row + the office alert.
  // The office alert therefore fires when a member SAYS they paid, not when
  // they merely looked at the instructions.
  const claiming = body?.claim === true

  // ----- Task 82: one open claim at a time -----
  // The claimed state now lives in the ledger (not React state), so the
  // server must police duplicates too: while a non-stale claim awaits the
  // office, a second claim is refused — the member sees "we're verifying
  // your payment", and the office inbox stays quiet. A claim older than
  // CLAIM_STALE_DAYS stops gating (the office never confirmed it — the
  // member is not stuck forever).
  if (claiming) {
    const existing = await openRenewalClaim(sub.id)
    if (existing && !existing.stale) {
      return NextResponse.json(
        {
          error: 'CLAIM_ALREADY_OPEN',
          message:
            'We already have your payment note from ' +
            new Date(existing.claimedAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }) +
            ` (${existing.months} month${existing.months === 1 ? '' : 's'}, ${formatNaira(existing.amount)}, ${existing.reference}) — the office is confirming it now. No need to send it again.`,
          claim: existing,
        },
        { status: 409 }
      )
    }
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
            isInitial: isInitialPayment,
            reference: transferReference,
            receipt: transferReceipt ? 'attached' : 'none',
            planCode: pricingPlan.code,
          }),
          note: isInitialPayment
            ? `Member is completing their FIRST month (${transferReference}) — activate the membership when the transfer lands.`
            : `Member said they've paid a ${months}-month renewal (${transferReference})`,
        },
      })
    } catch (e) {
      console.error('[memberships] RENEWAL_INTENT ledger write failed:', e)
    }

    after(async () => {
      try {
        const user = await db.user.findUnique({ where: { id: userId } })
        if (user) {
          await notifyAdminRenewalTransferPending({
            member: { name: user.name, email: user.email },
            planName: pricingPlan.name,
            months,
            amount,
            transferReference,
            receiptUrl: null,
            isInitial: isInitialPayment,
          })
        }
      } catch (e) {
        console.error('[memberships] renewal transfer alert failed:', e)
      }
    })
  }

  if (method === 'BANK_TRANSFER') {
    const settings = await getAppSettings()
    return NextResponse.json({
      transfer: {
        bankName: settings.bankName,
        accountName: settings.accountName,
        accountNumber: settings.accountNumber,
        amount,
        months,
        reference: transferReference,
        note:
          isInitialPayment
            ? `Send ${formatNaira(amount)} with reference ${transferReference} — your membership activates the moment the office confirms it. You can also reply to your summary email with the receipt.`
            : saving > 0
            ? `Send ${formatNaira(amount)} with reference ${transferReference} — your ${months} months (₦${saving.toLocaleString()} saved) apply the moment the office confirms. You can also reply to your summary email with the receipt.`
            : `Send the amount with reference ${transferReference} — your next month applies the moment the office confirms. You can also reply to your summary email with the receipt.`,
      },
      claimed: claiming,
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
  // The initial payment (phase 79) rides the same shape — the webhook's
  // activateOrRenewSubscription branch activates a pending membership.
  // Phase 81: a scheduled switch also rides along — the charge is priced on
  // the plan being switched TO and the engine swaps the plan when the charge
  // succeeds.
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
      // card keeps auto-charging monthly) — including the initial payment,
      // which becomes a normal recurring membership after its first charge.
      // A multi-month prepay is a ONE-OFF charge — no plan code, or Paystack
      // would ALSO recur it.
      ...(months === 1 && pricingPlan.paystackPlanCode
        ? { plan: pricingPlan.paystackPlanCode }
        : {}),
      callback_url: `${baseUrl()}/payment/callback?ref=${encodeURIComponent(reference)}`,
      metadata: {
        subscriptionId: sub.id,
        planCode: pricingPlan.code,
        planName: pricingPlan.name,
        customerName: user.name,
        kind: 'membership',
        renewal: !isInitialPayment,
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
    recurring: months === 1 && Boolean(pricingPlan.paystackPlanCode),
  })
}
