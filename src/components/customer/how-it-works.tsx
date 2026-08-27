'use client'

// =============================================================================
// "Three steps. Zero fuss." — animated showcase cards
// =============================================================================
// The three existing cartoon illustrations are kept EXACTLY as they are —
// same image files, same resting framing, same card chrome, same copy. On
// hover (desktop) or entering the viewport (touch) each card plays a short
// choreographed sequence that demonstrates its step:
//
//   01 · Request a pickup — the camera drifts and dives toward the
//        customer's phone; the Kozy app appears, the list scrolls (as if the
//        character scrolled it) and lands on the gold "BOOK PICKUP NOW"
//        button, which taps itself — and stays clickable for real.
//   02 · We collect & treat — drift + dive to the garment handoff; a live
//        order tracker fills in: picked up → in atelier → pressed.
//   03 · Pristine return — drift + dive into the delivery box; the gold
//        Kozy seal stamps in, sparkles twinkle, CTA to book the next pickup.
//
// Moving the pointer away at ANY point reverses smoothly back to the resting
// frame (the character looking pleased, mid-booking). prefers-reduced-motion
// keeps the cards completely static.
//
// NOTE: the card itself stays perfectly FLAT — there is no 3D tilt/bend of
// the card chrome (owner request). All motion happens inside the image
// window (camera zoom/pan, scrim, overlay UI) so the card never flexes under
// the pointer.
//
// The overlay UI is rendered in the site's own design language (cream cards,
// navy text, gold accents, the existing /icons/services SVGs) so the artwork
// style is never altered — motion is added, style is preserved.
// =============================================================================

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  motion,
  AnimatePresence,
  useReducedMotion,
} from 'framer-motion'
import {
  ShoppingBag,
  Truck,
  CheckCircle2,
  Check,
  ArrowRight,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

// -----------------------------------------------------------------------------
// Types & timing
// -----------------------------------------------------------------------------

type Phase = 'rest' | 'swivel' | 'dive' | 'reveal' | 'settle'

interface FocusPoint {
  /** Horizontal focus in % of the image width (0-100) */
  x: number
  /** Vertical focus in % of the image height (0-100) */
  y: number
  /** Zoom scale during the dive phase */
  scale: number
}

interface StepConfig {
  icon: typeof ShoppingBag
  image: string
  title: string
  body: string
  focus: FocusPoint
  overlay: 'app' | 'tracker' | 'delivery'
}

// Phase schedule after pointer enters (ms).
const SEQ = {
  swivel: 0,
  dive: 900,
  reveal: 1850,
  settle: 3700,
} as const

// Touch devices: auto-play once when the card is well inside the viewport;
// tap replays. After a touch/auto run the card holds the final state briefly,
// then returns to rest (no pointer to "leave").
const TOUCH_HOLD_MS = 4_000

// -----------------------------------------------------------------------------
// StepCard — the animated card
// -----------------------------------------------------------------------------

function StepCard({ step, index }: { step: StepConfig; index: number }) {
  const reduced = useReducedMotion()
  const winRef = useRef<HTMLDivElement>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const [phase, setPhase] = useState<Phase>('rest')
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const [isTouch, setIsTouch] = useState(false)
  const autoPlayed = useRef(false)
  const isTouchRef = useRef(false)
  isTouchRef.current = isTouch

  // Measure the image window so the zoom can be computed in pixels (exact
  // object-cover math regardless of breakpoint).
  useEffect(() => {
    const el = winRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) setSize({ w: r.width, h: r.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Pointer capability — touch devices autoplay once + tap-to-replay.
  // Hover handlers are attached everywhere: on touch, a tap fires a synthetic
  // mouseenter (native "tap to play"), and mouseleave reverses it.
  useEffect(() => {
    const touch = !window.matchMedia('(hover: hover)').matches
    setIsTouch(touch)
  }, [])

  const clearTimers = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }

  const run = () => {
    if (reduced) return
    clearTimers()
    setPhase('swivel')
    timers.current = [
      setTimeout(() => setPhase('dive'), SEQ.dive),
      setTimeout(() => setPhase('reveal'), SEQ.reveal),
      setTimeout(() => setPhase('settle'), SEQ.settle),
    ]
    // Touch runs have no mouseleave — hold the finale, then return to rest.
    if (isTouchRef.current) {
      timers.current.push(
        setTimeout(() => setPhase('rest'), SEQ.settle + TOUCH_HOLD_MS)
      )
    }
  }

  const stop = () => {
    clearTimers()
    setPhase('rest')
  }

  useEffect(() => () => clearTimers(), [])

  // Autoplay once when scrolled into view on non-hover devices.
  useEffect(() => {
    if (!isTouch || reduced) return
    const el = winRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (
            entry.isIntersecting &&
            entry.intersectionRatio >= 0.6 &&
            phase === 'rest' &&
            !autoPlayed.current
          ) {
            autoPlayed.current = true
            run()
          }
        }
      },
      { threshold: [0.6] }
    )
    io.observe(el)
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTouch, reduced, phase])

  // ----- Zoom target (pixel-exact object-cover math, square-ish sources) -----
  const IMG_W = 1024
  const IMG_H = 1024

  const zoom = useMemo(() => {
    if (!size) return { x: 0, y: 0, scale: 1 }
    const cover = Math.max(size.w / IMG_W, size.h / IMG_H)
    const pw = IMG_W * cover
    const ph = IMG_H * cover
    const ox = (size.w - pw) / 2
    const oy = (size.h - ph) / 2
    if (phase === 'rest') return { x: 0, y: 0, scale: 1 }
    if (phase === 'swivel') {
      // Subtle parallax drift while the view swivels.
      return { x: -0.012 * size.w, y: 0.006 * size.h, scale: 1.05 }
    }
    const s = phase === 'settle' ? step.focus.scale * 0.86 : step.focus.scale
    const fx = ox + (step.focus.x / 100) * pw
    const fy = oy + (step.focus.y / 100) * ph
    return {
      x: -s * (fx - size.w / 2),
      y: -s * (fy - size.h / 2),
      scale: s,
    }
  }, [phase, size, step.focus])

  const scrimOpacity =
    phase === 'reveal' ? 0.34 : phase === 'settle' ? 0.3 : phase === 'dive' ? 0.14 : 0

  const overlayVisible = phase === 'reveal' || phase === 'settle'

  const Icon = step.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.08 }}
    >
      <Card className="h-full overflow-hidden border-navy-100 bg-white shadow-navy transition hover:shadow-lg">
        <div
          ref={winRef}
          data-phase={phase}
          className="relative h-44 cursor-pointer select-none overflow-hidden bg-linen-100"
          onMouseEnter={run}
          onMouseLeave={stop}
          onClick={() => {
            if (phase === 'rest') run()
          }}
        >
          {/* Artwork (untouched) — camera dives toward the focus point */}
          <motion.div
            className="absolute inset-0"
            animate={zoom}
            transition={{ type: 'spring', stiffness: 80, damping: 19 }}
            style={{ willChange: 'transform' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={step.image}
              alt={step.title}
              draggable={false}
              className="h-full w-full object-cover"
            />
          </motion.div>

          {/* Navy scrim so the overlay UI pops off the artwork */}
          <motion.div
            className="pointer-events-none absolute inset-0 bg-navy-700"
            animate={{ opacity: scrimOpacity }}
            transition={{ duration: 0.5 }}
          />

          {/* Light sheen sweeping across during the opening drift */}
          <AnimatePresence>
            {phase === 'swivel' && (
              <motion.div
                key="sheen"
                className="pointer-events-none absolute inset-y-0 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent"
                initial={{ x: '-170%', opacity: 0 }}
                animate={{ x: '270%', opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.9, ease: 'easeInOut' }}
              />
            )}
          </AnimatePresence>

          {/* Step overlay — the "story" of this card */}
          <AnimatePresence>
            {overlayVisible && (
              <motion.div
                key="overlay"
                className="absolute inset-0 z-10 flex items-center justify-center px-3"
                initial={{ opacity: 0, scale: 0.94, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 6 }}
                transition={{ type: 'spring', stiffness: 260, damping: 24 }}
              >
                {step.overlay === 'app' && <PhoneAppCard />}
                {step.overlay === 'tracker' && <TrackerCard />}
                {step.overlay === 'delivery' && <DeliveryCard />}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Step badge — same chrome as before, tiny nudge on drift */}
          <motion.div
            className="absolute left-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-xl bg-navy text-gold-400 shadow-navy"
            animate={{ x: phase === 'swivel' ? 5 : 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          >
            <Icon className="h-5 w-5" />
          </motion.div>
        </div>
        <CardContent className="p-6">
          <h3 className="font-serif text-lg font-semibold text-navy">
            {step.title}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-navy-300">
            {step.body}
          </p>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// -----------------------------------------------------------------------------
// 01 · The Kozy app scrolling to "BOOK PICKUP NOW"
// -----------------------------------------------------------------------------

const APP_ROWS = [
  { icon: '/icons/services/shirt.svg', name: 'Shirt', qty: '×2' },
  { icon: '/icons/services/blazer.svg', name: 'Blazer', qty: '×1' },
  { icon: '/icons/services/suit.svg', name: 'Suit (2-pc)', qty: '×1' },
  { icon: '/icons/services/kaftan.svg', name: 'Kaftan', qty: '×1' },
]

function PhoneAppCard() {
  return (
    <div className="w-full max-w-[320px] -rotate-1 overflow-hidden rounded-2xl bg-white shadow-navy ring-1 ring-navy-100">
      {/* App header */}
      <div className="flex items-center justify-between border-b border-linen-200 px-3 py-1.5">
        <div className="flex items-center gap-1.5">
          <span className="flex h-4 w-4 items-center justify-center rounded-md bg-navy text-[8px] font-bold text-gold-400">
            K
          </span>
          <span className="text-[10px] font-bold text-navy">Kozy</span>
        </div>
        <span className="text-[8px] font-semibold uppercase tracking-[0.16em] text-navy-300">
          Pickup request
        </span>
      </div>

      {/* Phone screen — the list scrolls and lands on the CTA */}
      <div className="relative h-[86px] overflow-hidden bg-linen-50">
        <motion.div
          className="absolute inset-x-2 top-1.5 space-y-1"
          initial={{ y: 0 }}
          animate={{ y: -52 }}
          transition={{ delay: 0.8, duration: 1.05, ease: [0.65, 0, 0.35, 1] }}
        >
          {APP_ROWS.map((row, i) => (
            <motion.div
              key={row.name}
              className="flex items-center gap-1.5 rounded-lg bg-white px-2 py-1 ring-1 ring-linen-200"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.09, duration: 0.3 }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={row.icon} alt="" className="h-3.5 w-3.5" />
              <span className="text-[9.5px] font-semibold text-navy-700">
                {row.name}
              </span>
              <span className="ml-auto text-[8.5px] font-bold text-navy-300">
                {row.qty}
              </span>
            </motion.div>
          ))}

          {/* The CTA the scroll lands on */}
          <motion.div
            className="pt-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.75, duration: 0.25 }}
          >
            <Link
              href="/book"
              className="relative flex h-8 w-full items-center justify-center rounded-xl bg-gold-gradient text-[10px] font-extrabold tracking-[0.08em] text-navy shadow-gold hover:opacity-90"
            >
              BOOK PICKUP NOW
              {/* The character's "tap" */}
              <motion.span
                className="pointer-events-none absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold-300/90"
                initial={{ opacity: 0, scale: 0.4, y: -10 }}
                animate={{ opacity: [0, 1, 0], scale: [0.4, 1, 1.1], y: [-10, 0, 0] }}
                transition={{ delay: 1.95, duration: 0.4, times: [0, 0.55, 1] }}
              />
              <motion.span
                className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-gold-300"
                initial={{ opacity: 0, scale: 1 }}
                animate={{ opacity: [0.9, 0], scale: [1, 1.14] }}
                transition={{ delay: 2.1, duration: 0.55, ease: 'easeOut' }}
              />
            </Link>
          </motion.div>
        </motion.div>

        {/* Soft fade at the top of the "screen" */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-3.5 bg-gradient-to-b from-linen-50 to-transparent" />
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// 02 · Live order tracker (picked up → in atelier → pressed)
// -----------------------------------------------------------------------------

const TRACK_STAGES = [
  { icon: '/icons/services/hanger.svg', label: 'Picked up', state: 'done' },
  { icon: '/icons/services/washing-machine.svg', label: 'In atelier', state: 'active' },
  { icon: '/icons/services/iron.svg', label: 'Pressed', state: 'pending' },
] as const

function TrackerCard() {
  return (
    <div className="w-full max-w-[320px] rotate-1 rounded-2xl bg-white px-3 py-2 shadow-navy ring-1 ring-navy-100">
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-navy px-2 py-0.5 font-mono text-[8.5px] font-bold text-gold-400">
          KZ-25·0814
        </span>
        <span className="text-[8.5px] font-semibold text-navy-300">
          Today · 2:34 PM
        </span>
      </div>

      <div className="mt-2.5 flex items-start">
        {TRACK_STAGES.map((stage, i) => (
          <div key={stage.label} className="flex items-start">
            {/* Node */}
            <div className="relative flex flex-col items-center">
              <motion.div
                className={
                  stage.state === 'done'
                    ? 'flex h-6 w-6 items-center justify-center rounded-full bg-gold-gradient shadow-gold'
                    : stage.state === 'active'
                      ? 'flex h-6 w-6 items-center justify-center rounded-full bg-white ring-2 ring-gold-400'
                      : 'flex h-6 w-6 items-center justify-center rounded-full bg-white ring-1 ring-linen-400'
                }
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.25 + i * 0.3, type: 'spring', stiffness: 320, damping: 18 }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={stage.icon}
                  alt=""
                  className={`h-3.5 w-3.5 ${stage.state === 'pending' ? 'opacity-35' : ''}`}
                />
              </motion.div>
              {/* Active node: live pulse */}
              {stage.state === 'active' && (
                <motion.span
                  className="absolute h-6 w-6 rounded-full border-2 border-gold-400"
                  initial={{ opacity: 0.8, scale: 1 }}
                  animate={{ opacity: 0, scale: 1.7 }}
                  transition={{ delay: 1.2, duration: 1.3, repeat: Infinity, ease: 'easeOut' }}
                />
              )}
              <motion.span
                className={`mt-1 text-[7.5px] font-semibold ${
                  stage.state === 'pending' ? 'text-navy-300/70' : 'text-navy-700'
                }`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.45 + i * 0.3 }}
              >
                {stage.label}
              </motion.span>
            </div>
            {/* Connector */}
            {i < TRACK_STAGES.length - 1 && (
              <div className="relative mx-1 mt-[11px] h-[3px] w-9 overflow-hidden rounded-full bg-linen-300 sm:w-12">
                <motion.div
                  className="absolute inset-0 origin-left rounded-full bg-gold-gradient"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: i === 0 ? 1 : 0.0 }}
                  transition={{ delay: 0.55 + i * 0.3, duration: 0.55, ease: 'easeInOut' }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6, duration: 0.35 }}
        className="mt-1.5 flex justify-end border-t border-linen-200 pt-1.5"
      >
        <Link
          href="/portal"
          className="flex items-center gap-1 text-[9px] font-bold text-navy-700 underline decoration-gold-400 decoration-2 underline-offset-2 hover:text-navy"
        >
          Track live in your dashboard
          <ArrowRight className="h-3 w-3" />
        </Link>
      </motion.div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// 03 · Gold Kozy seal stamps the pristine return
// -----------------------------------------------------------------------------

function Sparkle({ className, delay }: { className: string; delay: number }) {
  return (
    <motion.svg
      viewBox="0 0 12 12"
      className={`pointer-events-none absolute h-2.5 w-2.5 ${className}`}
      initial={{ opacity: 0, scale: 0, rotate: -30 }}
      animate={{ opacity: [0, 1, 0.55, 1], scale: [0, 1, 0.82, 1], rotate: 0 }}
      transition={{ delay, duration: 1.8, repeat: Infinity, repeatDelay: 0.9 }}
    >
      <path
        d="M6 0 L7.1 4.9 L12 6 L7.1 7.1 L6 12 L4.9 7.1 L0 6 L4.9 4.9 Z"
        fill="#D4AF37"
      />
    </motion.svg>
  )
}

function DeliveryCard() {
  return (
    <div className="relative w-full max-w-[320px] -rotate-1 rounded-2xl bg-white px-3 py-2.5 shadow-navy ring-1 ring-navy-100">
      <Sparkle className="right-2 top-1.5" delay={0.9} />
      <Sparkle className="left-2 top-6" delay={1.25} />
      <Sparkle className="bottom-7 right-3" delay={1.6} />

      <div className="flex items-center gap-3">
        {/* The gold Kozy seal, stamped in */}
        <motion.div
          className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-gradient shadow-gold"
          initial={{ scale: 1.7, opacity: 0, rotate: -16 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ delay: 0.35, type: 'spring', stiffness: 260, damping: 15 }}
        >
          <span className="font-serif text-sm font-bold text-navy">K</span>
          <span className="absolute inset-[3px] rounded-full border border-navy/25" />
          <motion.span
            className="absolute inset-0 rounded-full border-2 border-gold-400"
            initial={{ scale: 1, opacity: 0.7 }}
            animate={{ scale: 2, opacity: 0 }}
            transition={{ delay: 0.55, duration: 0.7, ease: 'easeOut' }}
          />
        </motion.div>

        <div className="min-w-0">
          <motion.p
            className="text-[11px] font-bold leading-tight text-navy"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6, duration: 0.35 }}
          >
            Delivered in 3–5 days
          </motion.p>
          <motion.p
            className="mt-0.5 text-[8.5px] font-medium text-navy-300"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.35 }}
          >
            Sealed · Pressed · Return-as-Received
          </motion.p>
        </div>

        <motion.div
          className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy"
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.05, type: 'spring', stiffness: 320, damping: 16 }}
        >
          <Check className="h-3.5 w-3.5 text-gold-400" strokeWidth={3} />
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.3, duration: 0.35 }}
        className="mt-2"
      >
        <Link
          href="/book"
          className="flex h-8 w-full items-center justify-center rounded-xl bg-gold-gradient text-[10px] font-extrabold tracking-[0.08em] text-navy shadow-gold hover:opacity-90"
        >
          BOOK YOUR NEXT PICKUP
        </Link>
      </motion.div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Section — heading and grid are unchanged from the original design
// -----------------------------------------------------------------------------

const STEPS: StepConfig[] = [
  {
    icon: ShoppingBag,
    image: '/brand/images/how-1-book.png',
    title: '01 · Request a pickup',
    body: 'Choose your garments, request a bulk pickup, or schedule a recurring slot. Snap optional condition photos to activate our Return-as-Received Guarantee.',
    focus: { x: 66, y: 52, scale: 2.5 },
    overlay: 'app',
  },
  {
    icon: Truck,
    image: '/brand/images/how-2-collect.png',
    title: '02 · We collect & treat',
    body: 'A Kozy rider arrives within your window. Items travel to our atelier where they are sorted, treated, and pressed by garment-specific protocols.',
    focus: { x: 52, y: 56, scale: 2.0 },
    overlay: 'tracker',
  },
  {
    icon: CheckCircle2,
    image: '/brand/images/how-3-return.png',
    title: '03 · Pristine return',
    body: 'Your garments are folded, packaged, and delivered within 3–5 days (retail) — or as fast as 24 hours with Express — sealed in protective Kozy garment bags, ready for your wardrobe.',
    focus: { x: 64, y: 50, scale: 1.9 },
    overlay: 'delivery',
  },
]

export function HowItWorksSection() {
  return (
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
            From your dressing room to our atelier and back — with every stage
            visible in your dashboard.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <StepCard key={step.title} step={step} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}
