'use client'

// =============================================================================
// MeasurementsGuide — standalone interactive measurement tutorial (Phase 18,
// client directive).
// =============================================================================
// "There should be some kind of a mini tutorial... it should be cleverly,
// interactively done that sort of allows men and women to be able to measure
// themselves, or their children... and what exactly those measurements
// really mean... something that can just very easily educate users so that
// they can even be happy with: oh, look at this cool service that they're
// just even showing us all this information for free."
//
// Page anatomy:
//   hero → what you need → golden rules → profile tabs (men/women/children)
//   with interactive croquis diagram + measurement detail cards →
//   "the two everyone mixes up" glossary → save-your-measurements tool →
//   CTA back to booking.
// Saved measurements live in localStorage (private to this browser) and can
// be attached to the seamstress note at booking time.
// =============================================================================

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Ruler,
  Clock,
  Users,
  Camera,
  Save,
  Check,
  Trash2,
  Scissors,
  BookOpen,
  Info,
} from 'lucide-react'
import { Logo } from '@/components/shell/logo'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  MEASUREMENTS,
  CATEGORY_META,
  loadSavedMeasurements,
  saveMeasurementsToStorage,
  clearSavedMeasurements,
  hasValues,
  type MeasurementCategory,
  type SavedMeasurements,
} from '@/lib/measurements'
import { MeasurementFigure } from '@/components/customer/measurement-figure'

type Unit = 'cm' | 'in'

const PROFILES: { id: MeasurementCategory; label: string; hint: string }[] = [
  { id: 'men', label: 'For men', hint: 'Shirts, trousers, agbada & blazers' },
  { id: 'women', label: 'For women', hint: 'Dresses, blouses, skirts & iro & buba' },
  { id: 'children', label: 'For children', hint: 'Uniforms & growth hems' },
]

export function MeasurementsGuide() {
  const [profile, setProfile] = useState<MeasurementCategory>('men')
  const [activeId, setActiveId] = useState<string | null>(MEASUREMENTS.men[0]?.id ?? null)

  // ----- saved measurements state -----
  const [unit, setUnit] = useState<Unit>('cm')
  const [values, setValues] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState<SavedMeasurements | null>(null)
  const [justSaved, setJustSaved] = useState(false)

  // load stored profile on mount
  useEffect(() => {
    const m = loadSavedMeasurements()
    if (m) {
      setSaved(m)
      setProfile(m.profile)
      setUnit(m.unit)
      setValues(m.values ?? {})
      setActiveId(MEASUREMENTS[m.profile][0]?.id ?? null)
    }
  }, [])

  const defs = MEASUREMENTS[profile]
  const activeDef = useMemo(
    () => defs.find((d) => d.id === activeId) ?? defs[0],
    [defs, activeId],
  )

  const switchProfile = (p: MeasurementCategory) => {
    setProfile(p)
    setActiveId(MEASUREMENTS[p][0]?.id ?? null)
    // load values already stored for this profile (if the saved profile matches)
    if (saved && saved.profile === p) {
      setUnit(saved.unit)
      setValues(saved.values ?? {})
    } else {
      setValues({})
    }
    setJustSaved(false)
  }

  const filledCount = defs.filter((d) => (values[d.id] ?? '').trim().length > 0).length

  const doSave = () => {
    const m: SavedMeasurements = {
      profile,
      unit,
      values: { ...values },
      savedAt: new Date().toISOString(),
    }
    saveMeasurementsToStorage(m)
    setSaved(m)
    setJustSaved(true)
    window.setTimeout(() => setJustSaved(false), 2600)
  }

  const doClear = () => {
    clearSavedMeasurements()
    setSaved(null)
    setValues({})
    setJustSaved(false)
  }

  const savedDateLabel = useMemo(() => {
    if (!hasValues(saved)) return null
    const d = new Date(saved.savedAt)
    if (Number.isNaN(d.getTime())) return null
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }, [saved])

  return (
    <div className="min-h-screen bg-linen pb-20">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        {/* ---------------- header ---------------- */}
        <div className="flex flex-col items-center text-center">
          <Logo />
          <Link
            href="/#alterations"
            className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-navy-300 transition hover:text-navy"
          >
            <ArrowLeft className="h-4 w-4" /> Back to alterations
          </Link>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-400">
              Free guide — no order needed
            </p>
            <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight text-navy sm:text-4xl">
              How to take your measurements
            </h1>
            <p className="mx-auto mt-4 max-w-2xl leading-relaxed text-navy-300">
              Whether you are booking an alteration with us or simply want to know your own
              numbers, this guide shows you exactly where the tape goes and what each
              measurement means. Take ten minutes with a soft tape measure — the same guide
              works for men, women and children, and your numbers stay saved on this device
              so you never have to dig them out again.
            </p>
          </motion.div>
        </div>

        {/* ---------------- what you need ---------------- */}
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: Ruler,
              title: 'A soft tape measure',
              text: 'Tailor\u2019s tape, sold in any market or haberdashery for a few hundred naira. A piece of string plus a ruler works too.',
            },
            {
              icon: Clock,
              title: 'Ten quiet minutes',
              text: 'Measure when you are relaxed and at normal temperature — not straight after the gym or a heavy meal.',
            },
            {
              icon: Users,
              title: 'A helper (optional)',
              text: 'Shoulder and sleeve measurements are far easier with a second pair of hands, but every number here can be taken alone.',
            },
            {
              icon: Camera,
              title: 'A mirror or phone camera',
              text: 'The tape must stay level all the way round. A mirror — or a photo taken over your shoulder — catches tilts you cannot feel.',
            },
          ].map((c) => (
            <Card key={c.title} className="border-navy-100 shadow-none">
              <CardContent className="p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy-50">
                  <c.icon className="h-4.5 w-4.5 text-navy-400" />
                </div>
                <p className="mt-3 text-sm font-semibold text-navy">{c.title}</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-navy-300">{c.text}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ---------------- golden rules ---------------- */}
        <Card className="mt-4 border-gold-200 bg-gold-50 shadow-none">
          <CardContent className="p-5 sm:p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-600">
              Five golden rules
            </p>
            <ul className="mt-3 grid gap-2.5 text-sm leading-relaxed text-navy-300 sm:grid-cols-2">
              <li className="flex gap-2.5">
                <span className="mt-0.5 shrink-0 font-serif font-bold text-gold-600">1.</span>
                Measure over light clothing — a shirt, not a thick jacket or agbada.
              </li>
              <li className="flex gap-2.5">
                <span className="mt-0.5 shrink-0 font-serif font-bold text-gold-600">2.</span>
                Stand relaxed, feet together, breathing normally. Never hold your breath.
              </li>
              <li className="flex gap-2.5">
                <span className="mt-0.5 shrink-0 font-serif font-bold text-gold-600">3.</span>
                The tape is snug, not tight — exactly one finger should slide under it.
              </li>
              <li className="flex gap-2.5">
                <span className="mt-0.5 shrink-0 font-serif font-bold text-gold-600">4.</span>
                Keep the tape level all the way round — check the mirror, not your instinct.
              </li>
              <li className="flex gap-2.5 sm:col-span-2">
                <span className="mt-0.5 shrink-0 font-serif font-bold text-gold-600">5.</span>
                Round to the nearest centimetre (or half inch), and write each number down the
                moment you read it. If a measurement matters for an alteration, measure twice.
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* ---------------- profile tabs ---------------- */}
        <div className="mt-12 flex justify-center">
          <div className="inline-flex flex-wrap justify-center gap-1.5 rounded-full border border-navy-100 bg-white p-1.5 shadow-sm">
            {PROFILES.map((p) => (
              <button
                key={p.id}
                onClick={() => switchProfile(p.id)}
                className={cn(
                  'rounded-full px-4 py-2 text-sm font-semibold transition',
                  profile === p.id
                    ? 'bg-navy text-white shadow-sm'
                    : 'text-navy-300 hover:bg-navy-50 hover:text-navy',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-3 text-center text-sm text-navy-300">{CATEGORY_META[profile].blurb}</p>

        {/* ---------------- figure + measurement list ---------------- */}
        <div className="mt-8 grid gap-6 lg:grid-cols-[380px_1fr]">
          {/* sticky interactive diagram */}
          <div className="lg:sticky lg:top-6 lg:self-start">
            <Card className="border-navy-100 shadow-navy">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-600">
                    Interactive diagram
                  </p>
                  <p className="text-[11px] text-navy-300">Tap a line or a card</p>
                </div>
                <div className="mt-2 h-[460px] sm:h-[520px]">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={profile}
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.97 }}
                      transition={{ duration: 0.25 }}
                      className="h-full"
                    >
                      <MeasurementFigure
                        profile={profile}
                        activeId={activeDef?.id ?? null}
                        onSelect={(id) => setActiveId(id)}
                      />
                    </motion.div>
                  </AnimatePresence>
                </div>
                <p className="mt-2 text-center text-[11px] leading-snug text-navy-300">
                  {activeDef
                    ? `The gold line shows where the tape sits for your ${activeDef.label.toLowerCase()} measurement.`
                    : 'Select a measurement to see where the tape goes.'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* measurement detail cards */}
          <div>
            {/* quick selector chips */}
            <div className="flex flex-wrap gap-1.5">
              {defs.map((d) => (
                <button
                  key={d.id}
                  onMouseEnter={() => setActiveId(d.id)}
                  onFocus={() => setActiveId(d.id)}
                  onClick={() => setActiveId(d.id)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                    activeDef?.id === d.id
                      ? 'border-gold-400 bg-gold-400/15 text-navy'
                      : 'border-navy-100 bg-white text-navy-300 hover:border-gold-300 hover:text-navy',
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>

            {/* active measurement detail */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`${profile}-${activeDef?.id}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
              >
                {activeDef && (
                  <Card className="mt-4 border-navy-100 shadow-navy">
                    <CardContent className="p-6 sm:p-8">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h2 className="font-serif text-2xl font-semibold text-navy">
                          {activeDef.label}
                        </h2>
                        <span className="rounded-full bg-navy-50 px-2.5 py-1 text-[11px] font-semibold text-navy-300">
                          {PROFILE_POS(profile)} measurement
                        </span>
                      </div>
                      <p className="mt-2 text-[15px] font-medium leading-relaxed text-navy">
                        {activeDef.tagline}
                      </p>

                      <div className="mt-5 grid gap-5 sm:grid-cols-2">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-600">
                            How to measure
                          </p>
                          <ol className="mt-2.5 space-y-2.5">
                            {activeDef.howTo.map((step, i) => (
                              <li key={i} className="flex gap-3 text-sm leading-relaxed text-navy-300">
                                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-navy text-[10px] font-bold text-white">
                                  {i + 1}
                                </span>
                                {step}
                              </li>
                            ))}
                          </ol>
                        </div>
                        <div className="space-y-4">
                          <div className="rounded-xl bg-navy p-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-300">
                              What the seamstress uses it for
                            </p>
                            <p className="mt-2 text-sm leading-relaxed text-white/85">
                              {activeDef.why}
                            </p>
                          </div>
                          {activeDef.mistake && (
                            <div className="rounded-xl border border-gold-200 bg-gold-50 p-4">
                              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-600">
                                <Info className="h-3.5 w-3.5" /> The classic mistake
                              </p>
                              <p className="mt-2 text-sm leading-relaxed text-navy-300">
                                {activeDef.mistake}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </motion.div>
            </AnimatePresence>

            {/* all measurements at a glance */}
            <Card className="mt-4 border-navy-100 bg-white/60 shadow-none">
              <CardContent className="p-5 sm:p-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-navy-300">
                  All {CATEGORY_META[profile].label.toLowerCase()} measurements
                </p>
                <ul className="mt-3 divide-y divide-navy-50">
                  {defs.map((d) => (
                    <li key={d.id}>
                      <button
                        onClick={() => setActiveId(d.id)}
                        className="group flex w-full items-center justify-between gap-4 py-2.5 text-left"
                      >
                        <span className="flex items-center gap-3">
                          <span
                            className={cn(
                              'h-1.5 w-1.5 rounded-full transition',
                              activeDef?.id === d.id ? 'bg-gold-400' : 'bg-navy-100 group-hover:bg-gold-300',
                            )}
                          />
                          <span className="text-sm font-semibold text-navy">{d.label}</span>
                        </span>
                        <span className="hidden max-w-[60%] truncate text-[13px] text-navy-300 sm:block">
                          {d.tagline}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ---------------- glossary ---------------- */}
        <div className="mt-14">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-400">
              The measurements everyone mixes up
            </p>
            <h2 className="mt-2 font-serif text-2xl font-semibold tracking-tight text-navy sm:text-3xl">
              Waist is not hips. Bust is not band.
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-navy-300">
              Half of all alteration confusion comes from three pairs of numbers that sound
              similar but sit in different places. Here they are, settled once and for all —
              and if you only memorise one, make it the first.
            </p>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              {
                title: 'Natural waist vs hips',
                body:
                  'Your natural waist is the narrowest part of your torso — bend sideways and the crease that appears is it, usually just above the navel. Your hips are the fullest part lower down, roughly 20\u2009cm below the waist. Low-rise jeans sit at neither. When we say \u201Cwaist taken in\u201D, we always mean the natural waist.',
              },
              {
                title: 'Bust vs underbust (band)',
                body:
                  'The bust is around the fullest part of the chest. The underbust — where a bra band sits — is 5\u201310\u2009cm smaller and snugger. Garment sizing uses the bust; bra sizing uses both. Giving us the bust alone is fine for dresses and kaftans.',
              },
              {
                title: 'Inseam vs outside leg',
                body:
                  'The inseam runs from the crotch down the inside of the leg to the hem — it is the number trouser hemming needs. The outside leg runs from the waist over the hip down to the same hem, and it is always longer. If you measure a good trouser flat along its inner seam, you get the inseam directly.',
              },
            ].map((g) => (
              <Card key={g.title} className="border-navy-100 shadow-none">
                <CardContent className="p-6">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold-50">
                    <BookOpen className="h-4.5 w-4.5 text-gold-600" />
                  </div>
                  <p className="mt-3 font-serif text-lg font-semibold text-navy">{g.title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-navy-300">{g.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* ---------------- save your measurements ---------------- */}
        <Card className="mt-14 border-navy-100 shadow-navy">
          <CardContent className="p-6 sm:p-10">
            <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-400">
                  Save your numbers
                </p>
                <h2 className="mt-2 font-serif text-2xl font-semibold tracking-tight text-navy sm:text-3xl">
                  Measure once, reuse every time.
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-navy-300">
                  Fill in your numbers and save them here. They stay on this device — private
                  to your browser, no account needed, never uploaded anywhere. The next time
                  you book an alteration, tap <span className="font-semibold text-navy">&ldquo;Attach my saved measurements&rdquo;</span> in
                  the booking form and the seamstress gets your full set with the order, so
                  you never type the same numbers twice.
                </p>

                {/* unit toggle */}
                <div className="mt-6 flex items-center gap-3">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-navy-300">
                    Units
                  </span>
                  <div className="inline-flex rounded-full border border-navy-100 bg-white p-1">
                    {(['cm', 'in'] as Unit[]).map((u) => (
                      <button
                        key={u}
                        onClick={() => setUnit(u)}
                        className={cn(
                          'rounded-full px-3.5 py-1 text-xs font-semibold transition',
                          unit === u ? 'bg-navy text-white' : 'text-navy-300 hover:text-navy',
                        )}
                      >
                        {u === 'cm' ? 'Centimetres' : 'Inches'}
                      </button>
                    ))}
                  </div>
                  {filledCount > 0 && (
                    <span className="text-xs text-navy-300">
                      {filledCount} of {defs.length} filled
                    </span>
                  )}
                </div>

                {/* inputs */}
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {defs.map((d) => (
                    <label key={d.id} className="block">
                      <span className="text-xs font-semibold text-navy">{d.label}</span>
                      <span className="mt-1 flex items-center overflow-hidden rounded-xl border border-navy-200 bg-white focus-within:border-gold-300 focus-within:ring-2 focus-within:ring-gold-200">
                        <input
                          value={values[d.id] ?? ''}
                          onChange={(e) =>
                            setValues((prev) => ({ ...prev, [d.id]: e.target.value }))
                          }
                          inputMode="decimal"
                          placeholder="—"
                          className="w-full px-3 py-2.5 text-sm text-navy placeholder:text-navy-200 focus:outline-none"
                        />
                        <span className="pr-3 text-xs font-semibold text-navy-300">{unit}</span>
                      </span>
                    </label>
                  ))}
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <Button
                    onClick={doSave}
                    disabled={filledCount === 0}
                    className="rounded-full bg-gold-gradient px-6 text-navy hover:opacity-90"
                  >
                    {justSaved ? (
                      <>
                        <Check className="h-4 w-4" /> Saved on this device
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" /> Save my measurements
                      </>
                    )}
                  </Button>
                  {hasValues(saved) && (
                    <Button
                      onClick={doClear}
                      variant="outline"
                      className="rounded-full border-navy-200 text-navy-300 hover:border-red-200 hover:text-red-500 hover:bg-white"
                    >
                      <Trash2 className="h-4 w-4" /> Clear
                    </Button>
                  )}
                </div>
              </div>

              {/* status panel */}
              <div className="flex flex-col justify-center rounded-2xl bg-navy p-6 sm:p-8">
                <Scissors className="h-6 w-6 text-gold-300" />
                <p className="mt-4 font-serif text-xl font-semibold text-white">
                  {hasValues(saved)
                    ? `Saved: ${CATEGORY_META[saved.profile].label.toLowerCase()}`
                    : 'Nothing saved yet'}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-white/70">
                  {hasValues(saved)
                    ? `Updated ${savedDateLabel ?? 'recently'} · ${
                        Object.values(saved.values).filter((v) => v && v.trim()).length
                      } measurements stored on this device. They will be offered automatically next time you book an alteration.`
                    : 'Save your numbers and they will be offered automatically next time you book an alteration — the seamstress gets them with your order.'}
                </p>
                <ul className="mt-5 space-y-2 text-[13px] text-white/70">
                  <li className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold-300" />
                    Private to this browser — nothing is uploaded
                  </li>
                  <li className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold-300" />
                    Edit and re-save any time your numbers change
                  </li>
                  <li className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold-300" />
                    The seamstress still calls to confirm before quoting
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ---------------- CTA ---------------- */}
        <div className="mt-12 rounded-2xl bg-navy px-6 py-10 text-center sm:px-10">
          <h2 className="font-serif text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Numbers ready? Put them to work.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-white/70">
            Book a pickup, add an alteration, and describe what needs changing — your saved
            measurements ride along with the order. The seamstress assesses every piece,
            calls to confirm, and quotes before a single stitch is sewn.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/book">
              <Button className="rounded-full bg-gold-gradient px-6 text-navy hover:opacity-90">
                Book pickup with alterations <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/#alterations">
              <Button
                variant="outline"
                className="rounded-full border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                Back to alterations
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function PROFILE_POS(profile: MeasurementCategory): string {
  if (profile === 'men') return 'Men\u2019s'
  if (profile === 'women') return 'Women\u2019s'
  return 'Children\u2019s'
}
