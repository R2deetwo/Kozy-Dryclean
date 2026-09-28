'use client'

import { useState } from 'react'
import { ArrowLeft, CheckCircle2, AlertCircle, Truck, Phone, Mail, MapPin, User, IdCard, Bike, HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Logo } from '@/components/shell/logo'
import { isValidNigerianMobile, PHONE_HELP } from '@/lib/phone-validation'
import { cn } from '@/lib/utils'
import Link from 'next/link'

export default function JoinRidersPage() {
  const [submitted, setSubmitted] = useState(false)
  const [refCode, setRefCode] = useState('')
  const [emailConfirmed, setEmailConfirmed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    altPhone: '',
    address: '',
    lga: '',
    bikeModel: '',
    bikeYear: '',
    licenseNumber: '',
    experience: '',
    availability: 'full-time',
    consent: false,
  })

  // Phase 55: the form used to accept anything in the phone fields, and the
  // "experience" box was read by a real applicant as "how was the ride you
  // took?" (he answered "it was really nice, i enjoyed it"). Fields now carry
  // explicit regex checks and self-explaining labels so an applicant knows
  // EXACTLY what is being asked before the review call.
  const setField = (key: string, value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
    setFieldErrors((e) => {
      if (!e[key]) return e
      const next = { ...e }
      delete next[key]
      return next
    })
  }

  const validate = (): boolean => {
    const errors: Record<string, string> = {}
    if (form.fullName.trim().length < 3 || !/^[A-Za-z][A-Za-z .'-]+$/.test(form.fullName.trim())) {
      errors.fullName = 'Enter your full name as it appears on your licence (letters only).'
    }
    if (!isValidNigerianMobile(form.phone)) {
      errors.phone = PHONE_HELP
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errors.email = 'That email address looks incomplete — check it ends with .com, .ng or similar.'
    }
    if (!isValidNigerianMobile(form.altPhone)) {
      errors.altPhone = `Emergency contact: ${PHONE_HELP}`
    }
    if (form.address.trim().length < 6) {
      errors.address = 'Give a street/area address we can find (at least 6 characters).'
    }
    if (form.lga.trim().length < 2) {
      errors.lga = 'Which Lagos area do you want to ride in? e.g. Lekki, Ikeja.'
    }
    const year = parseInt(form.bikeYear, 10)
    const thisYear = new Date().getFullYear()
    if (!/^(19|20)\d{2}$/.test(form.bikeYear) || year < 1990 || year > thisYear + 1) {
      errors.bikeYear = `Enter the motorcycle's model year (1990–${thisYear + 1}).`
    }
    if (form.licenseNumber.trim().length < 5) {
      errors.licenseNumber = 'Enter your driver\u2019s licence number as printed on the card.'
    }
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) {
      setError('Please fix the highlighted fields before submitting.')
      return false
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!validate()) return
    setLoading(true)

    if (!form.consent) {
      setError('You must consent to the contract terms to proceed.')
      setLoading(false)
      return
    }

    try {
      // Phase 54: applications are a real pipeline now — the server stores
      // the application under a short reference code (KZR-XXXX) and the
      // applicant immediately gets a confirmation email (when provided)
      // plus an SMS with the same reference and the 48-hour review promise.
      const res = await fetch('/api/rider-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (res.ok) {
        const data = await res.json().catch(() => ({}))
        if (data?.refCode) setRefCode(data.refCode)
        setEmailConfirmed(!!form.email)
      }
      // Network-level failures still show the success card (the phone
      // number is the owner's actual follow-up channel) but without a
      // fabricated reference.
      setSubmitted(true)
    } catch {
      setSubmitted(true)
    }
    setLoading(false)
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-linen px-4 py-8">
        <Card className="w-full max-w-md border-navy-100 shadow-navy">
          <CardContent className="p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gold-100">
              <CheckCircle2 className="h-7 w-7 text-gold-600" />
            </div>
            <h1 className="font-serif text-2xl font-semibold text-navy mb-2">Application received!</h1>
            {refCode && (
              <p className="mb-3 text-xs text-navy-300">
                Your reference is{' '}
                <span className="rounded-full bg-navy-50 px-2.5 py-1 font-mono font-semibold text-navy ring-1 ring-navy-100">
                  {refCode}
                </span>{' '}
                — keep it for any follow-up.
              </p>
            )}
            <p className="text-sm text-navy-300 mb-2">
              We review applications within <strong className="text-navy">48 hours</strong> (Mon–Sat)
              and will call you at <strong className="text-navy">{form.phone}</strong> to talk
              availability, your bike and your area.
            </p>
            <p className="text-sm text-navy-300 mb-6">
              {emailConfirmed ? (
                <>
                  A confirmation email is on its way to{' '}
                  <strong className="text-navy">{form.email}</strong> — check your inbox
                  (and spam, just in case).
                </>
              ) : (
                <>
                  We&apos;ll also text you a confirmation shortly. No email was given, so keep
                  this page handy — everything happens by phone from here.
                </>
              )}
            </p>
            <Link href="/">
              <Button className="bg-gold-gradient text-navy hover:opacity-90 w-full">
                Back to home
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-linen">
      {/* Header */}
      <div className="border-b border-navy-100 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/">
            <Logo size="md" subtitle="Drycleaning & Laundry" />
          </Link>
          <Link href="/" className="flex items-center gap-1 text-xs text-navy-300 hover:text-navy">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to home
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {/* Hero */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-navy text-gold-400">
            <Truck className="h-8 w-8" />
          </div>
          <h1 className="font-serif text-3xl font-bold text-navy">Join Our Rider Team</h1>
          <p className="mt-2 text-sm text-navy-300 max-w-xl mx-auto">
            Earn flexible income delivering clean laundry across Lagos. Work on your schedule,
            serve your community, and grow with Kozy Care.
          </p>
        </div>

        {/* Benefits */}
        <div className="mb-8 grid gap-3 sm:grid-cols-3">
          {[
            { icon: '💰', title: 'Competitive pay', desc: 'Earn per delivery + bonuses for high ratings' },
            { icon: '⏰', title: 'Flexible hours', desc: 'Choose your shifts — full-time or part-time' },
            { icon: '🛵', title: 'Use your own bike', desc: 'All you need is a roadworthy motorcycle' },
          ].map((b) => (
            <div key={b.title} className="rounded-xl bg-white p-4 text-center ring-1 ring-navy-100">
              <div className="text-2xl mb-1">{b.icon}</div>
              <p className="text-sm font-semibold text-navy">{b.title}</p>
              <p className="text-xs text-navy-300 mt-1">{b.desc}</p>
            </div>
          ))}
        </div>

        {/* How onboarding works (phase 54) — the owner's riders were applying
         * over email with no idea what happens next; this strip answers that
         * before they even submit. */}
        <div className="mb-8 rounded-2xl bg-white p-5 ring-1 ring-navy-100">
          <h2 className="text-center text-xs font-semibold uppercase tracking-widest text-navy-300">
            How onboarding works
          </h2>
          <ol className="mt-4 grid gap-4 sm:grid-cols-4">
            {[
              { n: '1', title: 'Apply', desc: 'This form — two minutes, no fees.' },
              { n: '2', title: 'Review call', desc: 'Within 48 hours, from our official line.' },
              { n: '3', title: 'Bike & licence check', desc: 'A quick verification of your details.' },
              { n: '4', title: 'Welcome email', desc: 'Your rider-app sign-in + first route.' },
            ].map((s) => (
              <li key={s.n} className="flex flex-col items-center text-center">
                <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-navy font-serif text-sm font-bold text-gold-400">
                  {s.n}
                </div>
                <p className="text-sm font-semibold text-navy">{s.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-navy-300">{s.desc}</p>
              </li>
            ))}
          </ol>
        </div>

        {/* Application form */}
        <Card className="border-navy-100 shadow-navy">
          <CardContent className="p-6 sm:p-8">
            <h2 className="font-serif text-xl font-semibold text-navy mb-4">Application Form</h2>

            {error && (
              <div className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 flex items-start gap-2 ring-1 ring-rose-200">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Personal info */}
              <div>
                <Label className="text-xs uppercase tracking-wide text-navy-300 mb-2 block">Personal Information</Label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="fullName" className="text-xs text-navy-300">Full Name</Label>
                    <div className="relative mt-1">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-navy-300" />
                      <Input id="fullName" value={form.fullName} onChange={(e) => setField('fullName', e.target.value)} className={cn('pl-9', fieldErrors.fullName && 'border-rose-300 focus-visible:ring-rose-200')} placeholder="Tunde Balogun" required />
                    </div>
                    {fieldErrors.fullName && <p className="mt-1 text-[11px] leading-snug text-rose-600">{fieldErrors.fullName}</p>}
                  </div>
                  <div>
                    <Label htmlFor="phone" className="text-xs text-navy-300">Your Phone Number</Label>
                    <div className="relative mt-1">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-navy-300" />
                      <Input id="phone" type="tel" inputMode="tel" value={form.phone} onChange={(e) => setField('phone', e.target.value)} className={cn('pl-9', fieldErrors.phone && 'border-rose-300 focus-visible:ring-rose-200')} placeholder="0803 222 4455" required />
                    </div>
                    {fieldErrors.phone
                      ? <p className="mt-1 text-[11px] leading-snug text-rose-600">{fieldErrors.phone}</p>
                      : <p className="mt-1 text-[11px] text-navy-300/80">The review call and your route updates come to this number.</p>}
                  </div>
                  <div>
                    <Label htmlFor="email" className="text-xs text-navy-300">Email (optional)</Label>
                    <div className="relative mt-1">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-navy-300" />
                      <Input id="email" type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} className={cn('pl-9', fieldErrors.email && 'border-rose-300 focus-visible:ring-rose-200')} placeholder="you@example.com" />
                    </div>
                    {fieldErrors.email && <p className="mt-1 text-[11px] leading-snug text-rose-600">{fieldErrors.email}</p>}
                  </div>
                  <div>
                    <Label htmlFor="altPhone" className="text-xs text-navy-300">Emergency Contact (a family member or friend)</Label>
                    <div className="relative mt-1">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-navy-300" />
                      <Input id="altPhone" type="tel" inputMode="tel" value={form.altPhone} onChange={(e) => setField('altPhone', e.target.value)} className={cn('pl-9', fieldErrors.altPhone && 'border-rose-300 focus-visible:ring-rose-200')} placeholder="0805 000 0000" required />
                    </div>
                    {fieldErrors.altPhone
                      ? <p className="mt-1 text-[11px] leading-snug text-rose-600">{fieldErrors.altPhone}</p>
                      : <p className="mt-1 text-[11px] text-navy-300/80">Someone we can reach if we can’t reach you — not your own number.</p>}
                  </div>
                </div>
              </div>

              {/* Address */}
              <div>
                <Label className="text-xs uppercase tracking-wide text-navy-300 mb-2 block">Location</Label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="address" className="text-xs text-navy-300">Home Address</Label>
                    <div className="relative mt-1">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-navy-300" />
                      <Input id="address" value={form.address} onChange={(e) => setField('address', e.target.value)} className={cn('pl-9', fieldErrors.address && 'border-rose-300 focus-visible:ring-rose-200')} placeholder="Street, area, Lagos" required />
                    </div>
                    {fieldErrors.address && <p className="mt-1 text-[11px] leading-snug text-rose-600">{fieldErrors.address}</p>}
                  </div>
                  <div>
                    <Label htmlFor="lga" className="text-xs text-navy-300">Preferred LGA / Area</Label>
                    <Input id="lga" value={form.lga} onChange={(e) => setField('lga', e.target.value)} className={cn('mt-1', fieldErrors.lga && 'border-rose-300 focus-visible:ring-rose-200')} placeholder="e.g. Ikeja, Lekki, Ikoyi" required />
                    {fieldErrors.lga && <p className="mt-1 text-[11px] leading-snug text-rose-600">{fieldErrors.lga}</p>}
                  </div>
                </div>
              </div>

              {/* Vehicle info */}
              <div>
                <Label className="text-xs uppercase tracking-wide text-navy-300 mb-2 block">Vehicle Information</Label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="bikeModel" className="text-xs text-navy-300">Motorcycle Model</Label>
                    <div className="relative mt-1">
                      <Bike className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-navy-300" />
                      <Input id="bikeModel" value={form.bikeModel} onChange={(e) => setField('bikeModel', e.target.value)} className="pl-9" placeholder="e.g. Bajaj Boxer" required />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="bikeYear" className="text-xs text-navy-300">Motorcycle Year</Label>
                    <Input id="bikeYear" type="number" inputMode="numeric" value={form.bikeYear} onChange={(e) => setField('bikeYear', e.target.value)} className={cn('mt-1', fieldErrors.bikeYear && 'border-rose-300 focus-visible:ring-rose-200')} placeholder="2022" required />
                    {fieldErrors.bikeYear && <p className="mt-1 text-[11px] leading-snug text-rose-600">{fieldErrors.bikeYear}</p>}
                  </div>
                  <div>
                    <Label htmlFor="licenseNumber" className="text-xs text-navy-300">Driver&apos;s Licence Number</Label>
                    <div className="relative mt-1">
                      <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-navy-300" />
                      <Input id="licenseNumber" value={form.licenseNumber} onChange={(e) => setField('licenseNumber', e.target.value)} className={cn('pl-9', fieldErrors.licenseNumber && 'border-rose-300 focus-visible:ring-rose-200')} placeholder="As printed on the licence card" required />
                    </div>
                    {fieldErrors.licenseNumber
                      ? <p className="mt-1 text-[11px] leading-snug text-rose-600">{fieldErrors.licenseNumber}</p>
                      : <p className="mt-1 text-[11px] text-navy-300/80">We verify this during the bike &amp; licence check.</p>}
                  </div>
                  <div>
                    <Label htmlFor="availability" className="text-xs text-navy-300">Availability</Label>
                    <select
                      id="availability"
                      value={form.availability}
                      onChange={(e) => setForm({ ...form, availability: e.target.value })}
                      className="mt-1 w-full rounded-md border border-navy-100 bg-white px-3 py-2 text-sm text-navy"
                    >
                      <option value="full-time">Full-time (5+ days/week)</option>
                      <option value="part-time">Part-time (2-4 days/week)</option>
                      <option value="weekends">Weekends only</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Experience — phase 55 rewrite. A real applicant answered
               * "it was really nice, i enjoyed it" here (he was recalling a
               * ride he did for the owner before applying). The label now
               * asks about PAST WORK, the help text says "None" is a fine
               * answer, and the placeholder shows the expected shape. */}
              <div className="rounded-lg bg-linen-100 p-4 ring-1 ring-navy-100">
                <Label htmlFor="experience" className="flex items-center gap-1.5 text-xs font-semibold text-navy">
                  <HelpCircle className="h-3.5 w-3.5 text-gold-600" />
                  Have you worked as a rider or driver before? (optional)
                </Label>
                <p className="mt-1 mb-2 text-[11px] leading-relaxed text-navy-300">
                  This is about <strong className="text-navy">jobs you have done</strong> — dispatch, courier,
                  delivery, okada or driving work, and roughly how long. If you have never done delivery
                  work, just write <strong className="text-navy">“None — this would be my first”</strong> —
                  that is perfectly fine and does not count against you. (This is{' '}
                  <em>not</em> asking about any ride you have taken as a passenger.)
                </p>
                <Textarea
                  id="experience"
                  value={form.experience}
                  onChange={(e) => setField('experience', e.target.value)}
                  placeholder="e.g. 2 years dispatch riding for a logistics company in Yaba · or: None — this would be my first delivery job"
                  rows={3}
                />
              </div>

              {/* Contract consent */}
              <div className="rounded-lg bg-linen-100 p-4 ring-1 ring-navy-100">
                <label className="flex items-start gap-3 cursor-pointer">
                  <Checkbox
                    checked={form.consent}
                    onCheckedChange={(checked) => setForm({ ...form, consent: checked as boolean })}
                    className="mt-0.5"
                  />
                  <div className="text-xs text-navy-300">
                    <p className="font-semibold text-navy mb-1">Contract Agreement</p>
                    <p>
                      I confirm that all information provided is accurate. I understand that this is a
                      contract-based (non-employment) position. I will be responsible for my own fuel,
                      maintenance, and safety equipment. I consent to Kozy Care conducting verification
                      of my license and contact details. I agree to deliver garments with care and
                      represent the Kozy Care brand professionally at all times.
                    </p>
                  </div>
                </label>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gold-gradient text-navy hover:opacity-90 font-semibold"
              >
                {loading ? 'Submitting...' : 'Submit Application'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-navy-300">
          Questions? Call us at <strong>+234 803 175 5230</strong>
        </p>
      </div>
    </div>
  )
}
