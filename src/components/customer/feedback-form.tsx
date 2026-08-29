'use client'

// =============================================================================
// FeedbackForm — public "Reviews & Complaints" section (Phase 14, client
// directive: "Add a review/complaint section where customers can submit
// feedback").
// =============================================================================
// Complements the order-linked review system (/review/[orderId], auto-shown
// on the testimonials carousel): this form is for EVERYONE — prospects,
// hotel partners and customers with or without an order number. Submissions
// land in the admin Feedback inbox (NEW → IN_PROGRESS → RESOLVED).
// =============================================================================

import { useState } from 'react'
import { motion } from 'framer-motion'
import { MessageSquareHeart, Send, CheckCircle2, Loader2, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'

type FeedbackType = 'REVIEW' | 'COMPLAINT' | 'QUESTION'

const TYPE_OPTIONS: { id: FeedbackType; label: string; hint: string }[] = [
  { id: 'REVIEW', label: 'Leave a review', hint: 'Tell us how we did' },
  { id: 'COMPLAINT', label: 'Make a complaint', hint: 'We make it right' },
  { id: 'QUESTION', label: 'Ask a question', hint: 'Anything at all' },
]

export function FeedbackForm() {
  const [type, setType] = useState<FeedbackType>('REVIEW')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [reference, setReference] = useState('')
  const [rating, setRating] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const messageValid = message.trim().length >= 10
  const canSubmit =
    name.trim().length >= 2 && emailValid && messageValid && !loading

  const submit = async () => {
    if (!canSubmit) return
    setLoading(true)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          reference: reference.trim() || undefined,
          rating: type === 'REVIEW' ? rating : undefined,
          message: message.trim(),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not send your feedback.')
      setDone(true)
    } catch (e: any) {
      toast({
        title: 'Could not send',
        description: e?.message || 'Please try again in a moment.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <section id="feedback" className="bg-white py-20 scroll-mt-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-start">
          {/* Pitch column */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gold-400">
              Reviews &amp; Complaints
            </p>
            <h2 className="font-serif text-3xl font-semibold tracking-tight text-navy sm:text-4xl">
              Tell us how we&apos;re doing.
            </h2>
            <p className="mt-4 max-w-xl leading-relaxed text-navy-300">
              Praise, problems and questions all go straight to the Kozy team — no
              account needed. Every submission is read by a human and tracked to
              resolution, and complaints are answered within one working day. If
              something came back wrong, tell us here: documenting it early is what
              makes the Return-as-Received Guarantee easy to honour.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                'Reviews with 4.5★ and above can appear on our testimonials wall',
                'Complaints open a tracked ticket with a one-working-day response',
                'Attach your order number (KZ-…) so we can pull the exact order',
                'Hotel & estate partners: reference your property for priority handling',
              ].map((t) => (
                <li key={t} className="flex items-start gap-3">
                  <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-400" />
                  <span className="text-navy-300">{t}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Form column */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl border border-navy-100 bg-linen-50 p-6 shadow-navy sm:p-8"
          >
            {done ? (
              <div className="flex flex-col items-center py-10 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                  <CheckCircle2 className="h-7 w-7 text-emerald-600" />
                </div>
                <h3 className="mt-4 font-serif text-xl font-semibold text-navy">
                  Thank you — it&apos;s with the team.
                </h3>
                <p className="mt-2 max-w-sm text-sm leading-relaxed text-navy-300">
                  Your {type === 'COMPLAINT' ? 'complaint' : type === 'QUESTION' ? 'question' : 'review'}{' '}
                  has been logged{reference ? ` against ${reference}` : ''}. We reply within one
                  working day — usually much sooner.
                </p>
                <Button
                  variant="outline"
                  className="mt-6 rounded-full border-navy-200 text-navy-300 hover:text-navy"
                  onClick={() => {
                    setDone(false)
                    setMessage('')
                    setRating(null)
                    setReference('')
                  }}
                >
                  Send another message
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <MessageSquareHeart className="h-5 w-5 text-gold-500" />
                  <h3 className="font-serif text-lg font-semibold text-navy">
                    Send feedback
                  </h3>
                </div>

                {/* Type selector */}
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {TYPE_OPTIONS.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setType(o.id)}
                      aria-pressed={type === o.id}
                      className={cn(
                        'rounded-xl border-2 px-2 py-2.5 text-center transition',
                        type === o.id
                          ? 'border-gold-400 bg-gold-50/60'
                          : 'border-navy-100 hover:border-gold-200'
                      )}
                    >
                      <p className="text-xs font-semibold text-navy">{o.label}</p>
                      <p className="mt-0.5 text-[10px] leading-tight text-navy-300">{o.hint}</p>
                    </button>
                  ))}
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="fb-name" className="text-xs uppercase tracking-wide text-navy-300">
                      Your name *
                    </Label>
                    <Input
                      id="fb-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Adaeze Musa"
                      className="mt-1.5 bg-white"
                    />
                  </div>
                  <div>
                    <Label htmlFor="fb-email" className="text-xs uppercase tracking-wide text-navy-300">
                      Email *
                    </Label>
                    <Input
                      id="fb-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="mt-1.5 bg-white"
                    />
                  </div>
                  <div>
                    <Label htmlFor="fb-phone" className="text-xs uppercase tracking-wide text-navy-300">
                      Phone (optional)
                    </Label>
                    <Input
                      id="fb-phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+234 …"
                      className="mt-1.5 bg-white"
                    />
                  </div>
                  <div>
                    <Label htmlFor="fb-ref" className="text-xs uppercase tracking-wide text-navy-300">
                      Order no. / hotel (optional)
                    </Label>
                    <Input
                      id="fb-ref"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      placeholder="KZ-1024 or Eko Hotel"
                      className="mt-1.5 bg-white"
                    />
                  </div>
                </div>

                {type === 'REVIEW' && (
                  <div className="mt-4">
                    <p className="text-xs uppercase tracking-wide text-navy-300">
                      How would you rate us?
                    </p>
                    <div className="mt-1.5 flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setRating(rating === s ? null : s)}
                          aria-label={`Rate ${s} star${s > 1 ? 's' : ''}`}
                          className="rounded p-0.5 transition hover:scale-110"
                        >
                          <Star
                            className={cn(
                              'h-6 w-6',
                              rating && s <= rating
                                ? 'fill-gold-400 text-gold-400'
                                : 'text-navy-200'
                            )}
                          />
                        </button>
                      ))}
                      {rating && <span className="ml-2 text-xs font-medium text-navy-300">{rating}.0 / 5</span>}
                    </div>
                  </div>
                )}

                <div className="mt-4">
                  <Label htmlFor="fb-message" className="text-xs uppercase tracking-wide text-navy-300">
                    {type === 'COMPLAINT' ? 'What went wrong? *' : type === 'QUESTION' ? 'Your question *' : 'Your review *'}
                  </Label>
                  <Textarea
                    id="fb-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={
                      type === 'COMPLAINT'
                        ? 'Tell us what happened — the more detail, the faster we can fix it.'
                        : type === 'QUESTION'
                          ? 'Ask us anything about pricing, pickup, alterations…'
                          : 'What did you think of your Kozy experience?'
                    }
                    rows={4}
                    className="mt-1.5 bg-white"
                  />
                  {message && !messageValid && (
                    <p className="mt-1 text-xs text-amber-600">
                      A few more words helps us help you (10+ characters).
                    </p>
                  )}
                </div>

                <Button
                  onClick={submit}
                  disabled={!canSubmit}
                  className="mt-5 w-full rounded-full bg-gold-gradient text-navy hover:opacity-90"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      {type === 'COMPLAINT' ? 'Submit complaint' : type === 'QUESTION' ? 'Send question' : 'Submit review'}
                    </>
                  )}
                </Button>
                <p className="mt-2 text-center text-[10px] text-navy-300/80">
                  Read by the Kozy team within one working day. Reviews are never edited —
                  4.5★ and above may be featured on our testimonials wall.
                </p>
              </>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  )
}
