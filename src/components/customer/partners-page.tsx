'use client'

// =============================================================================
// PartnersClient — the Kozy Network pitch + application (phase 62 → 72)
// =============================================================================
// The offer, stated plainly: Kozy brings demand (orders routed from the
// customer platform), brand, technology (booking, dispatch, tracking,
// payments) and onboarding. The partner brings a working laundry. Money is
// shared on every delivered order. The application is short on purpose —
// the real diligence happens on the call after it.
//
// Phase 72 — rider-parity: the form now carries the same strictness as the
// rider application (Nigerian mobile, operating area, at least one
// service), the applicant gets an email + SMS confirmation immediately
// with a KZP-XXXX reference, and approval (in the console) creates their
// partner-portal login with emailed credentials.
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

/** The services a partner can check off — mirrors what the console shows on
 *  the application card and what ops uses to plan routing. */
const SERVICE_OPTIONS = [
  'Wash & fold',
  'Dry cleaning',
  'Pressing & finishing',
  'Shoe care',
  'Household & bedding',
] as const

/** Light client-side mirror of the server's Nigerian-mobile rule — good
 *  enough to catch typos before submission; the API has the strict version. */
function looksLikeNigerianMobile(raw: string): boolean {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('234')) return digits.length >= 12 && digits.length <= 13
  if (digits.startsWith('0')) return digits.length === 11
  return false
}

export function PartnersClient() {
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [refCode, setRefCode] = useState<string | null>(null)
  const [form, setForm] = useState({
    businessName: '',
    contactName: '',
    email: '',
    phone: '',
    address: '',
    lga: '',
    capacityNotes: '',
  })
  // Which service chips are selected (phase 72).
  const [services, setServices] = useState<string[]>([])
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
    if (fieldErrors[k]) setFieldErrors((fe) => ({ ...fe, [k]: '' }))
  }

  const toggleService = (s: string) => {
    setServices((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]))
    if (fieldErrors.services) setFieldErrors((fe) => ({ ...fe, services: '' }))
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return

    // Same field-level checks the server enforces — errors inline, not a toast.
    const errors: Record<string, string> = {}
    if (form.businessName.trim().length < 2) errors.businessName = 'Your business name as customers know it.'
    if (form.contactName.trim().length < 2) errors.contactName = 'Your name — the person we will call.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      errors.email = 'A valid email — your partner-portal sign-in will be emailed there.'
    if (!looksLikeNigerianMobile(form.phone))
      errors.phone = 'A Nigerian mobile number — e.g. 0803 222 4455 or +234 803 222 4455.'
    if (form.address.trim().length < 8) errors.address = 'Street and area, so we know where you operate.'
    if (form.lga.trim().length < 2) errors.lga = 'The Lagos area your laundry serves — e.g. Lekki, Ikeja.'
    if (services.length === 0) errors.services = 'Pick at least one service you can process to the Kozy standard.'
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          servicesOffered: services,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (data?.error === 'APPLICATION_EXISTS') {
          toast({ title: 'Already with us', description: data.message })
        } else {
          toast({ title: 'Could not submit', description: data.message || data.error, variant: 'destructive' })
        }
        return
      }
      setRefCode(typeof data?.refCode === 'string' ? data.refCode : null)
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
              Seven fields and your story — a human reviews every application and calls within 48
              hours (Mon–Sat). You&apos;ll get a confirmation email and SMS the moment it lands.
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
                  {refCode && (
                    <p className="mt-2 text-sm text-navy-300">
                      Your reference:{' '}
                      <span className="rounded-md bg-linen-100 px-2 py-0.5 font-mono font-semibold text-navy">
                        {refCode}
                      </span>
                    </p>
                  )}
                  <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-navy-300">
                    Thank you — {form.businessName} is in the review queue. A confirmation is on its
                    way to {form.email || 'your email'} (and your phone). Expect a call from our
                    team within 48 hours to talk capacity, standards and the share that fits your
                    setup. Nothing is owed and nothing is locked until both sides say yes.
                  </p>
                  <p className="mx-auto mt-4 max-w-md rounded-xl bg-linen-50 p-3 text-xs leading-relaxed text-navy-300">
                    If it&apos;s a fit, approval creates your partner-portal sign-in — emailed with
                    everything you need. The portal shows the orders we route to you and your
                    revenue-share ledger, live.
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
                      <input
                        required
                        value={form.contactName}
                        onChange={set('contactName')}
                        placeholder="Your name"
                        className={`${inputClass} ${fieldErrors.contactName ? 'border-rose-300' : ''}`}
                      />
                      {fieldErrors.contactName && (
                        <p className="mt-1 text-[11px] text-rose-600">{fieldErrors.contactName}</p>
                      )}
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
                          className={`${inputClass} pl-9 ${fieldErrors.phone ? 'border-rose-300' : ''}`}
                        />
                      </div>
                      {fieldErrors.phone && (
                        <p className="mt-1 text-[11px] text-rose-600">{fieldErrors.phone}</p>
                      )}
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
                          className={`${inputClass} pl-9 ${fieldErrors.address ? 'border-rose-300' : ''}`}
                        />
                      </div>
                      {fieldErrors.address && (
                        <p className="mt-1 text-[11px] text-rose-600">{fieldErrors.address}</p>
                      )}
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-xs font-medium text-navy">Area you operate in *</label>
                      <input
                        required
                        value={form.lga}
                        onChange={set('lga')}
                        placeholder="e.g. Lekki Phase 1, Ikeja, Surulere"
                        className={`${inputClass} ${fieldErrors.lga ? 'border-rose-300' : ''}`}
                      />
                      {fieldErrors.lga && (
                        <p className="mt-1 text-[11px] text-rose-600">{fieldErrors.lga}</p>
                      )}
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-xs font-medium text-navy">
                        What can you process to the Kozy standard? *
                      </label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {SERVICE_OPTIONS.map((s) => {
                          const on = services.includes(s)
                          return (
                            <button
                              key={s}
                              type="button"
                              aria-pressed={on}
                              onClick={() => toggleService(s)}
                              className={
                                'rounded-full border px-3.5 py-1.5 text-xs font-medium transition ' +
                                (on
                                  ? 'border-gold-400 bg-gold-100 text-navy'
                                  : 'border-navy-200 bg-white text-navy-300 hover:border-gold-300')
                              }
                            >
                              {on && <CheckCircle2 className="mr-1 inline h-3 w-3 text-gold-600" />}
                              {s}
                            </button>
                          )
                        })}
                      </div>
                      {fieldErrors.services && (
                        <p className="mt-1 text-[11px] text-rose-600">{fieldErrors.services}</p>
                      )}
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
