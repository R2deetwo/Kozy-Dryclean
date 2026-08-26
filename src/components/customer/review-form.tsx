'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Star, Check, ArrowLeft, MessageSquare, MapPin, User, Loader2 } from 'lucide-react'
import { Logo } from '@/components/shell/logo'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface ReviewFormProps {
  orderId: string // the full order id (cuid) from the customer's review link
  onDone?: () => void
}

interface OrderContext {
  found: boolean
  orderNumber?: string
  status?: string
  alreadyReviewed?: boolean
  canReview?: boolean
  customerName?: string
}

export function ReviewForm({ orderId, onDone }: ReviewFormProps) {
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [displayLocation, setDisplayLocation] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Order context is fetched from the API (works on any device/browser —
  // unlike the old localStorage-based lookup).
  const [context, setContext] = useState<OrderContext | null>(null)
  const [contextError, setContextError] = useState(false)

  const loadContext = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/reviews/order-context?orderId=${encodeURIComponent(orderId)}`
      )
      if (!res.ok) throw new Error('Request failed')
      const data: OrderContext = await res.json()
      setContext(data)
      // Pre-fill the display name if the caller is the order's owner
      if (data.customerName) setDisplayName(data.customerName)
    } catch {
      setContextError(true)
    }
  }, [orderId])

  useEffect(() => {
    loadContext()
  }, [loadContext])

  const handleSubmit = async () => {
    setError(null)
    if (rating === 0) {
      setError('Please select a star rating')
      return
    }
    if (comment.trim().length < 10) {
      setError('Please write at least a sentence about your experience')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          rating,
          comment,
          displayName: displayName || null,
          displayLocation: displayLocation || null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.')
        return
      }
      setSubmitted(true)
      setTimeout(() => onDone?.(), 2500)
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ===== State: loading order context =====
  if (!context && !contextError) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <Logo size="md" />
        <div className="mt-10 flex items-center justify-center gap-2 text-navy-300">
          <Loader2 className="h-5 w-5 animate-spin" />
          <p className="text-sm">Loading your order…</p>
        </div>
      </div>
    )
  }

  // ===== State: network error =====
  if (contextError) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <Logo size="md" />
        <h1 className="mt-8 font-serif text-3xl font-semibold text-navy">
          Something went wrong
        </h1>
        <p className="mt-3 text-navy-300">
          We couldn&apos;t load your order details. Please check your connection and
          try again.
        </p>
        <Button className="mt-6" onClick={() => window.location.reload()}>
          <Loader2 className="mr-2 h-4 w-4" /> Try again
        </Button>
      </div>
    )
  }

  // ===== State: order not found =====
  if (!context?.found) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <Logo size="md" />
        <h1 className="mt-8 font-serif text-3xl font-semibold text-navy">
          Order not found
        </h1>
        <p className="mt-3 text-navy-300">
          We couldn&apos;t find this order. Check your SMS or email for the correct
          link.
        </p>
        <Button className="mt-6" onClick={() => (window.location.href = '/')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to home
        </Button>
      </div>
    )
  }

  // ===== State: order not delivered yet =====
  if (context.status !== 'DELIVERED') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <Logo size="md" />
        <h1 className="mt-8 font-serif text-3xl font-semibold text-navy">
          Order not delivered yet
        </h1>
        <p className="mt-3 text-navy-300">
          Order <strong className="text-navy">#{context.orderNumber}</strong> is currently{' '}
          <strong className="text-navy">{context.status?.replace(/_/g, ' ').toLowerCase()}</strong>.
          You&apos;ll be able to leave a review once it&apos;s been delivered.
        </p>
        <Button className="mt-6" onClick={() => (window.location.href = '/portal')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to portal
        </Button>
      </div>
    )
  }

  // ===== State: already reviewed =====
  if (context.alreadyReviewed) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
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
          This order has already been reviewed
        </h1>
        <p className="mt-3 text-navy-300">
          Order <strong className="text-navy">#{context.orderNumber}</strong> already has
          your feedback — thank you! One review per order keeps things fair.
        </p>
        <Button className="mt-6" onClick={() => (window.location.href = '/')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to home
        </Button>
      </div>
    )
  }

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
          Thank you for your feedback!
        </h1>
        <p className="mt-3 text-navy-300">
          {rating >= 4.5 ? (
            <>Your review is now live on our testimonials page. We appreciate you taking the time.</>
          ) : (
            <>
              Thanks for sharing — your feedback has been sent to our team. We take every comment
              seriously and will follow up if needed.
            </>
          )}
        </p>
        <Button className="mt-6" onClick={() => (window.location.href = '/')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to home
        </Button>
      </motion.div>
    )
  }

  // ===== Default: the review form =====
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
      <div className="flex justify-center">
        <Logo size="md" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-10"
      >
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-gold-400">
            Order #{context.orderNumber}
          </p>
          <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight text-navy sm:text-4xl">
            How was your Kozy experience?
          </h1>
          <p className="mt-3 text-navy-300">
            Your feedback helps us improve and helps other Lagos residents find a dry cleaner they
            can trust.
          </p>
        </div>

        <Card className="mt-8 border-navy-100 shadow-navy">
          <CardContent className="p-6 sm:p-8">
            {/* Star rating */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-navy">
                Rate your experience <span className="text-red-500">*</span>
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
                <span className="ml-3 text-sm font-medium text-navy-300">
                  {rating > 0 ? (
                    <>
                      {rating} star{rating > 1 ? 's' : ''}
                      {rating === 5 && ' — Excellent!'}
                      {rating === 4 && ' — Good'}
                      {rating === 3 && ' — Okay'}
                      {rating === 2 && ' — Poor'}
                      {rating === 1 && ' — Very poor'}
                    </>
                  ) : (
                    'Tap to rate'
                  )}
                </span>
              </div>
            </div>

            {/* Comment */}
            <div className="mt-6">
              <label className="mb-2 block text-sm font-semibold text-navy">
                Tell us about it <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-navy-300" />
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={5}
                  placeholder="What went well? What could be better? Mention the driver, the pickup, the cleaning quality, or anything else."
                  className="w-full resize-none rounded-xl border border-navy-200 bg-white px-3 py-2.5 pl-10 text-sm text-navy placeholder:text-navy-300 focus:border-gold-300 focus:outline-none focus:ring-2 focus:ring-gold-200"
                />
              </div>
              <p className="mt-1 text-xs text-navy-300">
                {comment.length} characters (minimum 10)
              </p>
            </div>

            {/* Display info (optional) */}
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-navy">
                  Display name <span className="text-navy-300">(optional)</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-300" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g., Chioma E."
                    className="w-full rounded-xl border border-navy-200 bg-white px-3 py-2.5 pl-10 text-sm text-navy placeholder:text-navy-300 focus:border-gold-300 focus:outline-none focus:ring-2 focus:ring-gold-200"
                  />
                </div>
                <p className="mt-1 text-xs text-navy-300">
                  Defaults to your account name. You can use a shortened form.
                </p>
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-navy">
                  Location <span className="text-navy-300">(optional)</span>
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-300" />
                  <input
                    type="text"
                    value={displayLocation}
                    onChange={(e) => setDisplayLocation(e.target.value)}
                    placeholder="e.g., Lekki Phase 1, Lagos"
                    className="w-full rounded-xl border border-navy-200 bg-white px-3 py-2.5 pl-10 text-sm text-navy placeholder:text-navy-300 focus:border-gold-300 focus:outline-none focus:ring-2 focus:ring-gold-200"
                  />
                </div>
                <p className="mt-1 text-xs text-navy-300">
                  Shown next to your testimonial (e.g., &quot;Lekki&quot;).
                </p>
              </div>
            </div>

            {/* Public visibility notice */}
            <div className="mt-6 rounded-xl bg-gold-50 p-4 text-xs leading-relaxed text-navy-300 ring-1 ring-gold-200">
              {rating >= 4.5 ? (
                <>
                  <strong className="text-navy">Reviews rated 4.5★ and above</strong> are shown
                  publicly on our testimonials carousel. You can edit your display name and
                  location above if you&apos;d prefer to stay anonymous.
                </>
              ) : (
                <>
                  <strong className="text-navy">Reviews below 4.5★ are sent privately</strong> to
                  our team — they won&apos;t appear publicly, but we read every one and will follow
                  up if you&apos;d like us to.
                </>
              )}
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="mt-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 ring-1 ring-red-200"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit */}
            <div className="mt-6 flex items-center justify-between gap-3">
              <Button
                variant="ghost"
                onClick={() => (window.location.href = '/')}
                className="text-navy-300 hover:text-navy"
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || rating === 0 || comment.trim().length < 10}
                className="bg-[#0A192F] text-white hover:bg-[#1B3A5F] disabled:opacity-40"
              >
                {submitting ? 'Submitting…' : 'Submit review'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-navy-300">
          By submitting, you agree to let Kozy Care display your review (with the display name and
          location you chose) on our public website.
        </p>
      </motion.div>
    </div>
  )
}
