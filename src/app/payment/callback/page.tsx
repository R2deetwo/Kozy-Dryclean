'use client'

// =============================================================================
// /payment/callback — where Paystack sends customers back after checkout
// =============================================================================
// Reads ?ref= from the URL, polls /api/paystack/verify (the webhook may take
// a moment to process), and shows a branded result screen. Works for signed-in
// customers AND guests.
// =============================================================================

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { CheckCircle2, XCircle, Loader2, ArrowLeft } from 'lucide-react'
import { Logo } from '@/components/shell/logo'
import { Button } from '@/components/ui/button'
import { formatNaira } from '@/lib/types'

type VerifyState =
  | { kind: 'loading' }
  | { kind: 'polling'; attempt: number }
  | { kind: 'success'; amount: number | null; orderNumber: string }
  | { kind: 'failed' }
  | { kind: 'error' }

export default function PaymentCallbackPage() {
  const [state, setState] = useState<VerifyState>({ kind: 'loading' })
  const attempts = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref')
    if (!ref) {
      setState({ kind: 'error' })
      return
    }

    let cancelled = false

    const poll = async () => {
      if (cancelled) return
      attempts.current += 1
      try {
        const res = await fetch(`/api/paystack/verify?reference=${encodeURIComponent(ref)}`)
        if (res.status === 503) {
          // Online payments not configured — shouldn't normally happen here
          setState({ kind: 'error' })
          return
        }
        const data = await res.json()
        if (data.paid) {
          setState({ kind: 'success', amount: data.amount ?? null, orderNumber: data.orderNumber ?? ref })
          return
        }
        if (data.status === 'failed') {
          setState({ kind: 'failed' })
          return
        }
        // 'abandoned' / 'pending' / 'unknown' → keep polling briefly:
        // webhook processing usually lands within a few seconds
        if (attempts.current < 6) {
          setState({ kind: 'polling', attempt: attempts.current })
          timer.current = setTimeout(poll, 3000)
        } else {
          // Give up gracefully — payment may still complete (webhook will
          // process it) but we stop making the customer wait
          setState({ kind: 'failed' })
        }
      } catch {
        if (attempts.current < 6) {
          timer.current = setTimeout(poll, 3000)
        } else {
          setState({ kind: 'error' })
        }
      }
    }

    poll()
    return () => {
      cancelled = true
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-linen-200 to-white">
      {/* Top nav */}
      <div className="w-full border-b border-navy-100 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Logo size="md" subtitle="Premium Drycleaning & Laundry" onClick={() => (window.location.href = '/')} />
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md text-center"
        >
          {/* ===== Loading / polling ===== */}
          {(state.kind === 'loading' || state.kind === 'polling') && (
            <>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gold-100">
                <Loader2 className="h-8 w-8 animate-spin text-gold-600" />
              </div>
              <h1 className="mt-6 font-serif text-3xl font-semibold text-navy">
                Confirming your payment…
              </h1>
              <p className="mt-3 text-navy-300">
                This usually takes just a few seconds. Please don&apos;t close this page.
              </p>
            </>
          )}

          {/* ===== Success ===== */}
          {state.kind === 'success' && (
            <>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100"
              >
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </motion.div>
              <h1 className="mt-6 font-serif text-3xl font-semibold text-navy">
                Payment received!
              </h1>
              <p className="mt-3 text-navy-300">
                Order <strong className="text-navy">#{state.orderNumber}</strong>
                {state.amount ? (
                  <> — {formatNaira(state.amount)} paid.</>
                ) : (
                  <> is confirmed.</>
                )}{' '}
                We&apos;ve emailed your receipt and your pickup is now scheduled.
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
            </>
          )}

          {/* ===== Failed / abandoned ===== */}
          {state.kind === 'failed' && (
            <>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
                <XCircle className="h-8 w-8 text-amber-600" />
              </div>
              <h1 className="mt-6 font-serif text-3xl font-semibold text-navy">
                Payment not completed
              </h1>
              <p className="mt-3 text-navy-300">
                We couldn&apos;t confirm this payment. If you were interrupted, you can safely
                retry — you won&apos;t be charged twice. Or pay by bank transfer instead.
              </p>
              <div className="mt-8 flex flex-col items-center gap-3">
                <Button
                  onClick={() => window.history.back()}
                  className="w-full bg-gold-gradient text-navy hover:opacity-90"
                >
                  Try payment again
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => (window.location.href = '/')}
                  className="text-navy-300 hover:text-navy"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back to home
                </Button>
              </div>
            </>
          )}

          {/* ===== Error ===== */}
          {state.kind === 'error' && (
            <>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                <XCircle className="h-8 w-8 text-red-600" />
              </div>
              <h1 className="mt-6 font-serif text-3xl font-semibold text-navy">
                Something went wrong
              </h1>
              <p className="mt-3 text-navy-300">
                We couldn&apos;t check this payment. If you were charged, don&apos;t worry —
                our team verifies payments automatically. Call us on +234 800 569 3789 if
                you need help.
              </p>
              <Button
                className="mt-8"
                variant="outline"
                onClick={() => (window.location.href = '/')}
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to home
              </Button>
            </>
          )}
        </motion.div>
      </div>
    </div>
  )
}
