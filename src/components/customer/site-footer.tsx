'use client'

// =============================================================================
// SiteFooter — the shared footer (home + /services + /memberships).
// Quick links point across pages: plans and the full price list live
// together on /memberships (phase 64 merge), specialty care detail lives on
// /services, the guarantee stays on the home page. Uses real hrefs (not
// buttons) so it works from any page without prop plumbing.
// =============================================================================

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Phone, Mail, MapPin, MailCheck, ArrowRight } from 'lucide-react'

// NewsletterSignup — footer email-list builder (phase 36)
// POSTs to /api/newsletter/subscribe (rate limited, validated server-side).
// On success the visitor sees a confirmation; a welcome email follows. This
// is how prospects who are not ready to book still join the Kozy circle and
// start hearing about offers — the list the admin's Marketing tab sends to.
function NewsletterSignup() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = email.trim().toLowerCase()
    if (!trimmed || state === 'loading') return
    setState('loading')
    setMessage('')
    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setState('done')
        setMessage(data.message || 'You are on the list.')
      } else {
        setState('error')
        setMessage(data.error || 'Please check the email address and try again.')
      }
    } catch {
      setState('error')
      setMessage('Network hiccup — please try again in a moment.')
    }
  }

  if (state === 'done') {
    return (
      <div className="mt-8 flex items-center gap-3 rounded-xl bg-gold-400/10 p-4 ring-1 ring-gold-400/30">
        <MailCheck className="h-5 w-5 shrink-0 text-gold-400" />
        <div>
          <p className="text-sm font-semibold text-gold-200">You&apos;re on the list</p>
          <p className="text-xs text-navy-100/60">
            {message} A welcome email is on its way — offers and care tips, never spam.
          </p>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 rounded-xl bg-navy-600/40 p-4 ring-1 ring-navy-400/40">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">
            Offers &amp; care tips, straight to your inbox
          </p>
          <p className="mt-0.5 text-xs text-navy-100/60">
            Be first to hear about seasonal discounts and coupon codes. No account needed —
            unsubscribe any time.
          </p>
        </div>
        <div className="flex w-full max-w-md gap-2 sm:w-auto sm:min-w-72">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (state === 'error') setState('idle')
            }}
            placeholder="you@example.com"
            aria-label="Email address for offers and updates"
            className="h-10 min-w-0 flex-1 rounded-full border border-navy-400 bg-navy-700/60 px-4 text-sm text-white placeholder:text-navy-100/40 focus:border-gold-400 focus:outline-none"
          />
          <button
            type="submit"
            disabled={state === 'loading'}
            className="h-10 shrink-0 rounded-full bg-gold-gradient px-5 text-xs font-bold text-navy transition hover:opacity-90 disabled:opacity-60"
          >
            {state === 'loading' ? 'Joining…' : 'Join'}
          </button>
        </div>
      </div>
      {state === 'error' && (
        <p className="mt-2 text-xs text-red-300" role="alert">
          {message}
        </p>
      )}
    </form>
  )
}

export function SiteFooter() {
  return (
    <footer className="bg-navy text-navy-100">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="grid gap-6 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-2.5">
              {/* v4 Kozy K mark — same asset as the header (gold K with
                  tapered hanger-wire flourish, transparent background). */}
              <img
                src="/brand/kozy-mark.svg"
                alt="Kozy Care mark"
                width={36}
                height={36}
                className="shrink-0"
                style={{ width: 36, height: 36 }}
              />
              <div className="leading-none">
                <p className="font-serif text-lg font-bold text-white">Kozy Care</p>
                <p className="mt-0.5 text-[8px] font-medium uppercase tracking-[0.15em] text-gold-300">
                  DRYCLEANING &amp; LAUNDRY
                </p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-navy-100/70">
              Kozy drycleaning &amp; laundry care for individuals and corporate
              partners across Lagos Island.
            </p>
            <p className="mt-3 font-serif text-sm italic text-gold-200">
              Uncompromising care. Exceptional convenience.
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gold-300">
              Contact Us
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex items-center gap-2 transition">
                <Phone className="h-4 w-4 shrink-0 text-gold-400" />
                <a href="tel:+2348031755230" className="text-navy-100/70 transition hover:text-gold-300">+234 803 175 5230</a>
              </li>
              <li className="flex items-center gap-2 transition">
                <Mail className="h-4 w-4 shrink-0 text-gold-400" />
                <a href="mailto:kozygarmentcare@gmail.com" className="text-navy-100/70 transition hover:text-gold-300">kozygarmentcare@gmail.com</a>
              </li>
              <li className="flex items-start gap-2 transition">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold-400" />
                <span className="text-navy-100/70">No 20. Westsyde Drive, Ogombo, Lagos State</span>
              </li>
              <li className="flex items-start gap-2 transition">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold-400" />
                <span className="text-navy-100/70">Paradise 3 Estate, Road 5/3, Chevron, Lagos State</span>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gold-300">
              Quick links
            </p>
            <ul className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <li>
                <Link href="/book" className="cursor-pointer text-navy-100/70 transition hover:text-gold-300">
                  Book a pickup
                </Link>
              </li>
              <li>
                <Link href="/login" className="cursor-pointer text-navy-100/70 transition hover:text-gold-300">
                  Track an order
                </Link>
              </li>
              <li>
                <Link href="/memberships" className="cursor-pointer text-navy-100/70 transition hover:text-gold-300">
                  Plans &amp; prices
                </Link>
              </li>
              <li>
                <Link href="/#guarantee" className="cursor-pointer text-navy-100/70 transition hover:text-gold-300">
                  Return-as-Received Guarantee
                </Link>
              </li>
              <li>
                <Link href="/services#shoe-care" className="cursor-pointer text-navy-100/70 transition hover:text-gold-300">
                  Shoe Cleaning &amp; Restoration
                </Link>
              </li>
              <li>
                <Link href="/services#alterations" className="cursor-pointer text-navy-100/70 transition hover:text-gold-300">
                  Alterations — Exclusive to Kozy
                </Link>
              </li>
              <li>
                <a href="/feedback" className="cursor-pointer text-navy-100/70 transition hover:text-gold-300">
                  Leave a review / feedback
                </a>
              </li>
              <li>
                <Link href="/memberships#pricing" className="cursor-pointer text-navy-100/70 transition hover:text-gold-300">
                  Corporate programs
                </Link>
              </li>
              <li>
                <Link href="/memberships#tiers" className="cursor-pointer text-navy-100/70 transition hover:text-gold-300">
                  The Kozy Circle · monthly plans
                </Link>
              </li>
              <li>
                <Link href="/partners" className="cursor-pointer text-navy-100/70 transition hover:text-gold-300">
                  Run a laundry? Join the network
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Newsletter signup (phase 36) — the email list builder. Every
            visitor can join without creating an account; these addresses
            receive the "All customers" campaigns from the admin Marketing
            tab. One-click unsubscribe is in every email. */}
        <NewsletterSignup />

        {/* Driver recruitment banner */}
        <div className="mt-6 rounded-xl bg-gradient-to-r from-navy-600 to-navy-700 p-4 ring-1 ring-gold-400/20">
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🚚</span>
              <div>
                <p className="text-sm font-semibold text-white">Join our rider team</p>
                <p className="text-xs text-navy-100/60">Flexible contract work across Lagos. Earn while you move.</p>
              </div>
            </div>
            <a href="/join-riders" className="shrink-0 rounded-full bg-gold-gradient px-4 py-2 text-xs font-bold text-navy transition hover:opacity-90">
              Apply now <ArrowRight className="inline h-3 w-3" />
            </a>
          </div>
        </div>

        <p className="mt-6 text-[10px] leading-relaxed text-navy-100/40">
          *Free pickup and delivery for first order only.
        </p>

        <div className="mt-2 flex flex-col items-center justify-between gap-3 border-t border-navy-500 pt-4 text-xs sm:flex-row">
          <p className="text-navy-100/40">© 2026 Kozy Care. All rights reserved.</p>
          <div className="flex flex-wrap gap-4">
            <a href="/terms" className="text-navy-100/40 transition hover:text-gold-300">Terms of Service</a>
            <a href="/privacy" className="text-navy-100/40 transition hover:text-gold-300">Privacy Policy</a>
            <a href="/refunds" className="text-navy-100/40 transition hover:text-gold-300">Refunds</a>
            <a href="/cookies" className="text-navy-100/40 transition hover:text-gold-300">Cookies</a>
          </div>
          <p>Built for Lagos, with care.</p>
        </div>
      </div>
    </footer>
  )
}
