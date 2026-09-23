'use client'

// =============================================================================
// /milestone — the private 10-order appreciation page (phase 52)
// =============================================================================
// Reached from the appreciation email (HMAC token link) or quietly from the
// portal of a 10+ order customer. Two jobs, both premium in tone:
//   1. A GENERAL feedback ask — about the relationship, not one order.
//      Submissions ride the existing /api/feedback pipeline, so they land
//      in the admin Feedback inbox AND ping the admins by email. They are
//      never published to the testimonial wall (Feedback rows are private
//      by design).
//   2. The silent referral reveal — the personal code, the friend courtesy,
//      and the thank-you credit balance. Nothing on the public site points
//      here; the code exists only for the customer holding this page.
// =============================================================================

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Star,
  Check,
  ArrowLeft,
  Loader2,
  Copy,
  Gift,
  Sparkles,
  MessageSquareHeart,
} from 'lucide-react'
import { Logo } from '@/components/shell/logo'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { formatNaira } from '@/lib/types'

interface ReferralState {
  deliveredCount: number
  eligible: boolean
  code: string | null
  credit: number
  friendDiscountPercent: number
  rewardAmount: number
  userName: string
  userEmail: string
}

interface MilestonePageProps {
  token?: string
}

export function MilestonePage({ token }: MilestonePageProps) {
  const [state, setState] = useState<ReferralState | null>(null)
  const [loadError, setLoadError] = useState(false)

  // The form
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [standout, setStandout] = useState('')
  const [improve, setImprove] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // The code copy interaction
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    try {
      const url = token ? `/api/referrals?token=${encodeURIComponent(token)}` : '/api/referrals'
      const res = await fetch(url)
      if (!res.ok) throw new Error('Request failed')
      const data: ReferralState = await res.json()
      setState(data)
    } catch {
      setLoadError(true)
    }
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  const copyCode = async () => {
    if (!state?.code) return
    try {
      await navigator.clipboard.writeText(state.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard unavailable (permissions / old browser) — the code is
      // large and selectable, so the fallback is simply selecting it.
    }
  }

  const handleSubmit = async () => {
    setError(null)
    if (!state) return
    if (rating === 0) {
      setError('Please select an overall rating')
      return
    }
    if (standout.trim().length < 10) {
      setError('Please write at least a sentence about what has stood out')
      return
    }
    setSubmitting(true)
    try {
      const message = improve.trim()
        ? `${standout.trim()}\n\nWhere we could serve you better: ${improve.trim()}`
        : standout.trim()
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'REVIEW',
          name: state.userName,
          email: state.userEmail,
          reference: `Milestone — ${state.deliveredCount} orders`,
          rating,
          message,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong — please try again.')
      }
      setSubmitted(true)
    } catch (e: any) {
      setError(e.message || 'Something went wrong — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ===== State: link problem (no session, bad token) =====
  if (loadError) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <Logo size="md" />
        <h1 className="mt-8 font-serif text-3xl font-semibold text-navy">
          This link isn&apos;t working
        </h1>
        <p className="mt-3 text-navy-300">
          The page may have expired or been copied incompletely. If you have an
          account with us, sign in and it will appear in your portal.
        </p>
        <Button className="mt-6" variant="outline" onClick={() => (window.location.href = '/login')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Sign in
        </Button>
      </div>
    )
    }

  // ===== State: loading =====
  if (!state) {
    return (
      <div className="mx-auto flex max-w-2xl items-center justify-center px-4 py-24">
        <Loader2 className="h-7 w-7 animate-spin text-navy-300" />
      </div>
    )
  }

  const countWord = state.deliveredCount === 10 ? 'Ten' : String(state.deliveredCount)

  // ===== State: submitted =====
  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-2xl px-4 py-16 text-center"
      >
        <Logo size="md" />
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
          className="mx-auto mt-8 flex h-16 w-16 items-center justify-center rounded-full bg-gold-100"
        >
          <Check className="h-8 w-8 text-gold-600" />
        </motion.div>
        <h1 className="mt-6 font-serif text-3xl font-semibold text-navy">
          Thank you — truly.
        </h1>
        <p className="mt-3 text-navy-300">
          Your words went straight to the people who make the decisions, and they
          will be read with care. Thank you for {countWord.toLowerCase()} orders of trust.
        </p>
        {state.code && (
          <Card className="mt-8 border-navy-100 shadow-navy">
            <CardContent className="p-6 text-left">
              <p className="text-xs font-semibold uppercase tracking-wider text-gold-400">
                Your personal code, whenever you need it
              </p>
              <p className="mt-2 select-all text-center font-serif text-2xl font-bold tracking-[0.2em] text-navy">
                {state.code}
              </p>
            </CardContent>
          </Card>
        )}
        <Button className="mt-6" onClick={() => (window.location.href = '/')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to home
        </Button>
      </motion.div>
    )
  }

  // ===== Default: appreciation + general feedback + referral reveal =====
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
      <div className="flex justify-center">
        <Logo size="md" />
      </div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-10">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-gold-400">
            A quiet thank-you
          </p>
          <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight text-navy sm:text-4xl">
            {countWord} orders.
          </h1>
          <p className="mt-3 text-navy-300">
            The suits, the shirts, the household pieces — entrusted to us again and again.
            Before anything else: thank you, {state.userName.split(' ')[0]}.
          </p>
        </div>

        {/* ----- The general feedback ask ----- */}
        <Card className="mt-8 border-navy-100 shadow-navy">
          <CardContent className="p-6 sm:p-8">
            <div className="flex items-center gap-2 text-sm font-semibold text-navy">
              <MessageSquareHeart className="h-4 w-4 text-gold-500" />
              How has the whole experience felt?
            </div>
            <p className="mt-1 text-sm text-navy-300">
              Not about one order — about the relationship. It goes straight to the people who
              make the decisions, and it is never published anywhere.
            </p>

            {/* Overall rating */}
            <div className="mt-6">
              <label className="mb-2 block text-sm font-semibold text-navy">
                Overall, how would you rate us? <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="rounded p-1 transition hover:bg-gold-50"
                    aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                  >
                    <Star
                      className={cn(
                        'h-9 w-9 transition',
                        (hoverRating || rating) >= star
                          ? 'fill-gold-400 text-gold-400'
                          : 'fill-transparent text-navy-200'
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* What has stood out */}
            <div className="mt-5">
              <label htmlFor="standout" className="mb-2 block text-sm font-semibold text-navy">
                What has stood out? <span className="text-red-500">*</span>
              </label>
              <textarea
                id="standout"
                value={standout}
                onChange={(e) => setStandout(e.target.value)}
                rows={4}
                maxLength={1500}
                placeholder="The finish on your shirts, the pickup punctuality, the way a delicate piece was handled — whatever comes to mind first."
                className="w-full resize-none rounded-lg border border-navy-200 bg-white px-3 py-2.5 text-sm text-navy placeholder:text-navy-200 focus:border-gold-400 focus:outline-none focus:ring-1 focus:ring-gold-300"
              />
            </div>

            {/* Where could we serve you better */}
            <div className="mt-4">
              <label htmlFor="improve" className="mb-2 block text-sm font-semibold text-navy">
                Where could we serve you even better?{' '}
                <span className="font-normal text-navy-300">(optional)</span>
              </label>
              <textarea
                id="improve"
                value={improve}
                onChange={(e) => setImprove(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="The honest one — we would rather hear it from you than never hear it at all."
                className="w-full resize-none rounded-lg border border-navy-200 bg-white px-3 py-2.5 text-sm text-navy placeholder:text-navy-200 focus:border-gold-400 focus:outline-none focus:ring-1 focus:ring-gold-300"
              />
            </div>

            {error && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}

            <div className="mt-6 flex items-center justify-between gap-3">
              <p className="text-xs text-navy-300">
                From <span className="text-navy">{state.userEmail}</span> — about two minutes.
              </p>
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="rounded-full bg-gold-gradient text-navy hover:opacity-90"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…
                  </>
                ) : (
                  'Share your thoughts'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ----- The silent referral reveal (eligible customers only) ----- */}
        {state.eligible && state.code && (
          <Card className="mt-6 border-navy-100 shadow-navy">
            <CardContent className="p-6 sm:p-8">
              <div className="flex items-center gap-2 text-sm font-semibold text-navy">
                <Gift className="h-4 w-4 text-gold-500" />
                A quiet way to share the care
              </div>
              <p className="mt-1 text-sm text-navy-300">
                If someone in your circle would value the same standard, this is your personal
                code. No fanfare — it is simply yours.
              </p>

              <div className="mt-5 flex items-center justify-center">
                <div className="flex items-center gap-3 rounded-xl border border-gold-300 bg-gold-50 px-6 py-4">
                  <span className="select-all font-serif text-2xl font-bold tracking-[0.2em] text-navy">
                    {state.code}
                  </span>
                  <button
                    type="button"
                    onClick={copyCode}
                    className="rounded-full border border-navy-200 bg-white p-2 text-navy transition hover:border-gold-300 hover:text-gold-600"
                    aria-label="Copy your referral code"
                    title="Copy code"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              {copied && (
                <p className="mt-2 text-center text-xs text-emerald-600">Copied to your clipboard</p>
              )}

              <div className="mt-5 space-y-2 text-sm text-navy-300">
                {state.friendDiscountPercent > 0 && (
                  <p className="flex items-start gap-2">
                    <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-500" />
                    Friends booking their first order with it receive{' '}
                    <strong className="text-navy">{state.friendDiscountPercent}% off</strong>.
                  </p>
                )}
                {state.rewardAmount > 0 && (
                  <p className="flex items-start gap-2">
                    <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-500" />
                    When their order is delivered, a{' '}
                    <strong className="text-navy">{formatNaira(state.rewardAmount)} thank-you credit</strong>{' '}
                    lands on your account — applied automatically to your next pickup.
                  </p>
                )}
                {state.credit > 0 && (
                  <p className="flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-emerald-800 ring-1 ring-emerald-200">
                    <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    A {formatNaira(state.credit)} thank-you credit is already on your account — it
                    applies automatically to your next retail order.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="mt-8 text-center">
          <Button
            variant="ghost"
            onClick={() => (window.location.href = '/portal')}
            className="rounded-full text-navy-300 hover:text-navy"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to my portal
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
