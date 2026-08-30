'use client'

// =============================================================================
// /payment/pending — "we're verifying your transfer" (bank-transfer checkout)
// =============================================================================
// WHERE CUSTOMERS LAND after confirming a bank-transfer order. The booking
// wizard redirects here (instead of a toast + ambiguous success screen) so
// it is NEVER unclear whether the payment went through.
//
// What it does:
//   - States plainly: the order is in, the transfer is being verified, and an
//     email arrives the moment it's confirmed.
//   - Polls /api/orders/lookup every 10s — the moment admin verifies, the
//     page flips to "Payment confirmed" without a refresh.
//   - Reassurance box: no need to pay again, re-send anything, or re-book —
//     this is what stops duplicate submissions (and the duplicate
//     verification requests the admin was receiving).
//   - Shows the bank details recap + the narration reference so the customer
//     can double-check the transfer they made.
//
// URL: /payment/pending?order=KZ-XXXXXX&email=you@example.com
// Works for signed-in customers AND guests (email pair = the capability).
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowLeft,
  Hourglass,
  MailCheck,
  RefreshCw,
  LifeBuoy,
  Building2,
  Hash,
  AlertCircle,
} from 'lucide-react'
import { Logo } from '@/components/shell/logo'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAppSettings } from '@/lib/hooks'
import { formatNaira } from '@/lib/types'

type LookupPayment = {
  method: string
  status: string
  amount: number
  verifiedAt: string | null
}

type LookupResult = {
  orderNumber: string
  status: string
  type: string
  total: number | null
  pickupDate: string | null
  pickupTimeSlot: string | null
  createdAt: string
  payment: LookupPayment | null
}

type PageState =
  | { kind: 'checking' }
  | { kind: 'verifying'; result: LookupResult; polls: number }
  | { kind: 'verified'; result: LookupResult }
  | { kind: 'rejected'; result: LookupResult }
  | { kind: 'cancelled'; result: LookupResult }
  | { kind: 'notfound' }
  | { kind: 'error' }

/** Statuses that mean the transfer was accepted — anything from the first
 *  confirmed-payment status onward (the order may have progressed further
 *  since, which still proves the payment went through). */
const PAID_STATUSES = new Set([
  'PAYMENT_VERIFIED',
  'PICKED_UP',
  'AT_STATION',
  'PROCESSING',
  'FINISHING',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
])

const POLL_INTERVAL_MS = 10_000
const MAX_POLLS = 90 // ~15 minutes of automatic checking

export default function PaymentPendingPage() {
  const [state, setState] = useState<PageState>({ kind: 'checking' })
  const settings = useAppSettings()

  const orderNumber = useRef<string>('')
  const email = useRef<string>('')
  const polls = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelled = useRef(false)

  const stopTimer = () => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }

  const applyResult = useCallback((result: LookupResult) => {
    if (cancelled.current) return

    if (PAID_STATUSES.has(result.status) || result.payment?.status === 'VERIFIED') {
      setState({ kind: 'verified', result })
      return
    }
    if (result.payment?.status === 'REJECTED') {
      setState({ kind: 'rejected', result })
      return
    }
    if (result.status === 'CANCELLED') {
      setState({ kind: 'cancelled', result })
      return
    }
    // Still in the verification queue — keep polling while budget remains.
    setState({ kind: 'verifying', result, polls: polls.current })
  }, [])

  const check = useCallback(async () => {
    if (cancelled.current) return
    try {
      const res = await fetch(
        `/api/orders/lookup?orderNumber=${encodeURIComponent(orderNumber.current)}&email=${encodeURIComponent(email.current)}`
      )
      if (res.status === 404) {
        setState({ kind: 'notfound' })
        return
      }
      if (!res.ok) {
        // 429 / 5xx — pause briefly, then retry (unless budget exhausted).
        if (polls.current < MAX_POLLS) {
          polls.current += 1
          timer.current = setTimeout(check, POLL_INTERVAL_MS)
        } else {
          setState({ kind: 'error' })
        }
        return
      }
      const data = (await res.json()) as LookupResult
      applyResult(data)
      const settled =
        PAID_STATUSES.has(data.status) ||
        data.payment?.status === 'VERIFIED' ||
        data.payment?.status === 'REJECTED' ||
        data.status === 'CANCELLED'
      if (!settled) {
        if (polls.current < MAX_POLLS) {
          polls.current += 1
          timer.current = setTimeout(check, POLL_INTERVAL_MS)
        }
        // Budget exhausted: stay on 'verifying' — the manual refresh button
        // is always available and the email will land regardless.
      }
    } catch {
      if (polls.current < MAX_POLLS) {
        polls.current += 1
        timer.current = setTimeout(check, POLL_INTERVAL_MS)
      } else {
        setState({ kind: 'error' })
      }
    }
  }, [applyResult])

  /** Manual "Check again" — resets the polling budget and re-checks now. */
  const recheck = () => {
    stopTimer()
    polls.current = 0
    setState({ kind: 'checking' })
    check()
  }

  useEffect(() => {
    cancelled.current = false
    const params = new URLSearchParams(window.location.search)
    orderNumber.current = (params.get('order') || '').trim()
    email.current = (params.get('email') || '').trim()

    if (!orderNumber.current || !email.current) {
      setState({ kind: 'notfound' })
      return
    }
    check()

    return () => {
      cancelled.current = true
      stopTimer()
    }
  }, [])

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-linen-200 to-white">
      {/* Top nav — consistent with /payment/callback */}
      <div className="w-full border-b border-navy-100 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Logo size="md" subtitle="Drycleaning & Laundry" onClick={() => (window.location.href = '/')} />
          <Link href="/portal">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full border-navy-200 text-navy hover:bg-navy hover:text-white"
            >
              Track my order
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-12 sm:py-16">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg"
        >
          <div aria-live="polite">
            {/* ===== Initial check ===== */}
            {state.kind === 'checking' && (
              <div className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gold-100">
                  <Loader2 className="h-8 w-8 animate-spin text-gold-600" />
                </div>
                <h1 className="mt-6 font-serif text-3xl font-semibold text-navy">
                  Checking your order…
                </h1>
                <p className="mt-3 text-navy-300">One moment — fetching your payment status.</p>
              </div>
            )}

            {/* ===== VERIFIED ===== */}
            {state.kind === 'verified' && (
              <div className="text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                  className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100"
                >
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </motion.div>
                <h1 className="mt-6 font-serif text-3xl font-semibold text-navy">
                  Payment confirmed!
                </h1>
                <p className="mt-3 text-navy-300">
                  Your transfer for order{' '}
                  <strong className="text-navy">#{state.result.orderNumber}</strong>
                  {state.result.total ? <> — {formatNaira(state.result.total)}</> : <></>} has been
                  verified. Your pickup is now scheduled and a confirmation email is on its way to
                  you.
                </p>
                <div className="mt-8 flex flex-col items-center gap-3">
                  <Link href="/portal" className="w-full">
                    <Button className="w-full bg-[#0A192F] text-white hover:bg-[#1B3A5F]">
                      Track my order
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    onClick={() => (window.location.href = '/')}
                    className="text-navy-300 hover:text-navy"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to home
                  </Button>
                </div>
              </div>
            )}

            {/* ===== REJECTED ===== */}
            {state.kind === 'rejected' && (
              <div className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
                  <AlertCircle className="h-8 w-8 text-amber-600" />
                </div>
                <h1 className="mt-6 font-serif text-3xl font-semibold text-navy">
                  We couldn&apos;t match your transfer
                </h1>
                <p className="mt-3 text-navy-300">
                  Our team checked order{' '}
                  <strong className="text-navy">#{state.result.orderNumber}</strong> but couldn&apos;t
                  match a transfer{' '}
                  {state.result.payment?.amount
                    ? `of ${formatNaira(state.result.payment.amount)}`
                    : ''}{' '}
                  to it. We&apos;ve emailed you the details — nothing is lost, and no action on this
                  page is needed.
                </p>
                <Card className="mt-6 border-navy-100 bg-white text-left">
                  <CardContent className="p-5">
                    <p className="flex items-center gap-2 text-sm font-semibold text-navy">
                      <LifeBuoy className="h-4 w-4 text-gold-600" /> What to do now
                    </p>
                    <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-navy-300">
                      <li>
                        Check that your transfer went through in your banking app, and that it was
                        sent to{' '}
                        <strong className="text-navy">
                          {settings.accountNumber} ({settings.bankName})
                        </strong>
                        .
                      </li>
                      <li>
                        If you were debited, don&apos;t pay again — call us on{' '}
                        <strong className="text-navy">{settings.contactPhone}</strong> or email{' '}
                        <strong className="text-navy">{settings.contactEmail}</strong> with your
                        order number and we&apos;ll sort it out the same day.
                      </li>
                      <li>
                        If the transfer never left your account, simply send it using the details
                        above with <strong className="text-navy">#{state.result.orderNumber}</strong>{' '}
                        as the narration.
                      </li>
                    </ol>
                  </CardContent>
                </Card>
                <div className="mt-6 flex flex-col items-center gap-3">
                  <Button onClick={recheck} variant="outline" className="w-full border-navy-200 text-navy">
                    <RefreshCw className="mr-2 h-4 w-4" /> Check status again
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => (window.location.href = '/')}
                    className="text-navy-300 hover:text-navy"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to home
                  </Button>
                </div>
              </div>
            )}

            {/* ===== CANCELLED ===== */}
            {state.kind === 'cancelled' && (
              <div className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                  <XCircle className="h-8 w-8 text-red-600" />
                </div>
                <h1 className="mt-6 font-serif text-3xl font-semibold text-navy">
                  This order was cancelled
                </h1>
                <p className="mt-3 text-navy-300">
                  Order <strong className="text-navy">#{state.result.orderNumber}</strong> has been
                  cancelled. If this is unexpected, call us on{' '}
                  <strong className="text-navy">{settings.contactPhone}</strong> and we&apos;ll help
                  right away.
                </p>
                <Button
                  className="mt-8"
                  variant="outline"
                  onClick={() => (window.location.href = '/')}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back to home
                </Button>
              </div>
            )}

            {/* ===== NOT FOUND / no params ===== */}
            {state.kind === 'notfound' && (
              <div className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-navy-100">
                  <MailCheck className="h-8 w-8 text-navy-400" />
                </div>
                <h1 className="mt-6 font-serif text-3xl font-semibold text-navy">
                  Check your email
                </h1>
                <p className="mt-3 text-navy-300">
                  We couldn&apos;t pull up this order from this page — but if you completed a
                  booking, your confirmation email has everything: your order number, the transfer
                  details, and what happens next. Your pickup only proceeds once we verify your
                  transfer, and we email you the moment that happens.
                </p>
                <p className="mt-3 text-sm text-navy-300">
                  Need help? Call{' '}
                  <strong className="text-navy">{settings.contactPhone}</strong> or email{' '}
                  <strong className="text-navy">{settings.contactEmail}</strong>.
                </p>
                <div className="mt-8 flex flex-col items-center gap-3">
                  <Link href="/portal" className="w-full">
                    <Button className="w-full bg-[#0A192F] text-white hover:bg-[#1B3A5F]">
                      Track my order
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    onClick={() => (window.location.href = '/')}
                    className="text-navy-300 hover:text-navy"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to home
                  </Button>
                </div>
              </div>
            )}

            {/* ===== ERROR (rate limit / network after retry budget) ===== */}
            {state.kind === 'error' && (
              <div className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                  <XCircle className="h-8 w-8 text-red-600" />
                </div>
                <h1 className="mt-6 font-serif text-3xl font-semibold text-navy">
                  Status check paused
                </h1>
                <p className="mt-3 text-navy-300">
                  We stopped checking automatically. This doesn&apos;t affect your payment — our
                  team is verifying your transfer and you&apos;ll get an email the moment it&apos;s
                  confirmed. You can also check the status again in a few minutes.
                </p>
                <div className="mt-8 flex flex-col items-center gap-3">
                  <Button onClick={recheck} variant="outline" className="w-full border-navy-200 text-navy">
                    <RefreshCw className="mr-2 h-4 w-4" /> Check status again
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => (window.location.href = '/')}
                    className="text-navy-300 hover:text-navy"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to home
                  </Button>
                </div>
              </div>
            )}

            {/* ===== VERIFYING — the main state ===== */}
            {state.kind === 'verifying' && (
              <div>
                <div className="text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                    className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gold-100"
                  >
                    <Hourglass className="h-8 w-8 animate-pulse text-gold-600" />
                  </motion.div>
                  <h1 className="mt-6 font-serif text-3xl font-semibold text-navy">
                    We&apos;re verifying your payment
                  </h1>
                  <p className="mt-3 leading-relaxed text-navy-300">
                    Order <strong className="text-navy">#{state.result.orderNumber}</strong> is in —{' '}
                    {state.result.total ? (
                      <>
                        we received your transfer notice for{' '}
                        <strong className="text-navy">{formatNaira(state.result.total)}</strong>.{' '}
                      </>
                    ) : null}
                    Our team is confirming it right now,{' '}
                    <strong className="text-navy">
                      and you&apos;ll get an email the moment it&apos;s verified
                    </strong>{' '}
                    — usually within minutes during business hours.
                  </p>
                </div>

                {/* Status timeline */}
                <div className="mt-6 flex items-center justify-center gap-2 text-xs font-medium">
                  <span className="flex items-center gap-1.5 rounded-full bg-gold-100 px-3 py-1.5 text-navy">
                    <CheckCircle2 className="h-3.5 w-3.5 text-gold-600" /> Transfer submitted
                  </span>
                  <span className="h-px w-4 bg-navy-200" />
                  <span className="flex items-center gap-1.5 rounded-full bg-navy-800 px-3 py-1.5 text-white">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Verifying now
                  </span>
                  <span className="h-px w-4 bg-navy-200" />
                  <span className="flex items-center gap-1.5 rounded-full bg-linen-200 px-3 py-1.5 text-navy-300">
                    <MailCheck className="h-3.5 w-3.5" /> Email confirmation
                  </span>
                </div>

                {/* Reassurance — the anti-duplicate-submission message */}
                <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
                  <p className="text-sm font-semibold text-emerald-900">
                    You&apos;re all set — no need to pay again or re-book
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-emerald-800/90">
                    Your order and payment details are with our team. Please don&apos;t send the
                    transfer again or place the order a second time — if you completed the
                    transfer, we have it. This page updates itself, and the email will follow.
                  </p>
                </div>

                {/* Transfer recap */}
                <Card className="mt-4 border-gold-200 bg-gold-50/40">
                  <CardContent className="p-5">
                    <p className="flex items-center gap-2 text-sm font-semibold text-navy">
                      <Building2 className="h-4 w-4 text-gold-600" /> Your transfer, for reference
                    </p>
                    <div className="mt-3 space-y-1 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-navy-300">Bank</span>
                        <span className="font-medium">{settings.bankName}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-navy-300">Account name</span>
                        <span className="font-medium">{settings.accountName}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-navy-300">Account number</span>
                        <span className="font-mono font-bold text-navy">{settings.accountNumber}</span>
                      </div>
                      {state.result.total ? (
                        <div className="flex items-center justify-between">
                          <span className="text-navy-300">Amount</span>
                          <span className="font-bold text-navy">{formatNaira(state.result.total)}</span>
                        </div>
                      ) : null}
                      <div className="flex items-center justify-between">
                        <span className="text-navy-300">Narration</span>
                        <span className="flex items-center gap-1 font-mono font-bold text-navy">
                          <Hash className="h-3.5 w-3.5 text-gold-600" />
                          {state.result.orderNumber}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Actions */}
                <div className="mt-6 flex flex-col items-center gap-3">
                  <Button
                    onClick={recheck}
                    variant="outline"
                    className="w-full border-navy-200 text-navy"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" /> Check status now
                  </Button>
                  <p className="text-center text-xs text-navy-300">
                    This page checks automatically every 10 seconds — you can also close it and
                    wait for your email. Questions? Call{' '}
                    <strong className="text-navy">{settings.contactPhone}</strong>.
                  </p>
                  <Button
                    variant="ghost"
                    onClick={() => (window.location.href = '/')}
                    className="text-navy-300 hover:text-navy"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to home
                  </Button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
