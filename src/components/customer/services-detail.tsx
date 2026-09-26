'use client'

// =============================================================================
// ServicesDetail — the specialty care content (phases 45 → 64).
// =============================================================================
// Phase 45 moved the full pricing tables, atelier story, sneaker restoration
// and alterations off the home page onto /services. Phase 64 (owner): pricing
// and the membership plans are now MERGED on /memberships — "Plans & Pricing",
// plans first, price list below — so this page keeps the specialty story:
// inside the atelier, sneaker restoration, and the in-house tailor. A short
// pointer strip at the top (keeping the #pricing anchor) routes anyone who
// arrived via an old "pricing" deep link to the merged page.
// =============================================================================

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Ruler,
  Scissors,
  Tag,
} from 'lucide-react'
import { formatNaira } from '@/lib/types'
import { useAppSettings } from '@/lib/hooks'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface Props {
  onBook: () => void
  /** Deep-link straight into the wizard's Shoes tab (shoe-care section CTA).
   *  Falls back to onBook when not provided. */
  onBookShoes?: () => void
}

export function ServicesDetail({ onBook, onBookShoes }: Props) {
  // Server-managed commercial terms — alterations pricing lives here; the
  // per-item price list itself now renders on /memberships (PricingTables).
  const appSettings = useAppSettings()

  return (
    <>
      {/* ============================================================
          PRICING POINTER — plans & prices merged on /memberships
          (phase 64). The anchor is kept so old /services#pricing deep
          links (and Google's index) land somewhere honest instead of
          nowhere; one click takes the visitor to the merged page.
      ============================================================ */}
      <section id="pricing" className="border-b border-navy-100 bg-linen-50 py-8 scroll-mt-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <Link
            href="/memberships#pricing"
            className="group flex flex-col items-start justify-between gap-3 rounded-2xl border border-gold-200 bg-white p-5 shadow-navy transition-shadow hover:shadow-lg hover:ring-1 hover:ring-gold-200 sm:flex-row sm:items-center"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold-100">
                <Tag className="h-5 w-5 text-gold-600" />
              </div>
              <div>
                <p className="font-serif text-lg font-semibold text-navy">
                  Looking for prices? They moved in with the plans.
                </p>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-navy-300">
                  One page now: the three Kozy Circle monthly plans first, the full
                  per-item price list below them — men, women, home and the per-kg
                  corporate program. Specialty care stays right here.
                </p>
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-gold-gradient px-5 py-2.5 text-xs font-bold text-navy transition group-hover:opacity-90">
              Plans &amp; prices <ArrowRight className="ml-1 inline h-3.5 w-3.5" />
            </span>
          </Link>
        </div>
      </section>

      {/* ============================================================
          LIFESTYLE / ATELIER
      ============================================================ */}
      <section id="atelier" className="bg-navy-gradient py-20 text-white scroll-mt-20">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gold-400">
              Inside the atelier
            </p>
            <h2 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
              A workspace engineered for fabric care.
            </h2>
            <p className="mt-4 max-w-xl text-navy-100">
              Every Kozy atelier features commercial-grade equipment, dedicated zones for
              silks, wools, and traditional fabrics, and a finishing station staffed by
              trained pressers. Nothing leaves the floor untagged.
            </p>

            <ul className="mt-6 space-y-3 text-sm">
              {[
                'Per-fabric detergent protocols (silk, wool, ankara, agbada)',
                'Stain bar with pre-treatment consultation',
                'Steam-only finishing for delicate structures',
                'Sealed garment bags for return delivery',
              ].map((t) => (
                <li key={t} className="flex items-start gap-3">
                  <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-400" />
                  <span className="text-navy-100">{t}</span>
                </li>
              ))}
            </ul>

            <Button
              onClick={onBook}
              className="mt-7 rounded-full bg-gold-gradient px-6 text-navy hover:opacity-90"
            >
              Book your first pickup <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </motion.div>

          <div className="overflow-hidden rounded-2xl ring-1 ring-gold-400/30 shadow-2xl">
            <img
              src="/brand/images/atelier-craftsman.png"
              alt="Kozy master presser finishing a premium garment at the steam station"
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* ============================================================
          SHOE CLEANING & RESTORATION — new service section
      ============================================================ */}
      <section id="shoe-care" className="bg-navy py-20 text-white scroll-mt-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-2 items-center">
            <motion.div
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gold-400">
                Beyond Laundry
              </p>
              <h2 className="font-serif text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Sneaker &amp; Trainer Restoration
              </h2>
              <p className="mt-4 max-w-xl text-white">
                Got beat-up Jordans? Muddy Sambas? Yellowed Air Force soles? Our sneaker
                restoration specialists bring your favourite kicks back to box-fresh condition.
                From deep cleans to sole whitening to full restorations — we treat your
                sneakers like collectibles.
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                {[
                  'Deep clean & stain removal for sneakers, trainers, and canvas shoes',
                  'Sole whitening & midsole restoration (yellowing reversal)',
                  'Suede & nubuck revival for premium sneakers',
                  'Insole & lace replacement options',
                  'Repainting & colour restoration for scuffed uppers',
                  'Protective coating to keep them fresh longer',
                  'Free assessment — we confirm your pair can be saved before you commit',
                ].map((t) => (
                  <li key={t} className="flex items-start gap-3">
                    <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-400" />
                    <span className="text-white">{t}</span>
                  </li>
                ))}
              </ul>
              {/* Restoration consultation (owner directive): assessment-first,
                  exactly like a wedding-dress wash — a pair that is beyond
                  restoration should be declined BEFORE the trip, not after. */}
              <p className="mt-6 rounded-xl border border-gold-400/30 bg-white/5 p-4 text-sm leading-relaxed text-white/90">
                <span className="font-semibold text-gold-300">Restorations from ₦5,000</span> —
                priced by the extent of work after a free assessment. Every restoration
                starts with a consultation: our specialist inspects the pair, tells you
                honestly whether it can be saved, and sends the final quote for your
                approval before any work begins. If it&apos;s beyond restoration, we say so
                upfront — no charge, no wasted collection.
              </p>
              <Button
                onClick={onBookShoes ?? onBook}
                className="mt-7 rounded-full bg-gold-gradient px-6 text-navy hover:opacity-90"
              >
                Book shoe care <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </motion.div>
            <div className="overflow-hidden rounded-2xl ring-1 ring-gold-400/30 shadow-2xl">
              <img src="/brand/images/shoe-care.png" alt="Restored luxury shoes" loading="lazy" decoding="async" className="h-full w-full object-cover" />
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          ALTERATIONS — Exclusive to Kozy Care (Phase 14, client directive)
          In-house tailoring: hems, tapering, zips, waist adjustments.
          Pricing is confirmed with the tailor and published the moment it is
          set — until then every piece is measured and quoted for approval
          before any work begins (assessment-first, like wedding dresses).
      ============================================================ */}
      <section id="alterations" className="bg-linen py-20 scroll-mt-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-center">
            <motion.div
              initial={{ opacity: 0, x: -16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-400">
                  Alterations &amp; Repairs
                </p>
                <Badge className="bg-gold-400 text-navy hover:bg-gold-400">
                  Exclusive to Kozy Care
                </Badge>
              </div>
              <h2 className="mt-3 font-serif text-3xl font-semibold tracking-tight text-navy sm:text-4xl">
                Cleaned, pressed — and made to fit.
              </h2>
              <p className="mt-4 max-w-xl leading-relaxed text-navy-300">
                Our in-house tailor works alongside the cleaning team, so alterations ride
                the same pickup and delivery as your laundry. No separate trips, no
                tailoring shop queues — hand your pieces to your Kozy rider and collect
                them fitting the way they should. Available exclusively to Kozy Care
                customers; you won&apos;t find this service anywhere else on the island.
              </p>
              <ul className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
                {[
                  'Trousers & jeans — hems, tapering, waist adjustments',
                  'Shirts & dresses — take-in, sleeve shortening, re-hemming',
                  'Zips, buttons & linings replaced with matching materials',
                  'Traditional wear — agbada, kaftan and iro & buba adjustments',
                  'Blazers & suits — sleeve and body alterations by a suit tailor',
                  'You describe, she assesses — you approve the quote before we sew',
                ].map((t) => (
                  <li key={t} className="flex items-start gap-3">
                    <Scissors className="mt-0.5 h-4 w-4 shrink-0 text-gold-500" />
                    <span className="text-navy-300">{t}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-6 rounded-xl border border-gold-200 bg-gold-50 p-4 text-sm leading-relaxed text-navy-300">
                <span className="font-semibold text-navy">
                  {appSettings.alterationsFromPrice > 0
                    ? `Alterations from ${formatNaira(appSettings.alterationsFromPrice)}`
                    : 'Simple, honest pricing — quoted before we sew'}
                </span>{' '}
                — tell us what needs changing when you book: "waist too loose", "sleeves
                too long", "zip needs replacing". No one measures you at the door —
                our seamstress assesses every piece at the studio, calls you to confirm
                the details, then sends your quote. Nothing is sewn until you approve
                it.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Button
                  onClick={onBook}
                  className="rounded-full bg-gold-gradient px-6 text-navy hover:opacity-90"
                >
                  Book pickup with alterations <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                {/* Free measurement tutorial (Phase 18, client directive:
                    "besides 'book pickup with alterations', we could also have
                    'How do I take measurements?'... it should take them to a
                    separate page... in one of our brand colors, probably the
                    royal blue"). Royal-blue pill in the brand navy family. */}
                <Button
                  asChild
                  className="rounded-full border border-navy-600 bg-navy-500 px-6 text-white hover:bg-navy-600"
                >
                  <Link href="/measurements">
                    <Ruler className="mr-2 h-4 w-4" /> How do I take measurements?
                  </Link>
                </Button>
              </div>
            </motion.div>

            {/* Visual column — a seamstress at her workstation keeps this
                section about the craft of alterations (client directive:
                "have a seamstress working at her workstation in terms of
                alterations and repairs — be professional about it"). Style
                matches the marketing materials: photoreal, navy/gold. */}
            <div className="relative">
              <div className="overflow-hidden rounded-2xl ring-1 ring-gold-400/30 shadow-2xl">
                <img
                  src="/brand/images/seamstress.png"
                  alt="Young Kozy in-house seamstress sewing at her machine in a bright white-walled studio"
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="absolute -bottom-4 -right-4 hidden rounded-xl bg-white p-4 shadow-lg ring-1 ring-gold-200 sm:block">
                <div className="flex items-center gap-2">
                  <Scissors className="h-5 w-5 text-gold-500" />
                  <div>
                    <p className="text-xs font-bold text-navy">In-house tailor</p>
                    <p className="text-[10px] text-navy-300">Same rider, same delivery</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
