'use client'

import { useState } from 'react'
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
  User,
  ShoppingBag,
  Sparkles,
} from 'lucide-react'
import {
  GARMENT_CATALOG,
  formatNaira,
} from '@/lib/types'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

interface Props {
  onBook: () => void
  onPortal: () => void
}

const CATEGORY_LABELS: Record<string, string> = {
  Shirts: 'Shirts & Tops',
  Trousers: 'Trousers',
  Suits: 'Suits & Blazers',
  Traditional: 'Traditional',
  Household: 'Household',
  Extras: 'Extras',
}

export function CustomerLanding({ onBook, onPortal }: Props) {
  const [pricing, setPricing] = useState<'retail' | 'corporate'>('retail')
  const settings = useStore((s) => s.settings)

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
              Premium dry cleaning &amp; laundry · Serving Ikoyi to Lekki
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
                <Clock className="h-3.5 w-3.5 text-gold-400" /> 48-hour standard turnaround
              </span>
              <span className="flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5 text-gold-400" /> Complimentary island-wide pickup
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
                <div className="rounded-full bg-gold-400 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-navy">
                  Kozy Care
                </div>
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
          HOW IT WORKS
      ============================================================ */}
      <section className="bg-linen py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-gold-400">
              The Kozy Method
            </p>
            <h2 className="font-serif text-3xl font-semibold tracking-tight text-navy sm:text-4xl">
              Three steps. Zero fuss.
            </h2>
            <p className="mt-3 text-navy-300">
              From your dressing room to our atelier and back — with every stage visible
              in your dashboard.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              {
                icon: ShoppingBag,
                image: '/brand/images/how-1-book.png',
                title: '01 · Request a pickup',
                body: 'Choose your garments, request a bulk pickup, or schedule a recurring slot. Snap optional condition photos to activate our Return-as-Received Guarantee.',
              },
              {
                icon: Truck,
                image: '/brand/images/how-2-collect.png',
                title: '02 · We collect & treat',
                body: 'A Kozy rider arrives within your window. Items travel to our atelier where they are sorted, treated, and pressed by garment-specific protocols.',
              },
              {
                icon: CheckCircle2,
                image: '/brand/images/how-3-return.png',
                title: '03 · Pristine return',
                body: 'Your garments are folded, packaged, and delivered within 48 hours (retail) — sealed in protective Kozy garment bags, ready for your wardrobe.',
              },
            ].map((s, i) => (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
              >
                <Card className="group h-full overflow-hidden border-navy-100 bg-white shadow-navy transition hover:shadow-lg">
                  <div className="relative h-44 overflow-hidden bg-linen-100">
                    <img
                      src={s.image}
                      alt={s.title}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                    <div className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-xl bg-navy text-gold-400 shadow-navy">
                      <s.icon className="h-5 w-5" />
                    </div>
                  </div>
                  <CardContent className="p-6">
                    <h3 className="font-serif text-lg font-semibold text-navy">
                      {s.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-navy-300">{s.body}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          PRICING & SERVICES
      ============================================================ */}
      <section className="bg-white py-20">
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
              onValueChange={(v) => setPricing(v as 'retail' | 'corporate')}
            >
              <TabsList className="bg-linen-200">
                <TabsTrigger
                  value="retail"
                  className="data-[state=active]:bg-navy data-[state=active]:text-white"
                >
                  <User className="mr-1 h-3 w-3" /> Retail
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

          <Tabs value={pricing} onValueChange={(v) => setPricing(v as 'retail' | 'corporate')}>
            <TabsContent value="retail" className="mt-8">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {(['Shirts', 'Trousers', 'Suits', 'Traditional', 'Household', 'Extras'] as const).map(
                  (cat) => (
                    <Card key={cat} className="border-navy-100 shadow-navy">
                      <CardContent className="p-5">
                        <h3 className="mb-3 font-serif text-sm font-semibold uppercase tracking-wide text-gold-400">
                          {CATEGORY_LABELS[cat]}
                        </h3>
                        <ul className="space-y-2">
                          {GARMENT_CATALOG.filter((g) => g.category === cat).map((g) => (
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
                              <span className="font-semibold text-navy">
                                {formatNaira(settings.garmentPrices[g.id] ?? g.price)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )
                )}
              </div>
            </TabsContent>

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
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* ============================================================
          GUARANTEE — Kozy Care Promise
      ============================================================ */}
      <section className="bg-linen py-20">
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
              alt="Kozy master dry cleaner treating a premium garment with care"
              className="h-full w-full object-cover"
            />
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
              <div className="flex items-center gap-2">
                <svg width="32" height="32" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="40" height="40" rx="9" fill="#102740"/>
                  <path d="M11 12 L20 20 L11 28" stroke="#D4AF37" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  <path d="M29 12 L20 20 L29 28" stroke="#D4AF37" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  <circle cx="20" cy="20" r="2.2" fill="#D4AF37"/>
                </svg>
                <span className="font-serif text-lg font-semibold text-white">Kozy</span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-navy-100/70">
                Premium dry cleaning &amp; laundry care for individuals and corporate
                partners across Lagos Island.
              </p>
              <p className="mt-3 font-serif text-sm italic text-gold-200">
                Uncompromising care. Exceptional convenience.
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gold-300">
                Concierge
              </p>
              <ul className="mt-3 space-y-2 text-sm text-navy-100/70">
                <li className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-gold-400" /> +234 800 KOZY NG
                </li>
                <li className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-gold-400" /> concierge@kozy.ng
                </li>
                <li className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-gold-400" /> Kozy Atelier, 12 Gerard Rd, Ikoyi
                </li>
              </ul>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gold-300">
                Quick links
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <button onClick={onBook} className="text-navy-100/70 hover:text-white">
                    Book a pickup
                  </button>
                </li>
                <li>
                  <button onClick={onPortal} className="text-navy-100/70 hover:text-white">
                    Track an order
                  </button>
                </li>
                <li className="text-navy-100/70">Pricing &amp; services</li>
                <li className="text-navy-100/70">Return-as-Received Guarantee</li>
                <li className="text-navy-100/70">Corporate programs</li>
              </ul>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center justify-between gap-2 border-t border-navy-500 pt-6 text-xs text-navy-100/40 sm:flex-row">
            <p>© 2026 Kozy Premium Dry Cleaning Ltd. RC 1234567.</p>
            <p>Built for Lagos, with care.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
