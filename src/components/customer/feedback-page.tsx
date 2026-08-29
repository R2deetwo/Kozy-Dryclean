'use client'

// =============================================================================
// FeedbackPage — the standalone feedback page (Phase 17, client directive).
// =============================================================================
// Replaces the old "Reviews & Complaints" section that sat inside the landing
// page. The client's rules, implemented here:
//   1. Reviews are tied to COMPLETED orders. A non-registered customer CAN
//      review, but only with an order number (plus the email/phone used at
//      booking, so nobody reviews somebody else's order).
//   2. Complaints & questions go straight to the team inbox — they never
//      appear publicly.
//   3. Improper content is screened server-side (regex moderation) — it can
//      never reach the testimonial wall, whatever the star rating.
//   4. The page is reached from the "Loved by Lagos" section's feedback
//      button and from the portal after delivery — leaving a review never
//      interrupts browsing; customers simply come back when they're done.
// =============================================================================

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useSession } from 'next-auth/react'
import {
  Star,
  Check,
  ArrowLeft,
  MessageSquare,
  MapPin,
  User,
  Loader2,
  Search,
  Send,
  PackageSearch,
  ShieldCheck,
} from 'lucide-react'
import { Logo } from '@/components/shell/logo'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type Mode = 'REVIEW' | 'COMPLAINT' | 'QUESTION'

interface OrderContext {
  found: boolean
  error?: string
  orderNumber?: string
  status?: string
  alreadyReviewed?: boolean
  canReview?: boolean
  customerName?: string
}

const MODE_OPTIONS: { id: Mode; label: string; hint: string }[] = [
  { id: 'REVIEW', label: 'Review an order', hint: 'Delivered order? Tell Lagos how we did' },
  { id: 'COMPLAINT', label: 'Make a complaint', hint: 'Something wrong? We make it right' },
  { id: 'QUESTION', label: 'Ask a question', hint: 'Pricing, pickup, alterations — anything' },
]

export function FeedbackPage() {
  const { data: session } = useSession()
  const signedIn = Boolean(session?.user)

  const [mode, setMode] = useState<Mode>('REVIEW')

  // ----- Review flow state -----
  const [orderNumber, setOrderNumber] = useState('')
  const [contact, setContact] = useState('')
  const [looking, setLooking] = useState(false)
  const [context, setContext] = useState<OrderContext | null>(null)
  const [lookupError, setLookupError] = useState<string | null>(null)

  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [displayLocation, setDisplayLocation] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [reviewDone, setReviewDone] = useState(false)

  // ----- Complaint / question state -----
  const [fbName, setFbName] = useState('')
  const [fbEmail, setFbEmail] = useState('')
  const [fbPhone, setFbPhone] = useState('')
  const [fbReference, setFbReference] = useState('')
  const [fbMessage, setFbMessage] = useState('')
  const [fbSending, setFbSending] = useState(false)
  const [fbDone, setFbDone] = useState(false)
  const [fbError, setFbError] = useState<string | null>(null)

  const orderNumberValid = /^KZ-?\d{6,10}$/i.test(orderNumber.trim())
  const contactValid = contact.trim().length >= 5 || signedIn

  // ---------------------------------------------------------------------
  // Review flow: look the order up (order number + booking contact)
  // ---------------------------------------------------------------------
  const lookupOrder = async () => {
    if (!orderNumberValid) return
    setLooking(true)
    setLookupError(null)
    setContext(null)
    try {
      const params = new URLSearchParams({ orderNumber: orderNumber.trim() })
      if (contact.trim()) params.set('contact', contact.trim())
      const res = await fetch(`/api/reviews/order-context?${params.toString()}`)
      if (!res.ok) throw new Error('Request failed')
      const data: OrderContext = await res.json()
      if (!data.found) {
        if (data.error === 'contact_required' || data.error === 'invalid_number') {
          setLookupError(
            data.error === 'invalid_number'
              ? 'Enter your order number as KZ-12345678 (check your SMS or email confirmation).'
              : 'We could not verify that order with those details. Please check the order number and the email or phone number you booked with.'
          )
        } else {
          setLookupError(
            'We could not find that order. Please check your order number (e.g. KZ-12345678) — it is in your booking confirmation.'
          )
        }
        return
      }
      setContext(data)
      if (data.customerName) setDisplayName(data.customerName)
    } catch {
      setLookupError('Network error — please check your connection and try again.')
    } finally {
      setLooking(false)
    }
  }

  // ---------------------------------------------------------------------
  // Review flow: submit
  // ---------------------------------------------------------------------
  const submitReview = async () => {
    setReviewError(null)
    if (rating === 0) {
      setReviewError('Please select a star rating')
      return
    }
    if (comment.trim().length < 10) {
      setReviewError('Please write at least a sentence about your experience')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber: orderNumber.trim(),
          contact: contact.trim() || undefined,
          rating,
          comment,
          displayName: displayName || null,
          displayLocation: displayLocation || null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setReviewError(data.error || 'Something went wrong. Please try again.')
        return
      }
      setReviewDone(true)
    } catch {
      setReviewError('Network error. Please check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ---------------------------------------------------------------------
  // Complaint / question flow
  // ---------------------------------------------------------------------
  const submitFeedback = async () => {
    setFbError(null)
    if (fbName.trim().length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fbEmail.trim())) {
      setFbError('Please enter your name and a valid email address.')
      return
    }
    if (fbMessage.trim().length < 10) {
      setFbError('Please give us a little more detail (10+ characters).')
      return
    }
    setFbSending(true)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: mode,
          name: fbName.trim(),
          email: fbEmail.trim(),
          phone: fbPhone.trim() || undefined,
          reference: fbReference.trim() || undefined,
          message: fbMessage.trim(),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setFbError(data.error || 'Could not send your message. Please try again.')
        return
      }
      setFbDone(true)
    } catch {
      setFbError('Network error. Please check your connection and try again.')
    } finally {
      setFbSending(false)
    }
  }

  // =====================================================================
  // Render
  // =====================================================================
  return (
    <div className="min-h-screen bg-linen pb-20">
      <div className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
        <div className="flex justify-center">
          <Link href="/" aria-label="Back to Kozy Care home">
            <Logo size="md" />
          </Link>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-10 text-center"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-gold-400">
            Feedback
          </p>
          <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight text-navy sm:text-4xl">
            How did we do?
          </h1>
          <p className="mt-3 text-navy-300">
            Reviews keep us honest and help other Lagos residents find a dry
            cleaner they can trust. Complaints and questions go straight to the
            team — answered within one working day.
          </p>
        </motion.div>

        {/* Mode selector */}
        <div className="mt-8 grid grid-cols-3 gap-2">
          {MODE_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setMode(o.id)}
              aria-pressed={mode === o.id}
              className={cn(
                'rounded-xl border-2 px-2 py-2.5 text-center transition',
                mode === o.id
                  ? 'border-gold-400 bg-gold-50/60'
                  : 'border-navy-100 bg-white hover:border-gold-200'
              )}
            >
              <p className="text-xs font-semibold text-navy">{o.label}</p>
              <p className="mt-0.5 hidden text-[10px] leading-tight text-navy-300 sm:block">
                {o.hint}
              </p>
            </button>
          ))}
        </div>

        {/* ------------------------------------------------- REVIEW MODE */}
        {mode === 'REVIEW' && (
          <Card className="mt-6 border-navy-100 shadow-navy">
            <CardContent className="p-6 sm:p-8">
              {reviewDone ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gold-100">
                    <Check className="h-8 w-8 text-gold-600" />
                  </div>
                  <h2 className="mt-5 font-serif text-2xl font-semibold text-navy">
                    Thank you — your review is in.
                  </h2>
                  <p className="mt-2 max-w-sm text-sm leading-relaxed text-navy-300">
                    We read every single one. If anything needs following up, our
                    team will reach out.
                  </p>
                  <div className="mt-6 flex flex-wrap justify-center gap-3">
                    <Button
                      variant="outline"
                      className="rounded-full border-navy-200 text-navy hover:bg-navy hover:text-white"
                      onClick={() => (window.location.href = '/')}
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" /> Back to home
                    </Button>
                    <Button
                      variant="ghost"
                      className="rounded-full text-navy-300 hover:text-navy"
                      onClick={() => {
                        setReviewDone(false)
                        setContext(null)
                        setRating(0)
                        setComment('')
                        setOrderNumber('')
                        setContact('')
                      }}
                    >
                      Review another order
                    </Button>
                  </div>
                </div>
              ) : !context?.found || !context.canReview ? (
                <>
                  <div className="flex items-center gap-2">
                    <PackageSearch className="h-5 w-5 text-gold-500" />
                    <h3 className="font-serif text-lg font-semibold text-navy">
                      Which order are you reviewing?
                    </h3>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-navy-300">
                    Reviews are tied to completed orders — that is what keeps this
                    wall honest. Enter your order number (from your SMS or email
                    confirmation) plus the email or phone number you booked with.
                  </p>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-sm font-semibold text-navy">
                        Order number <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={orderNumber}
                          onChange={(e) => {
                            setOrderNumber(e.target.value)
                            setContext(null)
                          }}
                          placeholder="KZ-12345678"
                          className="w-full rounded-xl border border-navy-200 bg-white px-3 py-2.5 pl-10 font-mono text-sm text-navy placeholder:text-navy-300 focus:border-gold-300 focus:outline-none focus:ring-2 focus:ring-gold-200"
                        />
                        <PackageSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-300" />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-semibold text-navy">
                        Email or phone you booked with{' '}
                        {!signedIn && <span className="text-red-500">*</span>}
                      </label>
                      <input
                        type="text"
                        value={contact}
                        onChange={(e) => {
                          setContact(e.target.value)
                          setContext(null)
                        }}
                        placeholder={signedIn ? 'Signed in — usually not needed' : 'you@example.com or 0803…'}
                        className="w-full rounded-xl border border-navy-200 bg-white px-3 py-2.5 text-sm text-navy placeholder:text-navy-300 focus:border-gold-300 focus:outline-none focus:ring-2 focus:ring-gold-200"
                      />
                    </div>
                  </div>

                  {lookupError && (
                    <p className="mt-3 rounded-lg bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 ring-1 ring-red-200">
                      {lookupError}
                    </p>
                  )}

                  <Button
                    onClick={lookupOrder}
                    disabled={!orderNumberValid || !contactValid || looking}
                    className="mt-5 w-full rounded-full bg-gold-gradient text-navy hover:opacity-90"
                  >
                    {looking ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Checking your order…
                      </>
                    ) : (
                      <>
                        <Search className="mr-2 h-4 w-4" /> Find my order
                      </>
                    )}
                  </Button>

                  <div className="mt-4 flex items-start gap-2 rounded-xl bg-linen-50 p-3 text-[11px] leading-relaxed text-navy-300 ring-1 ring-navy-100">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-gold-500" />
                    <span>
                      One review per order. Your order number proves the review is
                      real — it is shown masked (e.g. KZ-••3846) next to your
                      review, and nothing else about your order is ever published.
                    </span>
                  </div>
                </>
              ) : (
                <>
                  {/* ---- Verified order — the review form ---- */}
                  <div className="text-center">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-50 px-3 py-1 text-xs font-semibold text-navy ring-1 ring-gold-300">
                      <ShieldCheck className="h-3.5 w-3.5 text-gold-500" />
                      Verified order #{context.orderNumber}
                    </span>
                    <h3 className="mt-3 font-serif text-2xl font-semibold text-navy">
                      How was your Kozy experience?
                    </h3>
                  </div>

                  {/* Stars */}
                  <div className="mt-6">
                    <label className="mb-2 block text-sm font-semibold text-navy">
                      Rate your experience <span className="text-red-500">*</span>
                    </label>
                    <div className="flex items-center gap-1.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setRating(s)}
                          onMouseEnter={() => setHoverRating(s)}
                          onMouseLeave={() => setHoverRating(0)}
                          className="rounded p-1 transition hover:bg-gold-50"
                          aria-label={`Rate ${s} star${s > 1 ? 's' : ''}`}
                        >
                          <Star
                            className={cn(
                              'h-9 w-9 transition',
                              (hoverRating || rating) >= s
                                ? 'fill-gold-400 text-gold-400'
                                : 'fill-transparent text-navy-200'
                            )}
                          />
                        </button>
                      ))}
                      <span className="ml-3 text-sm font-medium text-navy-300">
                        {rating > 0 ? `${rating} star${rating > 1 ? 's' : ''}` : 'Tap to rate'}
                      </span>
                    </div>
                  </div>

                  {/* Comment */}
                  <div className="mt-5">
                    <label className="mb-2 block text-sm font-semibold text-navy">
                      Tell us about it <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-navy-300" />
                      <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        rows={4}
                        placeholder="What went well? What could be better? Mention the pickup, the cleaning, the delivery — anything."
                        className="w-full resize-none rounded-xl border border-navy-200 bg-white px-3 py-2.5 pl-10 text-sm text-navy placeholder:text-navy-300 focus:border-gold-300 focus:outline-none focus:ring-2 focus:ring-gold-200"
                      />
                    </div>
                    <p className="mt-1 text-xs text-navy-300">
                      {comment.trim().length} characters (minimum 10)
                    </p>
                  </div>

                  {/* Display name / location */}
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
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
                          placeholder="e.g. Chioma E."
                          className="w-full rounded-xl border border-navy-200 bg-white px-3 py-2.5 pl-10 text-sm text-navy placeholder:text-navy-300 focus:border-gold-300 focus:outline-none focus:ring-2 focus:ring-gold-200"
                        />
                      </div>
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
                          placeholder="e.g. Lekki Phase 1"
                          className="w-full rounded-xl border border-navy-200 bg-white px-3 py-2.5 pl-10 text-sm text-navy placeholder:text-navy-300 focus:border-gold-300 focus:outline-none focus:ring-2 focus:ring-gold-200"
                        />
                      </div>
                    </div>
                  </div>

                  {reviewError && (
                    <p className="mt-4 rounded-lg bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 ring-1 ring-red-200">
                      {reviewError}
                    </p>
                  )}

                  <div className="mt-6 flex items-center justify-between gap-3">
                    <Button
                      variant="ghost"
                      onClick={() => setContext(null)}
                      className="text-navy-300 hover:text-navy"
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" /> Use a different order
                    </Button>
                    <Button
                      onClick={submitReview}
                      disabled={submitting || rating === 0 || comment.trim().length < 10}
                      className="bg-[#0A192F] text-white hover:bg-[#1B3A5F] disabled:opacity-40"
                    >
                      {submitting ? 'Submitting…' : 'Submit review'}
                    </Button>
                  </div>

                  <p className="mt-5 text-center text-xs leading-relaxed text-navy-300">
                    By submitting you agree to our{' '}
                    <Link href="/terms" className="font-medium text-gold-600 underline-offset-2 hover:underline">
                      Terms of Service
                    </Link>
                    , which explains how reviews may be displayed.
                  </p>
                </>
              )}

              {/* Order found but not reviewable */}
              {context?.found && !context.canReview && !reviewDone && (
                <div className="mt-5 rounded-xl bg-gold-50 p-4 text-sm leading-relaxed text-navy-300 ring-1 ring-gold-200">
                  {context.alreadyReviewed ? (
                    <>
                      Order <strong className="text-navy">#{context.orderNumber}</strong> already
                      has your review — thank you! One review per order keeps things fair.
                    </>
                  ) : (
                    <>
                      Order <strong className="text-navy">#{context.orderNumber}</strong> is
                      currently{' '}
                      <strong className="text-navy">
                        {context.status?.replace(/_/g, ' ').toLowerCase()}
                      </strong>
                      . You&apos;ll be able to review it once it&apos;s been delivered.
                    </>
                  )}
                  <Button
                    variant="outline"
                    className="mt-3 w-full rounded-full border-navy-200 text-navy hover:bg-navy hover:text-white"
                    onClick={() => (window.location.href = '/')}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to home
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* --------------------------------- COMPLAINT / QUESTION MODE */}
        {mode !== 'REVIEW' && (
          <Card className="mt-6 border-navy-100 shadow-navy">
            <CardContent className="p-6 sm:p-8">
              {fbDone ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gold-100">
                    <Check className="h-8 w-8 text-gold-600" />
                  </div>
                  <h2 className="mt-5 font-serif text-2xl font-semibold text-navy">
                    {mode === 'COMPLAINT' ? 'Complaint received.' : 'Question received.'}
                  </h2>
                  <p className="mt-2 max-w-sm text-sm leading-relaxed text-navy-300">
                    It&apos;s with the team now — we reply within one working day,
                    usually much sooner.
                    {fbReference ? ` Logged against ${fbReference.trim()}.` : ''}
                  </p>
                  <div className="mt-6 flex flex-wrap justify-center gap-3">
                    <Button
                      variant="outline"
                      className="rounded-full border-navy-200 text-navy hover:bg-navy hover:text-white"
                      onClick={() => (window.location.href = '/')}
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" /> Back to home
                    </Button>
                    <Button
                      variant="ghost"
                      className="rounded-full text-navy-300 hover:text-navy"
                      onClick={() => {
                        setFbDone(false)
                        setFbMessage('')
                        setFbReference('')
                      }}
                    >
                      Send another message
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-gold-500" />
                    <h3 className="font-serif text-lg font-semibold text-navy">
                      {mode === 'COMPLAINT' ? 'Tell us what went wrong' : 'Ask us anything'}
                    </h3>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-navy-300">
                    {mode === 'COMPLAINT'
                      ? 'The more detail, the faster we can fix it. Complaints open a tracked ticket and are answered within one working day.'
                      : 'Pricing, pickup windows, alterations, corporate accounts — if you are wondering, ask.'}
                  </p>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-sm font-semibold text-navy">
                        Your name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={fbName}
                        onChange={(e) => setFbName(e.target.value)}
                        placeholder="Adaeze Musa"
                        className="w-full rounded-xl border border-navy-200 bg-white px-3 py-2.5 text-sm text-navy placeholder:text-navy-300 focus:border-gold-300 focus:outline-none focus:ring-2 focus:ring-gold-200"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-semibold text-navy">
                        Email <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        value={fbEmail}
                        onChange={(e) => setFbEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full rounded-xl border border-navy-200 bg-white px-3 py-2.5 text-sm text-navy placeholder:text-navy-300 focus:border-gold-300 focus:outline-none focus:ring-2 focus:ring-gold-200"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-semibold text-navy">
                        Phone <span className="text-navy-300">(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={fbPhone}
                        onChange={(e) => setFbPhone(e.target.value)}
                        placeholder="+234 …"
                        className="w-full rounded-xl border border-navy-200 bg-white px-3 py-2.5 text-sm text-navy placeholder:text-navy-300 focus:border-gold-300 focus:outline-none focus:ring-2 focus:ring-gold-200"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-semibold text-navy">
                        Order no. / hotel <span className="text-navy-300">(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={fbReference}
                        onChange={(e) => setFbReference(e.target.value)}
                        placeholder="KZ-12345678 or Eko Hotel"
                        className="w-full rounded-xl border border-navy-200 bg-white px-3 py-2.5 text-sm text-navy placeholder:text-navy-300 focus:border-gold-300 focus:outline-none focus:ring-2 focus:ring-gold-200"
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="mb-1.5 block text-sm font-semibold text-navy">
                      {mode === 'COMPLAINT' ? 'What went wrong?' : 'Your question'}{' '}
                      <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={fbMessage}
                      onChange={(e) => setFbMessage(e.target.value)}
                      rows={4}
                      placeholder={
                        mode === 'COMPLAINT'
                          ? 'Tell us what happened — the more detail, the faster we can fix it.'
                          : 'Ask us anything about pricing, pickup, alterations…'
                      }
                      className="w-full resize-none rounded-xl border border-navy-200 bg-white px-3 py-2.5 text-sm text-navy placeholder:text-navy-300 focus:border-gold-300 focus:outline-none focus:ring-2 focus:ring-gold-200"
                    />
                  </div>

                  {fbError && (
                    <p className="mt-3 rounded-lg bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 ring-1 ring-red-200">
                      {fbError}
                    </p>
                  )}

                  <Button
                    onClick={submitFeedback}
                    disabled={fbSending}
                    className="mt-5 w-full rounded-full bg-gold-gradient text-navy hover:opacity-90"
                  >
                    {fbSending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        {mode === 'COMPLAINT' ? 'Submit complaint' : 'Send question'}
                      </>
                    )}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        <div className="mt-8 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-300 transition hover:text-navy"
          >
            <ArrowLeft className="h-4 w-4" />
            {signedIn ? 'Back to the site' : 'Back to browsing — you can always come back'}
          </Link>
        </div>
      </div>
    </div>
  )
}
