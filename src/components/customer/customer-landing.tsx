'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Clock,
  MapPin,
  Shield,
  Truck,
  CreditCard,
  Leaf,
  ArrowRight,
  CheckCircle2,
  Star,
  Phone,
  Mail,
  Building2,
  ShoppingBag,
  Sparkles,
  Zap,
  Scissors,
  BedDouble,
} from 'lucide-react'
import {
  formatNaira,
  type GarmentCatalogItem,
} from '@/lib/types'
import {
  MEN_CATALOG_GROUPS,
  WOMEN_CATALOG_GROUPS,
  LANDING_SHARED_GROUPS,
  itemsForGroup,
} from '@/lib/pricing-groups'
import { useStore } from '@/lib/store'
import { useServerPrices, useAppSettings } from '@/lib/hooks'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { TestimonialsCarousel } from '@/components/customer/testimonials-carousel'
import { HowItWorksSection } from '@/components/customer/how-it-works'
import { FeedbackForm } from '@/components/customer/feedback-form'

interface Props {
  onBook: () => void
  onPortal: () => void
  /** Deep-link straight into the wizard's Shoes tab (shoe-care section CTA).
   *  Falls back to onBook when not provided. */
  onBookShoes?: () => void
}

// ---------------------------------------------------------------------------
// PRICING TABS — Men / Women / Corporate (men first, per owner directive)
// ---------------------------------------------------------------------------
// Fashion-retail convention is "Men" / "Women" (not "male/female"), matching
// the catalog's category names. Gendered traditional wear is split by item so
// Agbada sits under Men and Iro & Buba under Women; household, shoes and
// extras are shared and shown under both retail tabs. The group definitions
// live in src/lib/pricing-groups.ts and are shared with the booking wizard,
// so the two surfaces can never drift apart.

export function CustomerLanding({ onBook, onPortal, onBookShoes }: Props) {
  const [pricing, setPricing] = useState<'men' | 'women' | 'corporate'>('men')
  const settings = useStore((s) => s.settings)
  // Server-managed commercial terms (offers, delivery fee, guarantee rules,
  // alterations pricing) — admin edits reach every visitor instantly.
  const appSettings = useAppSettings()
  // Live prices from PriceCatalog (what the server charges) — the persisted
  // store and bundle defaults are only fallbacks.
  const serverPrices = useServerPrices()
  const priceOf = (id: string, fallback: number) =>
    serverPrices?.[id] ?? settings.garmentPrices[id] ?? fallback
  // Price cell for the pricing cards — quote-mode items (wedding dress,
  // couture) read "Quoted"; from-mode items (restoration) read "From ₦X".
  const priceCell = (g: GarmentCatalogItem) =>
    g.pricingMode === 'quote' ? (
      <span className="font-semibold text-gold-600">Quoted</span>
    ) : g.pricingMode === 'from' ? (
      <span className="font-semibold text-navy">From {formatNaira(priceOf(g.id, g.price))}</span>
    ) : (
      <span className="font-semibold text-navy">{formatNaira(priceOf(g.id, g.price))}</span>
    )

  return (
    <div className="bg-linen">
      {/* ============================================================
          HERO — Midnight navy backdrop with champagne gold accents
      ============================================================ */}
      <section className="relative overflow-hidden bg-navy-gradient">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 top-12 h-72 w-72 rounded-full bg-gold-400/10 blur-3xl" />
          <div className="absolute right-0 top-40 h-80 w-80 rounded-full bg-gold-400/10 blur-3xl" />
          {/* Subtle gold grid */}
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                'linear-gradient(to right, #D4AF37 1px, transparent 1px), linear-gradient(to bottom, #D4AF37 1px, transparent 1px)',
              backgroundSize: '48px 48px',
            }}
          />
        </div>

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:py-24">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-white"
          >
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-gold-200 ring-1 ring-gold-400/30 backdrop-blur">
              <Sparkles className="h-3 w-3 text-gold-400" />
              Kozy drycleaning &amp; laundry · Serving Ikoyi to Lekki
            </div>

            <h1 className="font-serif text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Uncompromising care.
              <br />
              <span className="text-gold-gradient">Exceptional convenience.</span>
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-navy-100/90 sm:text-lg">
              Kozy is Lagos&apos; premium atelier for everything from designer personal wear
              to corporate linen programs. We collect, treat, and return — with the
              discretion your wardrobe deserves.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                size="lg"
                onClick={onBook}
                className="h-12 rounded-full bg-gold-gradient px-6 text-base font-semibold text-navy shadow-gold hover:opacity-90"
              >
                <ShoppingBag className="mr-2 h-5 w-5" />
                Book Pickup Now
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={onPortal}
                className="h-12 rounded-full border-white/30 bg-white/5 px-6 text-base font-medium text-white backdrop-blur hover:bg-white/10 hover:text-white"
              >
                Track My Orders
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-navy-100/80">
              <span className="flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-gold-400" /> Return-as-Received Guarantee
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-gold-400" /> Express turnaround from 24 hours
              </span>
              <span className="flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5 text-gold-400" /> Complimentary island-wide pickup*
              </span>
            </div>
          </motion.div>

          {/* Hero image card */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="relative"
          >
            <div className="relative overflow-hidden rounded-2xl ring-1 ring-gold-400/30 shadow-2xl shadow-navy-900/40">
              <img
                src="/brand/images/hero-pressed-shirts.png"
                alt="Pristine freshly pressed white shirts on premium wooden hangers"
                className="h-[480px] w-full object-cover sm:h-[560px]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-navy-900/60 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
                <div className="rounded-xl bg-navy/80 px-4 py-3 backdrop-blur ring-1 ring-gold-400/30">
                  <p className="font-serif text-sm font-semibold text-gold-100">
                    Atelier-grade finishing
                  </p>
                  <p className="text-[11px] text-navy-100">
                    Pressed, packaged, and ready for delivery
                  </p>
                </div>
                <Link
                  href="/signup"
                  aria-label="Kozy Care — create your account"
                  className="rounded-full bg-gold-400 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                >
                  Kozy Care
                </Link>
              </div>
            </div>

            {/* Floating quote card */}
            <div className="absolute -bottom-4 -left-4 hidden max-w-[200px] rounded-xl bg-white px-3 py-2 shadow-lg ring-1 ring-gold-200 sm:block">
              <div className="flex items-center gap-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Star key={i} className="h-3 w-3 fill-gold-400 text-gold-400" />
                ))}
              </div>
              <p className="mt-1 text-[10px] leading-snug text-navy-300">
                &ldquo;My suits have never looked better.&rdquo;
              </p>
              <p className="text-[10px] font-medium text-navy">— Adebola, Ikoyi</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ============================================================
          TRUST BAR
      ============================================================ */}
      <section className="border-b border-navy-100 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-around gap-4 px-4 py-5 sm:px-6">
          {[
            { icon: Building2, label: 'Corporate Partners', value: '24 Hotels & Estates' },
            { icon: Shield, label: 'Items Returned', value: '12,400+ Pieces' },
            { icon: Clock, label: 'Avg Turnaround', value: '46 hours' },
            { icon: Star, label: 'Customer Rating', value: '4.9 / 5.0' },
          ].map((s) => {
            const Icon = s.icon
            return (
              <div key={s.label} className="flex items-center gap-2.5">
                <Icon className="h-5 w-5 text-gold-400" />
                <div className="leading-tight">
                  <p className="text-sm font-semibold text-navy">{s.value}</p>
                  <p className="text-[10px] uppercase tracking-wider text-navy-300">
                    {s.label}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ============================================================
          OFFERS — first-order, hotel-guest & picture discounts
          (Phase 14: one clear strip so the site and flyers tell the
          same story — 10% first order, HOTEL15 for hotel guests,
          5% for uploading pictures with each order)
      ============================================================ */}
      <section className="border-b border-gold-200 bg-linen-50">
        <div className="mx-auto grid max-w-7xl gap-3 px-4 py-6 sm:px-6 md:grid-cols-3">
          <div className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gold-200">
            <Sparkles className="h-6 w-6 shrink-0 text-gold-500" />
            <div>
              <p className="text-sm font-bold text-navy">
                {appSettings.firstOrderDiscountPercent}% off your first order
              </p>
              <p className="text-xs text-navy-300">For every new customer — applied automatically at checkout.</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-navy p-4 text-white shadow-sm ring-1 ring-gold-400/30">
            <Building2 className="h-6 w-6 shrink-0 text-gold-400" />
            <div>
              <p className="text-sm font-bold text-gold-100">
                Hotel guests: {appSettings.hotelGuestDiscountPercent}% off + 5%
              </p>
              <p className="text-xs text-navy-100/80">
                Use code <span className="font-mono font-bold text-gold-300">{appSettings.hotelGuestPromoCode}</span> at
                checkout for your first order — plus the 5% picture discount.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gold-200">
            <Shield className="h-6 w-6 shrink-0 text-gold-500" />
            <div>
              <p className="text-sm font-bold text-navy">5% off every order with pictures</p>
              <p className="text-xs text-navy-300">
                Upload condition photos at booking — it activates the Return-as-Received Guarantee.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          HOW IT WORKS (animated cards — same art, motion added)
      ============================================================ */}
      <HowItWorksSection />

      {/* ============================================================
          PRICING & SERVICES
      ============================================================ */}
      <section id="pricing" className="bg-white py-20 scroll-mt-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gold-400">
                Transparent pricing
              </p>
              <h2 className="font-serif text-3xl font-semibold tracking-tight text-navy sm:text-4xl">
                Per-item or per-kilogram.
              </h2>
              <p className="mt-2 max-w-xl text-navy-300">
                Pay by bank transfer or Paystack. Corporate clients receive a dedicated
                account manager and itemised monthly statements.
              </p>
            </div>
            <Tabs
              value={pricing}
              onValueChange={(v) => setPricing(v as 'men' | 'women' | 'corporate')}
            >
              <TabsList className="bg-linen-200">
                <TabsTrigger
                  value="men"
                  className="data-[state=active]:bg-navy data-[state=active]:text-white"
                >
                  Men
                </TabsTrigger>
                <TabsTrigger
                  value="women"
                  className="data-[state=active]:bg-navy data-[state=active]:text-white"
                >
                  Women
                </TabsTrigger>
                <TabsTrigger
                  value="corporate"
                  className="data-[state=active]:bg-navy data-[state=active]:text-white"
                >
                  <Building2 className="mr-1 h-3 w-3" /> Corporate
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <Tabs value={pricing} onValueChange={(v) => setPricing(v as 'men' | 'women' | 'corporate')}>
            {(['men', 'women'] as const).map((tab) => (
              <TabsContent key={tab} value={tab} className="mt-8">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {(tab === 'men' ? MEN_CATALOG_GROUPS : WOMEN_CATALOG_GROUPS).map((group) => (
                    <Card key={group.title} className="border-navy-100 shadow-navy">
                      <CardContent className="p-5">
                        <h3 className="mb-3 font-serif text-sm font-semibold uppercase tracking-wide text-gold-400">
                          {group.title}
                        </h3>
                        <ul className="space-y-2">
                          {itemsForGroup(group).map((g) => (
                            <li
                              key={g.id}
                              className="flex items-center justify-between text-sm"
                            >
                              <span className="flex items-center gap-2.5 text-navy/80">
                                <img
                                  src={g.icon}
                                  alt=""
                                  className="h-5 w-5 text-navy"
                                  style={{ filter: 'brightness(0) saturate(100%) invert(13%) sepia(15%) saturate(1500%) hue-rotate(190deg) brightness(95%) contrast(90%)' }}
                                />
                                {g.name}
                              </span>
                              {priceCell(g)}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Shared categories — home, shoes and extras serve everyone */}
                <div className="mt-8">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-navy-300">
                    For the home &amp; everything else
                  </p>
                  <div className="grid gap-4 md:grid-cols-3">
                    {LANDING_SHARED_GROUPS.map((group) => (
                      <Card key={group.title} className="border-navy-100 shadow-navy">
                        <CardContent className="p-5">
                          <h3 className="mb-3 font-serif text-sm font-semibold uppercase tracking-wide text-gold-400">
                            {group.title}
                          </h3>
                          <ul className="space-y-2">
                            {itemsForGroup(group).map((g) => (
                              <li
                                key={g.id}
                                className="flex items-center justify-between text-sm"
                              >
                                <span className="flex items-center gap-2.5 text-navy/80">
                                  <img
                                    src={g.icon}
                                    alt=""
                                    className="h-5 w-5 text-navy"
                                    style={{ filter: 'brightness(0) saturate(100%) invert(13%) sepia(15%) saturate(1500%) hue-rotate(190deg) brightness(95%) contrast(90%)' }}
                                  />
                                  {g.name}
                                </span>
                                {priceCell(g)}
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* OTHER — wedding dress, couture & bespoke (owner directive):
                    there was no category for these, so a full-width banner lets
                    customers know a quote is available. Data comes from the same
                    OTHER_COUTURE_GROUP the wizard uses — content can't drift. */}
                <div className="mt-6 overflow-hidden rounded-2xl border border-gold-200 bg-linen-50 shadow-navy">
                  <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold-100">
                        <Sparkles className="h-5 w-5 text-gold-600" />
                      </div>
                      <div>
                        <p className="font-serif text-lg font-semibold text-navy">
                          Something not on the menu?
                        </p>
                        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-navy-300">
                          Wedding dresses, couture and bespoke pieces are{' '}
                          <span className="font-medium text-navy">quoted, not priced</span> —
                          beading, fabric and detail change the work. Book a pickup, we
                          assess your piece free of charge, and send a quote for your
                          approval before any work begins.
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={onBook}
                      variant="outline"
                      className="shrink-0 rounded-full border-gold-300 bg-white text-navy hover:bg-gold-50"
                    >
                      Get a quote <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Express upsell */}
                <div className="mt-6 flex flex-col items-start justify-between gap-3 rounded-xl bg-navy p-4 text-white ring-1 ring-gold-400/25 sm:flex-row sm:items-center">
                  <div className="flex items-start gap-3">
                    <Zap className="mt-0.5 h-4 w-4 shrink-0 text-gold-400" />
                    <div>
                      <p className="text-sm font-semibold">
                        In a hurry? Express turnaround at checkout.
                      </p>
                      <p className="mt-0.5 text-xs text-navy-100/70">
                        Standard care returns in 3–5 days. Express 48 (+50%) or Express 24
                        (+100%) jumps the cleaning queue — ideal for last-minute events.
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={onBook}
                    className="shrink-0 rounded-full bg-gold-gradient px-4 text-navy hover:opacity-90"
                  >
                    Book express <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Button>
                </div>

                {/* Pickup & delivery pricing — transparency requested by the
                    client ("I see first delivery is free but I don't see
                    pricing for deliveries afterwards"). First delivery is
                    free; every delivery after that is a flat island-wide rate
                    that admin can tune in Settings. */}
                <div className="mt-4 flex flex-col items-start justify-between gap-3 rounded-xl border border-navy-100 bg-white p-4 sm:flex-row sm:items-center">
                  <div className="flex items-start gap-3">
                    <Truck className="mt-0.5 h-4 w-4 shrink-0 text-gold-500" />
                    <div>
                      <p className="text-sm font-semibold text-navy">
                        Pickup &amp; delivery — first one&apos;s on us.
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-navy-300">
                        Your first pickup and delivery is <span className="font-semibold text-navy">FREE</span>.
                        After that, every delivery is a flat{' '}
                        <span className="font-semibold text-navy">{formatNaira(appSettings.deliveryFee)}</span>{' '}
                        island-wide (Ikoyi to Lekki) — no distance surprises, added at checkout.
                        Express orders keep the same rate.
                      </p>
                    </div>
                  </div>
                  <Badge className="shrink-0 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                    First delivery FREE
                  </Badge>
                </div>
              </TabsContent>
            ))}

            <TabsContent value="corporate" className="mt-8">
              <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
                <Card className="overflow-hidden border-navy-100 shadow-navy">
                  <img
                    src="/brand/images/b2b-linens.png"
                    alt="Neatly folded stacks of pristine white hotel linens tied with gold ribbon"
                    className="h-64 w-full object-cover"
                  />
                  <CardContent className="p-6">
                    <h3 className="font-serif text-xl font-semibold text-navy">
                      Weight-based corporate program
                    </h3>
                    <p className="mt-2 text-sm text-navy-300">
                      Hotels, estates, gyms, and restaurants rely on Kozy for predictable,
                      per-kilogram pricing. We weigh at the station, send you a digital
                      invoice, and route the next delivery.
                    </p>
                  </CardContent>
                </Card>

                <div className="space-y-4">
                  <Card className="border-navy bg-navy-gradient text-white shadow-navy">
                    <CardContent className="p-6">
                      <p className="text-xs uppercase tracking-wider text-gold-200">
                        Per kilogram
                      </p>
                      <p className="mt-1 font-serif text-4xl font-bold text-gold-100">
                        {formatNaira(settings.pricePerKg)}
                      </p>
                      <div className="mt-3 divider-gold" />
                      <p className="mt-3 text-xs text-navy-100">
                        Minimum charge{' '}
                        <span className="font-semibold text-white">
                          {formatNaira(settings.pricePerKg * settings.minimumKg)}
                        </span>{' '}
                        ({settings.minimumKg}kg minimum billable weight)
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border-navy-100 shadow-navy">
                    <CardContent className="p-5">
                      <ul className="space-y-3 text-sm">
                        {[
                          'Dedicated account manager & priority routing',
                          'Itemised monthly statements for finance teams',
                          'Item-level tagging for chain-of-custody tracking',
                          'Net-15 invoice terms for verified partners',
                        ].map((t) => (
                          <li key={t} className="flex items-start gap-2">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-gold-400" />
                            <span className="text-navy-300">{t}</span>
                          </li>
                        ))}
                      </ul>
                      <Button
                        onClick={onBook}
                        className="mt-5 w-full rounded-full bg-gold-gradient text-navy hover:opacity-90"
                      >
                        Request bulk pickup <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* HOTEL GUEST OFFER — Phase 14 (client directive: hotel guests
                  are already high-value customers, so they earn the better
                  first-order deal: 15% + the 5% picture discount). The code
                  is redeemed at checkout in the booking wizard. */}
              <div className="mt-6 overflow-hidden rounded-2xl bg-navy-gradient p-6 text-white ring-1 ring-gold-400/30">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold-400 text-navy">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-serif text-lg font-semibold">
                        Staying at a partner hotel? Your first order is{' '}
                        <span className="text-gold-300">{appSettings.hotelGuestDiscountPercent}% off.</span>
                      </p>
                      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-navy-100/85">
                        Hotel guests deserve the better deal — you&apos;re already our guest. Use code{' '}
                        <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono font-bold text-gold-300 ring-1 ring-gold-400/40">
                          {appSettings.hotelGuestPromoCode}
                        </span>{' '}
                        at checkout for {appSettings.hotelGuestDiscountPercent}% off your first order,{' '}
                        <span className="font-semibold text-white">plus</span> the 5% picture discount
                        when you upload photos with the order — that&apos;s up to{' '}
                        {appSettings.hotelGuestDiscountPercent + 5}% back on your first clean.
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={onBook}
                    className="shrink-0 rounded-full bg-gold-gradient px-5 text-navy hover:opacity-90"
                  >
                    Claim your offer <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* ============================================================
          TESTIMONIALS — rotating customer reviews (4.5★ and above only)
      ============================================================ */}
      <TestimonialsCarousel />

      {/* ============================================================
          REVIEWS & COMPLAINTS — public feedback form (Phase 14)
      ============================================================ */}
      <FeedbackForm />

      {/* ============================================================
          GUARANTEE — Kozy Care Promise
      ============================================================ */}
      <section id="guarantee" className="bg-linen py-20 scroll-mt-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Card className="overflow-hidden border-navy-100 shadow-navy">
            <CardContent className="grid gap-0 p-0 md:grid-cols-[1fr_1.4fr]">
              <div className="bg-navy-gradient p-8 text-white">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold-400 text-navy">
                  <Shield className="h-6 w-6" />
                </div>
                <h3 className="mt-4 font-serif text-2xl font-semibold">
                  Return-as-Received Guarantee
                </h3>
                <p className="mt-2 text-sm text-navy-100">
                  The Kozy Care Promise — capture, document, return. Your garments come
                  back in the exact condition recorded at pickup, or we make it right.
                </p>
                <Badge className="mt-4 w-fit bg-gold-400 text-navy hover:bg-gold-400">
                  Activates 5% discount on eligible orders
                </Badge>
              </div>

              <div className="p-8">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-400">
                  How the guarantee works
                </p>
                <p className="mt-3 text-sm leading-relaxed text-navy-300">
                  During the retail booking flow, you&apos;ll see an optional photo uploader.
                  Use it to capture the current condition of your garments. Orders with
                  uploaded photos are automatically tagged &quot;Guarantee Activated&quot;
                  and receive a 5% discount on the total.
                </p>

                {/* ELIGIBLE ORDERS — plain-language definition (client
                    directive: "what is considered eligible orders… a certain
                    number garments or amount of total order"). The thresholds
                    are admin-tunable and served from the DB. */}
                <div className="mt-4 rounded-lg border border-navy-100 bg-linen-50 p-4">
                  <p className="font-serif text-sm font-semibold text-navy">
                    What counts as an eligible order?
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-navy-300">
                    Any retail order with{' '}
                    <span className="font-semibold text-navy">
                      at least {appSettings.guaranteeMinGarments} garments
                    </span>{' '}
                    <span className="font-semibold text-navy">or</span> a{' '}
                    <span className="font-semibold text-navy">
                      {formatNaira(appSettings.guaranteeMinOrderValue)}+ total
                    </span>{' '}
                    — whichever comes first — with condition photos uploaded at booking and
                    the guarantee terms acknowledged. Orders below both thresholds can still
                    be booked and cleaned; they simply don&apos;t carry the damage-cover
                    guarantee. In short: two shirts or one suit and you&apos;re covered.
                  </p>
                </div>

                <div className="mt-4 rounded-lg border border-gold-200 bg-gold-50 p-4 text-xs leading-relaxed text-navy-300">
                  <p className="font-serif text-sm font-semibold text-navy">
                    Terms of Service
                  </p>
                  <p className="mt-1">
                    Return-as-Received Guarantee: By utilizing our Condition Capture
                    feature, we guarantee your garments will be returned clean and in
                    the exact structural condition documented at pickup. Covers physical
                    damage in our care; does not cover pre-existing wear or inherent
                    fabric degradation. Claims must be made within 24 hours of delivery.
                  </p>
                </div>

                <p className="mt-4 text-xs text-navy-300">
                  <span className="font-semibold text-navy">Corporate note:</span> For
                  corporate bulk orders, condition capture is hidden by default to
                  streamline booking. It can be enabled per-order on request.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ============================================================
          LIFESTYLE / ATELIER
      ============================================================ */}
      <section className="bg-navy-gradient py-20 text-white">
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
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* ============================================================
          SHOE CLEANING & RESTORATION — new service section
      ============================================================ */}
      <section id="shoe-care" className="bg-navy py-20 text-white">
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
              <img src="/brand/images/shoe-care.png" alt="Restored luxury shoes" className="h-full w-full object-cover" />
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
                  'Free measurement at pickup — we pin, you approve, we sew',
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
                — every alteration starts with a free measurement at pickup: we pin the
                work, send you the quote, and nothing is sewn until you approve it. Add
                your alteration request as a note when booking.
              </p>
              <Button
                onClick={onBook}
                className="mt-7 rounded-full bg-gold-gradient px-6 text-navy hover:opacity-90"
              >
                Book pickup with alterations <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </motion.div>

            {/* Visual column — the atelier interior keeps this section about
                craft; the illustration style matches the rest of the site. */}
            <div className="relative">
              <div className="overflow-hidden rounded-2xl ring-1 ring-gold-400/30 shadow-2xl">
                <img
                  src="/brand/images/atelier-interior.png"
                  alt="Inside the Kozy atelier — dedicated pressing and tailoring stations"
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

      {/* ============================================================
          FEMALE LIFESTYLE — representing all customers
      ============================================================ */}
      <section className="bg-linen py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-2 items-center">
            <div className="overflow-hidden rounded-2xl ring-1 ring-navy-100 shadow-2xl order-2 lg:order-1">
              <img src="/brand/images/female-customer.png" alt="Happy customer receiving her fresh laundry in a Kozy garment bag from a Kozy rider" className="h-full w-full object-cover" />
            </div>
            <motion.div
              initial={{ opacity: 0, x: 16 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="order-1 lg:order-2"
            >
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gold-400">
                Trusted by thousands
              </p>
              <h2 className="font-serif text-3xl font-semibold tracking-tight text-navy sm:text-4xl">
                Care for everything you wear.
              </h2>
              <p className="mt-4 max-w-xl text-navy-300">
                From your favourite Ankara gown to that designer blazer you save for special
                occasions — we treat every garment with the same level of attention. Every
                order returns within 3–5 days, or as fast as 24 hours with Express.
              </p>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-navy-100">
                  <p className="font-serif text-2xl font-bold text-navy">24h</p>
                  <p className="text-xs text-navy-300">Express turnaround from</p>
                </div>
                <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-navy-100">
                  <p className="font-serif text-2xl font-bold text-navy">₦500+</p>
                  <p className="text-xs text-navy-300">Per item, starting at</p>
                </div>
                <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-navy-100">
                  <p className="font-serif text-2xl font-bold text-navy">{appSettings.firstOrderDiscountPercent}%</p>
                  <p className="text-xs text-navy-300">Off first order</p>
                </div>
              </div>
              <Button
                onClick={onBook}
                className="mt-6 rounded-full bg-gold-gradient px-6 text-navy hover:opacity-90"
              >
                Book your pickup <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ============================================================
          FOOTER
      ============================================================ */}
      <footer className="bg-navy text-navy-100">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <div className="grid gap-8 md:grid-cols-3">
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
                  <p className="text-[8px] uppercase tracking-[0.15em] text-gold-300 font-medium mt-0.5">DRYCLEANING &amp; LAUNDRY</p>
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
                  <Phone className="h-4 w-4 text-gold-400 shrink-0" />
                  <a href="tel:+2348031755230" className="text-navy-100/70 hover:text-gold-300 transition">+234 803 175 5230</a>
                </li>
                <li className="flex items-center gap-2 transition">
                  <Mail className="h-4 w-4 text-gold-400 shrink-0" />
                  <a href="mailto:kozygarmentcare@gmail.com" className="text-navy-100/70 hover:text-gold-300 transition">kozygarmentcare@gmail.com</a>
                </li>
                <li className="flex items-start gap-2 transition">
                  <MapPin className="h-4 w-4 text-gold-400 shrink-0 mt-0.5" />
                  <span className="text-navy-100/70">No 20. Westsyde Drive, Ogombo, Lagos State</span>
                </li>
                <li className="flex items-start gap-2 transition">
                  <MapPin className="h-4 w-4 text-gold-400 shrink-0 mt-0.5" />
                  <span className="text-navy-100/70">Paradise 3 Estate, Road 5/3, Chevron, Lagos State</span>
                </li>
              </ul>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gold-300">
                Quick links
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <button onClick={onBook} className="cursor-pointer text-navy-100/70 hover:text-gold-300 transition">
                    Book a pickup
                  </button>
                </li>
                <li>
                  <button onClick={onPortal} className="cursor-pointer text-navy-100/70 hover:text-gold-300 transition">
                    Track an order
                  </button>
                </li>
                <li>
                  <a href="#pricing" className="text-navy-100/70 hover:text-gold-300 transition cursor-pointer">
                    Pricing &amp; services
                  </a>
                </li>
                <li>
                  <a href="#guarantee" className="text-navy-100/70 hover:text-gold-300 transition cursor-pointer">
                    Return-as-Received Guarantee
                  </a>
                </li>
                <li>
                  <a href="#shoe-care" className="text-navy-100/70 hover:text-gold-300 transition cursor-pointer">
                    Shoe Cleaning &amp; Restoration
                  </a>
                </li>
                <li>
                  <a href="#alterations" className="text-navy-100/70 hover:text-gold-300 transition cursor-pointer">
                    Alterations — Exclusive to Kozy
                  </a>
                </li>
                <li>
                  <a href="#feedback" className="text-navy-100/70 hover:text-gold-300 transition cursor-pointer">
                    Reviews &amp; Complaints
                  </a>
                </li>
                <li>
                  <a href="#pricing" className="text-navy-100/70 hover:text-gold-300 transition cursor-pointer">
                    Corporate programs
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Driver recruitment banner */}
          <div className="mt-8 rounded-xl bg-gradient-to-r from-navy-600 to-navy-700 p-4 ring-1 ring-gold-400/20">
            <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🚚</span>
                <div>
                  <p className="text-sm font-semibold text-white">Join our rider team</p>
                  <p className="text-xs text-navy-100/60">Flexible contract work across Lagos. Earn while you move.</p>
                </div>
              </div>
              <a href="/join-riders" className="shrink-0 rounded-full bg-gold-gradient px-4 py-2 text-xs font-bold text-navy hover:opacity-90 transition">
                Apply now →
              </a>
            </div>
          </div>

          <p className="mt-6 text-[10px] leading-relaxed text-navy-100/40">
            *Free pickup and delivery for first order only.
          </p>

          <div className="mt-2 flex flex-col items-center justify-between gap-3 border-t border-navy-500 pt-6 text-xs sm:flex-row">
            <p className="text-navy-100/40">© 2026 Kozy Care. All rights reserved.</p>
            <div className="flex flex-wrap gap-4">
              <a href="/terms" className="text-navy-100/40 hover:text-gold-300 transition">Terms of Service</a>
              <a href="/privacy" className="text-navy-100/40 hover:text-gold-300 transition">Privacy Policy</a>
              <a href="/refunds" className="text-navy-100/40 hover:text-gold-300 transition">Refunds</a>
              <a href="/cookies" className="text-navy-100/40 hover:text-gold-300 transition">Cookies</a>
            </div>
            <p>Built for Lagos, with care.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
