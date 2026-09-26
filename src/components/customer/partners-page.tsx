'use client'

// =============================================================================
// PartnersClient — the Kozy Network pitch + application (phase 62)
// =============================================================================
// The offer, stated plainly: Kozy brings demand (orders routed from the
// customer platform), brand, technology (booking, dispatch, tracking,
// payments) and onboarding. The partner brings a working laundry. Money is
// shared on every delivered order. The application is short on purpose —
// the real diligence happens on the call after it.
// =============================================================================

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Handshake,
  Smartphone,
  TrendingUp,
  BadgeCheck,
  Loader2,
  ArrowRight,
  MapPin,
  Store,
  Phone,
  Mail,
  User,
  Building2,
  CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from '@/hooks/use-toast'
import { PublicNav } from '@/components/shell/public-nav'
import { SiteFooter } from './site-footer'

const inputClass =
  'mt-1.5 w-full rounded-xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm text-navy placeholder:text-navy-300 focus:border-gold-400 focus:outline-none focus:ring-1 focus:ring-gold-200'

export function PartnersClient() {
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({
    businessName: '',
    contactName: '',
    email: '',
    phone: '',
    address: '',
    capacityNotes: '',
  })

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({ title: 'Could not submit', description: data.message || data.error, variant: 'destructive' })
        return
      }
      setSubmitted(true)
    } catch {
      toast({
        title: 'Network hiccup',
        description: 'Please try again in a moment, or call us directly.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-linen">
      <PublicNav />

      {/* ================= HERO ================= */}
      <section className="relative overflow-hidden bg-navy-gradient">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 top-12 h-72 w-72 rounded-full bg-gold-400/10 blur-3xl" />
          <div className="absolute right-0 top-40 h-80 w-80 rounded-full bg-gold-400/10 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 lg:py-20">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-gold-200 ring-1 ring-gold-400/30 backdrop-blur">
            <Handshake className="h-3 w-3 text-gold-400" />
            The Kozy Network · For laundry operators
          </div>
          <h1 className="font-serif text-4xl font-semibold leading-[1.08] tracking-tight text-white sm:text-5xl">
            You run the laundry.
            <br />
            <span className="text-gold-gradient">We bring everything else.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-navy-100/90">
            The Kozy Network pairs working laundries with the demand, brand and technology of
            Lagos&apos; fastest-growing dry-cleaning platform. Orders arrive through our app; your
            team washes, treats and finishes; the revenue is shared on every delivered order.
          </p>
        </div>
      </section>

      {/* ================= WHAT WE BRING / WHAT YOU BRING ================= */}
      <section className="border-b border-navy-100 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-navy-100 shadow-navy">
              <CardContent className="p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-600">
                  Kozy brings
                </p>
                <ul className="mt-4 space-y-3 text-sm text-navy-200">
                  {[
                    { icon: TrendingUp, text: 'Demand — customer orders routed straight to your hub from day one' },
                    { icon: BadgeCheck, text: 'The brand — Kozy Care marketing, reviews and reputation working for you' },
                    { icon: Smartphone, text: 'The technology — booking, dispatch, rider tracking, payments, invoicing' },
                    { icon: Handshake, text: 'Onboarding — kit standards, care protocols and rider coordination' },
                  ].map((r) => (
                    <li key={r.text} className="flex items-start gap-3">
                      <r.icon className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" />
                      <span>{r.text}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card className="border-navy-100 shadow-navy">
              <CardContent className="p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-600">
                  You bring
                </p>
                <ul className="mt-4 space-y-3 text-sm text-navy-200">
                  {[
                    { icon: Store, text: 'A working laundry — machines, water, power handling and space to finish' },
                    { icon: User, text: 'A team that can wash, treat and press to the Kozy standard' },
                    { icon: MapPin, text: 'A location on the Lagos corridor we serve (or one we want to reach)' },
                    { icon: CheckCircle2, text: 'The pride to put your name behind ours — we only grow carefully' },
                  ].map((r) => (
                    <li key={r.text} className="flex items-start gap-3">
                      <r.icon className="mt-0.5 h-4 w-4 shrink-0 text-navy-800" />
                      <span>{r.text}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          <div className="mt-8 rounded-2xl bg-navy p-6 text-center text-white">
            <p className="font-serif text-xl font-semibold text-gold-200">
              The split is honest: you keep the majority share of every order you process.
            </p>
            <p className="mx-auto mt-2 max-w-2xl text-xs leading-relaxed text-navy-100/80">
              The exact percentage is agreed at onboarding and stays visible in your partner
              record — our share covers demand generation, the technology and the brand. No
              franchise fee, no levies: the money moves with the work.
            </p>
          </div>
        </div>
      </section>

      {/* ================= APPLICATION ================= */}
      <section className="bg-linen-200/60">
        <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-600">
              Apply to the network
            </p>
            <h2 className="mt-2 font-serif text-3xl font-semibold tracking-tight text-navy">
              Tell us about your laundry
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-navy-300">
              Four fields and your story. A human reviews every application and calls within 48
              hours (Mon–Sat).
            </p>
          </div>

          {submitted ? (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="mt-8 border-gold-200 bg-white shadow-navy">
                <CardContent className="p-8 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gold-100">
                    <CheckCircle2 className="h-7 w-7 text-gold-600" />
                  </div>
                  <p className="mt-4 font-serif text-2xl font-semibold text-navy">
                    Application received
                  </p>
                  <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-navy-300">
                    Thank you — {form.businessName} is in the review queue. Expect a call from our
                    team within 48 hours to talk capacity, standards and the share that fits your
                    setup. Nothing is owed and nothing is locked until both sides say yes.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <motion.form
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              onSubmit={onSubmit}
              className="mt-8"
            >
              <Card className="border-navy-100 shadow-navy">
                <CardContent className="p-6 sm:p-8">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="text-xs font-medium text-navy">Business name *</label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-3.5 h-4 w-4 text-navy-300" />
                        <input
                          required
                          value={form.businessName}
                          onChange={set('businessName')}
                          placeholder="e.g. Shine Bright Laundry"
                          className={`${inputClass} pl-9`}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-navy">Contact person *</label>
                      <input required value={form.contactName} onChange={set('contactName')} placeholder="Your name" className={inputClass} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-navy">Phone *</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-3.5 h-4 w-4 text-navy-300" />
                        <input
                          required
                          value={form.phone}
                          onChange={set('phone')}
                          placeholder="+234 …"
                          className={`${inputClass} pl-9`}
                        />
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-xs font-medium text-navy">Email *</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3.5 h-4 w-4 text-navy-300" />
                        <input
                          required
                          type="email"
                          value={form.email}
                          onChange={set('email')}
                          placeholder="you@yourlaundry.ng"
                          className={`${inputClass} pl-9`}
                        />
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-xs font-medium text-navy">Business address *</label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-3.5 h-4 w-4 text-navy-300" />
                        <input
                          required
                          value={form.address}
                          onChange={set('address')}
                          placeholder="Street, area, Lagos"
                          className={`${inputClass} pl-9`}
                        />
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-xs font-medium text-navy">Your operation, in your words</label>
                      <textarea
                        value={form.capacityNotes}
                        onChange={set('capacityNotes')}
                        rows={4}
                        placeholder="Machines and dryers you run, staff strength, current clients, the finishing you are proud of…"
                        className={inputClass}
                      />
                      <p className="mt-1.5 text-[11px] text-navy-300">
                        The more honest the picture, the faster the call goes.
                      </p>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={submitting}
                    className="mt-6 w-full rounded-full bg-gold-gradient font-semibold text-navy hover:opacity-90"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…
                      </>
                    ) : (
                      <>
                        Apply to the network <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                  <p className="mt-2 text-center text-[10px] text-navy-300">
                    No fee to apply · reviewed by a human · your details stay with Kozy Care
                  </p>
                </CardContent>
              </Card>
            </motion.form>
          )}
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
