'use client'

// =============================================================================
// ServicesPage — the /services page body (phase 45, re-scoped in 64 + 67).
// Home was split for scroll length in phase 45; in phase 64 the pricing
// tables moved in with the membership plans on /memberships (“Plans &
// Pricing”, plans first). Phase 67: couture, designer and premium
// traditional wear is offered here as its own specialist service — Couture
// Care — alongside sneaker restoration and the in-house tailor, plus a
// pointer strip up top that routes price-hunters to the merged page.
// =============================================================================

import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PublicNav } from '@/components/shell/public-nav'
import { ServicesDetail } from '@/components/customer/services-detail'
import { SiteFooter } from '@/components/customer/site-footer'
import { StickyMobileCta } from '@/components/customer/sticky-mobile-cta'

export function ServicesPage() {
  const goBook = () => {
    window.location.href = '/book'
  }

  return (
    <div className="bg-linen">
      <PublicNav />

      {/* Compact page header — navy, in the brand voice, instantly answers
          “what is this page”. No hero image: visitors came for the detail. */}
      <section className="bg-navy-gradient py-14 text-white sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gold-400">
            Specialty care
          </p>
          <h1 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
            The craft beyond the wash.
          </h1>
          <p className="mt-3 max-w-2xl text-navy-100">
            Couture Care for designer, couture and premium traditional wear — a
            specialist service, assessed and quoted per piece. Sneaker and trainer
            restoration, an in-house tailor for alterations and repairs, and a look
            inside the atelier where every garment is finished. Plans and the full
            per-item price list live together on{" "}
            <Link
              href="/memberships"
              className="font-semibold text-gold-300 underline decoration-gold-400 decoration-2 underline-offset-4 hover:text-gold-200"
            >
              Plans &amp; Pricing
            </Link>
            .
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              size="lg"
              onClick={goBook}
              className="h-12 rounded-full bg-gold-gradient px-6 text-base font-semibold text-navy shadow-gold hover:opacity-90"
            >
              Book Pickup Now <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <a
              href="tel:+2348031755230"
              className="inline-flex h-12 items-center rounded-full border border-white/30 bg-white/5 px-6 text-base font-medium text-white backdrop-blur transition hover:bg-white/10"
            >
              Call us: 0803 175 5230
            </a>
          </div>
        </div>
      </section>

      <ServicesDetail
        onBook={goBook}
        onBookShoes={() => {
          // Deep-link straight into the wizard's Shoes tab so sneaker
          // customers land on the shoe list.
          window.location.href = '/book?service=shoes'
        }}
      />

      {/* Closing CTA — the page is long; remind the visitor of the next
          step at the bottom without another full hero. */}
      <section className="border-t border-gold-200 bg-linen-50 py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 text-center sm:px-6">
          <h2 className="font-serif text-2xl font-semibold text-navy sm:text-3xl">
            Ready when you are.
          </h2>
          <p className="max-w-xl text-sm leading-relaxed text-navy-300">
            First pickup and delivery is free, island-wide (Ikoyi to Lekki). Book in
            two minutes — no account needed.
          </p>
          <Button
            size="lg"
            onClick={goBook}
            className="h-12 rounded-full bg-gold-gradient px-8 text-base font-semibold text-navy shadow-gold hover:opacity-90"
          >
            Book your pickup <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </section>

      <SiteFooter />
      <StickyMobileCta onBook={goBook} />
    </div>
  )
}
