'use client'

import Link from 'next/link'
import Image from 'next/image'
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
  MailCheck,
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
  type CatalogDisplayGroup,
} from '@/lib/pricing-groups'
import { useServerPrices, useAppSettings } from '@/lib/hooks'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { TestimonialsCarousel } from '@/components/customer/testimonials-carousel'
import { HowItWorksSection } from '@/components/customer/how-it-works'
import { SiteFooter } from '@/components/customer/site-footer'
import { StickyMobileCta } from '@/components/customer/sticky-mobile-cta'

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
  // Server-managed commercial terms (offers, delivery fee, guarantee rules,
  // alterations pricing, per-kg terms) — admin edits reach every visitor
  // instantly. The localStorage store is no longer consulted for anything
  // money-related (audit finding: customers used to see per-admin-browser
  // per-kg prices).
  const appSettings = useAppSettings()
  // Live prices from PriceCatalog (what the server charges) — the bundle
  // defaults are only fallbacks.
  const serverPrices = useServerPrices()
  const priceOf = (id: string, fallback: number) =>
    serverPrices?.[id] ?? fallback

  // Phase 45 — services-at-a-glance: the cheapest standard per-item price in
  // each retail category, so the home page can show honest "from" numbers
  // without the full tables (those moved to /services).
  const minStandardPrice = (groups: CatalogDisplayGroup[]): number | null => {
    const prices = groups
      .flatMap((group) => itemsForGroup(group))
      .filter((g: GarmentCatalogItem) => g.pricingMode !== 'quote' && g.pricingMode !== 'from')
      .map((g: GarmentCatalogItem) => priceOf(g.id, g.price))
    return prices.length ? Math.min(...prices) : null
  }
  const menFrom = minStandardPrice(MEN_CATALOG_GROUPS)
  const womenFrom = minStandardPrice(WOMEN_CATALOG_GROUPS)
  const homeFrom = minStandardPrice(LANDING_SHARED_GROUPS)

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
          {/* Phase 42: hero entrance runs on CSS (animate-fade-up) instead of
              framer-motion initial opacity:0 — the old way shipped the hero
              invisible in the server HTML and stayed blank on slow phones
              until hydration finished. CSS animation starts at first paint. */}
          <div className="animate-fade-up text-white">
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
          </div>

          {/* Hero image card — CSS entrance (see note above) */}
          <div className="animate-fade-up-delay-1 relative">
            <div className="relative h-[480px] overflow-hidden rounded-2xl ring-1 ring-gold-400/30 shadow-2xl shadow-navy-900/40 sm:h-[560px]">
              {/* next/image priority: single controlled preload + AVIF/WebP
                  negotiation instead of the raw 80KB PNG competing with 38
                  other images for bandwidth (phase 42 mobile fix). */}
              <Image
                src="/brand/images/hero-pressed-shirts.png"
                alt="Pristine freshly pressed white shirts on premium wooden hangers"
                fill
                priority
                quality={85}
                sizes="(min-width: 1024px) 50vw, 100vw"
                placeholder="blur"
                blurDataURL="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjEwIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwIiB5MT0iMCIgeDI9IjAiIHkyPSIxIj48c3RvcCBvZmZzZXQ9IjAiIHN0b3AtY29sb3I9IiMxNTMwNTAiLz48c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiMwQTE5MkYiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSIxMCIgZmlsbD0idXJsKCNnKSIvPjwvc3ZnPg=="
                className="object-cover"
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
          </div>
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
          OFFERS — online-order, first-order, hotel/corporate & picture
          discounts (Phase 14/30: one clear strip so the site and flyers
          tell the same story — 5% off every online order for registered
          customers, 10% first order, HOTEL15 for hotels & corporate
          clients, 5% for uploading pictures with each order)
      ============================================================ */}
      <section className="border-b border-gold-200 bg-linen-50">
        <div className="mx-auto grid max-w-7xl gap-3 px-4 py-6 sm:px-6 md:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-center gap-3 rounded-xl bg-navy p-4 text-white shadow-sm ring-1 ring-gold-400/30">
            <Sparkles className="h-6 w-6 shrink-0 text-gold-400" />
            <div>
              <p className="text-sm font-bold text-gold-100">
                {appSettings.onlineOrderDiscountPercent}% off every online order
              </p>
              <p className="text-xs text-navy-100/80">
                Yours for good when you book with an account — applied automatically at checkout.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gold-200">
            <Sparkles className="h-6 w-6 shrink-0 text-gold-500" />
            <div>
              <p className="text-sm font-bold text-navy">
                {appSettings.firstOrderDiscountPercent}% off your first order
              </p>
              <p className="text-xs text-navy-300">For every new customer — applied automatically at checkout.</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gold-200">
            <Building2 className="h-6 w-6 shrink-0 text-gold-400" />
            <div>
              <p className="text-sm font-bold text-navy">
                Hotels &amp; corporate clients: {appSettings.hotelGuestDiscountPercent}% off + 5%
              </p>
              <p className="text-xs text-navy-300">
                Use code <span className="font-mono font-bold text-gold-500">{appSettings.hotelGuestPromoCode}</span> at
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
          SERVICES AT A GLANCE — compact pointer to /services (phase 45).
          The client's customer found the home page a very long scroll, so
          the full per-item pricing tables, atelier story, sneaker
          restoration and alterations moved to their own page. The home page
          keeps this summary: six cards, honest "from" prices (live from the
          server catalog), one click to the detail.
      ============================================================ */}
      <section id="services" className="bg-white py-20 scroll-mt-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gold-400">
                What we do
              </p>
              <h2 className="font-serif text-3xl font-semibold tracking-tight text-navy sm:text-4xl">
                Six services. One pickup.
              </h2>
              <p className="mt-2 max-w-xl text-navy-300">
                Everything rides the same free island-wide pickup — dry cleaning, household
                linens, sneakers, even alterations. First delivery is on us.
              </p>
            </div>
            <Button
              asChild
              variant="outline"
              className="rounded-full border-gold-300 bg-white text-navy hover:bg-gold-50"
            >
              <Link href="/services">
                See all services &amp; pricing{' '}
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                href: '/services',
                icon: ShoppingBag,
                title: "Men's dry cleaning",
                blurb: 'Suits, shirts, agbada and native wear — pressed to atelier standard.',
                price: menFrom != null ? `From ${formatNaira(menFrom)}` : 'Per item',
              },
              {
                href: '/services',
                icon: Sparkles,
                title: "Women's dry cleaning",
                blurb: 'Dresses, skirts, iro & buba — delicate fabrics get dedicated care zones.',
                price: womenFrom != null ? `From ${formatNaira(womenFrom)}` : 'Per item',
              },
              {
                href: '/services',
                icon: BedDouble,
                title: 'Home & linens',
                blurb: 'Bedsheets, duvets, curtains — fresh, folded, sealed for delivery.',
                price: homeFrom != null ? `From ${formatNaira(homeFrom)}` : 'Per item',
              },
              {
                href: '/services#shoe-care',
                icon: Zap,
                title: 'Shoe care & restoration',
                blurb: 'Sneakers and trainers brought back to box-fresh condition.',
                price: 'From \u20a65,000',
              },
              {
                href: '/services#alterations',
                icon: Scissors,
                title: 'Alterations & repairs',
                blurb: 'In-house tailor — same rider, same delivery as your laundry.',
                price:
                  appSettings.alterationsFromPrice > 0
                    ? `From ${formatNaira(appSettings.alterationsFromPrice)}`
                    : 'Quoted before we sew',
              },
              {
                href: '/services#pricing',
                icon: Building2,
                title: 'Corporate & hotels',
                blurb: 'Weight-based programs with monthly statements and Net-15 terms.',
                price: `${formatNaira(appSettings.pricePerKg)} per kg`,
              },
            ].map((c) => {
              const Icon = c.icon
              return (
                <Link
                  key={c.title}
                  href={c.href}
                  className="group rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300"
                >
                  <Card className="h-full border-navy-100 shadow-navy transition-shadow duration-200 group-hover:shadow-lg group-hover:ring-1 group-hover:ring-gold-200">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linen-50">
                          <Icon className="h-5 w-5 text-gold-500" />
                        </div>
                        <ArrowRight className="h-4 w-4 text-navy-200 transition-all group-hover:translate-x-0.5 group-hover:text-gold-500" />
                      </div>
                      <h3 className="mt-3 font-serif text-lg font-semibold text-navy">
                        {c.title}
                      </h3>
                      <p className="mt-1 text-sm leading-relaxed text-navy-300">{c.blurb}</p>
                      <p className="mt-3 text-sm font-semibold text-navy">{c.price}</p>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* ============================================================
          TESTIMONIALS — rotating customer reviews (order-verified,
          4.5★ and above only). The feedback form lives on its own page
          (/feedback — linked from this section) so browsing stays
          uninterrupted (Phase 17, client directive).
      ============================================================ */}
      <TestimonialsCarousel />

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
          FEMALE LIFESTYLE — representing all customers
      ============================================================ */}
      <section className="bg-linen py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-2 items-center">
            <div className="overflow-hidden rounded-2xl ring-1 ring-navy-100 shadow-2xl order-2 lg:order-1">
              <img src="/brand/images/laundry-handover.png" alt="Kozy rider handing a navy suit carrier garment bag with the gold Kozy K monogram to a smiling customer on her veranda" loading="lazy" decoding="async" className="h-full w-full object-cover" />
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

      <SiteFooter />
      <StickyMobileCta onBook={onBook} />
    </div>
  )
}
