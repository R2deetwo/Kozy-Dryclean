'use client'

// =============================================================================
// MeasurementDiagram — the close-up illustration shown at the top of each
// measurement card in the guide (Phase 27).
// =============================================================================
// Client directive: "the instructions could give more imagery in the
// individual cards when they select a particular area... there are much
// better guides to be emulated out there."
//
// Professional bespoke guides teach each measurement with a ZOOMED view of
// the relevant body region, the tape drawn on it, and a couple of short
// callouts. This component does exactly that:
//   • it re-renders the SAME shaded mannequin from measurement-figure.tsx,
//     cropped to the relevant region (so the close-up and the interactive
//     diagram always agree);
//   • the measurement itself is always the gold tape (front arc + dashed
//     back line for circumferences, arrowed path with landmark dots for
//     point-to-point);
//   • reference lines the customer must NOT measure at ("where trousers
//     sit", the bust line above the band) are drawn faded grey — the
//     classic-mistake visuals;
//   • short navy/gold chips carry the key instruction; dotted leaders point
//     from a chip to the exact spot on the body;
//   • the shoulder close-up is drawn from the BACK (that measurement is
//     taken across the back), and the child's height close-up shows the
//     wall + flat-pencil-mark method.
// =============================================================================

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  FigureBodyGroup,
  arrowhead,
  tapeArcs,
  type Pt,
} from '@/components/customer/measurement-figure'
import { MEASUREMENTS, type MeasurementCategory } from '@/lib/measurements'

// ---------------------------------------------------------------------------
// spec types
// ---------------------------------------------------------------------------

interface TapeSpec {
  kind: 'circ' | 'linear'
  points: Pt[]
  bulge?: number
  backOffset?: number
}

interface ChipSpec {
  /** chip centre */
  x: number
  y: number
  text: string
  tone?: 'navy' | 'gold' | 'grey'
  fs?: number
  /** dotted leader [from, to] drawn from the chip edge */
  lead?: [Pt, Pt]
}

interface FadedSpec {
  kind: 'circ' | 'linear'
  points: Pt[]
  text?: { x: number; y: number; anchor: 'start' | 'middle' | 'end'; label: string }
}

interface DiagramSpec {
  /** svg viewBox crop */
  crop: string
  back?: boolean
  tapes: TapeSpec[]
  faded?: FadedSpec[]
  chips?: ChipSpec[]
  /** free gold text line (e.g. "≈ 20 cm below the waist") */
  note?: { x: number; y: number; text: string; anchor?: 'start' | 'middle' | 'end' }
  /** child height: the wall + flat pencil mark */
  wall?: { x: number; y1: number; y2: number; tick: { x1: number; x2: number; y: number } }
  /** hem tick for vertical length measurements */
  hem?: { x1: number; x2: number; y: number }
  /** dashed continuation with an arrow (e.g. "…to the floor") */
  cont?: { from: Pt; to: Pt }
}

// ---------------------------------------------------------------------------
// gold tape + faded reference renderers
// ---------------------------------------------------------------------------

function TapePath({ tape, animated = false }: { tape: TapeSpec; animated?: boolean }) {
  if (tape.kind === 'circ') {
    const line = { id: '', kind: 'circ' as const, points: tape.points, label: { x: 0, y: 0, anchor: 'start' as const } }
    const { front, back } = tapeArcs(line, tape.backOffset)
    const [L, Rr] = tape.points
    const y = L[1]
    return (
      <g>
        <path d={back} fill="none" stroke="#E3BE4F" strokeWidth={1.5} strokeDasharray="4 3" strokeLinecap="round" />
        <path d={front} fill="none" stroke="#D4AF37" strokeWidth={2.4} strokeLinecap="round" />
        <path d={arrowhead(L[0] + 0.5, y, -1, 0)} fill="#B8962B" />
        <path d={arrowhead(Rr[0] - 0.5, y, 1, 0)} fill="#B8962B" />
        {animated && (
          <motion.path
            d={front}
            fill="none"
            stroke="#D4AF37"
            strokeWidth={2.4}
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        )}
      </g>
    )
  }
  const d = tape.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ')
  const first = tape.points[0]
  const last = tape.points[tape.points.length - 1]
  const sub = (a: Pt, b: Pt): Pt => {
    const dx = a[0] - b[0]
    const dy = a[1] - b[1]
    const m = Math.hypot(dx, dy) || 1
    return [dx / m, dy / m]
  }
  const dS = sub(first, tape.points[1])
  const dE = sub(last, tape.points[tape.points.length - 2])
  return (
    <g>
      <path d={d} fill="none" stroke="#D4AF37" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
      <path d={arrowhead(first[0], first[1], dS[0], dS[1])} fill="#B8962B" />
      <path d={arrowhead(last[0], last[1], dE[0], dE[1])} fill="#B8962B" />
      <circle cx={first[0]} cy={first[1]} r={4} fill="#D4AF37" />
      <circle cx={last[0]} cy={last[1]} r={4} fill="#D4AF37" />
      {animated && (
        <motion.path
          d={d}
          fill="none"
          stroke="#D4AF37"
          strokeWidth={2.4}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      )}
    </g>
  )
}

function FadedRef({ spec: f }: { spec: FadedSpec }) {
  const grey = '#C8D2DF'
  if (f.kind === 'circ') {
    const line = { id: '', kind: 'circ' as const, points: f.points, label: { x: 0, y: 0, anchor: 'start' as const } }
    const { front, back } = tapeArcs(line)
    return (
      <g>
        <path d={back} fill="none" stroke={grey} strokeWidth={1.1} strokeDasharray="3 3" />
        <path d={front} fill="none" stroke={grey} strokeWidth={1.3} strokeDasharray="6 4" strokeLinecap="round" />
        {f.text && (
          <text x={f.text.x} y={f.text.y} textAnchor={f.text.anchor} className="font-sans text-[9.5px] font-medium" fill="#8FA3BC">
            {f.text.label}
          </text>
        )}
      </g>
    )
  }
  const d = f.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ')
  return (
    <g>
      <path d={d} fill="none" stroke={grey} strokeWidth={1.3} strokeDasharray="6 4" strokeLinecap="round" />
      {f.text && (
        <text x={f.text.x} y={f.text.y} textAnchor={f.text.anchor} className="font-sans text-[9.5px] font-medium" fill="#8FA3BC">
          {f.text.label}
        </text>
      )}
    </g>
  )
}

function Chip({ chip }: { chip: ChipSpec }) {
  const fs = chip.fs ?? 11
  const w = chip.text.length * fs * 0.54 + 18
  const h = fs + 11
  const tone = chip.tone ?? 'navy'
  const fill = tone === 'navy' ? '#1B3A5F' : tone === 'gold' ? '#FBF5E0' : '#EEF0F2'
  const strokeC = tone === 'navy' ? 'none' : tone === 'gold' ? '#E3BE4F' : '#C8D2DF'
  const textC = tone === 'navy' ? '#FFFFFF' : tone === 'gold' ? '#947621' : '#6F88A8'
  return (
    <g>
      {chip.lead && (
        <line
          x1={chip.lead[0][0]}
          y1={chip.lead[0][1]}
          x2={chip.lead[1][0]}
          y2={chip.lead[1][1]}
          stroke="#9FB1C7"
          strokeWidth={1.2}
          strokeDasharray="2 3"
        />
      )}
      <rect x={chip.x - w / 2} y={chip.y - h / 2} width={w} height={h} rx={h / 2} fill={fill} stroke={strokeC} strokeWidth={strokeC === 'none' ? 0 : 1.2} />
      <text x={chip.x} y={chip.y + fs * 0.36} textAnchor="middle" className="font-sans font-semibold" fontSize={fs} fill={textC}>
        {chip.text}
      </text>
    </g>
  )
}

// ---------------------------------------------------------------------------
// back view (for the shoulder measurement — taken across the back)
// ---------------------------------------------------------------------------

function smoothClosed(pts: Pt[]): string {
  const n = pts.length
  let d = `M ${pts[0][0]} ${pts[0][1]}`
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]
    const p1 = pts[i]
    const p2 = pts[(i + 1) % n]
    const p3 = pts[(i + 2) % n]
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C ${(Math.round(c1x * 10) / 10)} ${(Math.round(c1y * 10) / 10)}, ${(Math.round(c2x * 10) / 10)} ${(Math.round(c2y * 10) / 10)}, ${p2[0]} ${p2[1]}`
  }
  return d + ' Z'
}

function mirrorPts(pts: Pt[]): Pt[] {
  return pts.map(([x, y]) => [320 - x, y] as Pt)
}

function ringFromLeftHalf(left: Pt[]): Pt[] {
  const mirrored = mirrorPts(left).reverse()
  return [...left, ...mirrored.slice(1, -1)]
}

// authored at men scale: shoulders ±52, in a 320×220 space
const BACK_HEAD: Pt[] = [
  [160, 10], [144, 13], [135, 24], [133, 38], [138, 50], [148, 56], [160, 58],
]
const BACK_BODY: Pt[] = [
  [152, 60],                                            // neck side
  [141, 66], [126, 72],                                 // trapezius slope
  [108, 76],                                            // shoulder point
  [101, 84], [99, 96], [101, 108],                      // deltoid
  [95, 120], [92, 134],                                 // upper arm, outer
  [101, 138],                                           // around the elbow
  [107, 130], [110, 120],                               // inner arm up
  [111, 112],                                           // armpit
  [115, 124], [118, 144],                               // lats
  [124, 162], [127, 180],                               // waist
  [131, 196], [133, 210],                               // hips
  [160, 216],                                           // centre bottom
]

function BackViewFigure({ profile }: { profile: MeasurementCategory }) {
  // women: slightly narrower shoulders; children: uniformly smaller
  const tf = (p: Pt): Pt => {
    if (profile === 'women') return [160 + (p[0] - 160) * 0.88, p[1]]
    if (profile === 'children') return [160 + (p[0] - 160) * 0.72, 120 + (p[1] - 120) * 0.72]
    return p
  }
  const head = smoothClosed(ringFromLeftHalf(BACK_HEAD.map(tf)))
  const body = smoothClosed(ringFromLeftHalf(BACK_BODY.map(tf)))
  const sL = tf([108, 76])
  const sR = tf([212, 76])
  const spineA = tf([160, 66])
  const spineB = tf([160, 206])
  const chipGold = tf([160, 196])
  const chipNavy = tf([160, 140])
  const leadFrom = tf([120, 132])
  const leadTo = tf([107, 82])

  return (
    <svg viewBox="30 0 260 220" className="h-auto w-full" style={{ maxHeight: 260 }} preserveAspectRatio="xMidYMid meet" role="img" aria-label="shoulder width from the back">
      <defs>
        <linearGradient id="kozy-back-body" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#CBB894" />
          <stop offset="0.18" stopColor="#E7DABF" />
          <stop offset="0.5" stopColor="#FAF4E6" />
          <stop offset="0.82" stopColor="#E7DABF" />
          <stop offset="1" stopColor="#CBB894" />
        </linearGradient>
      </defs>
      <path d={body} fill="url(#kozy-back-body)" strokeWidth={2} strokeLinejoin="round" stroke="#9FB1C7" />
      <path d={head} fill="url(#kozy-back-body)" strokeWidth={2} strokeLinejoin="round" stroke="#9FB1C7" />
      {/* spine hint */}
      <line x1={spineA[0]} y1={spineA[1]} x2={spineB[0]} y2={spineB[1]} stroke="#B7C4D6" strokeWidth={1} strokeDasharray="3 5" opacity={0.6} />
      {/* the tape: bony point to bony point */}
      <line x1={sL[0]} y1={sL[1]} x2={sR[0]} y2={sR[1]} stroke="#D4AF37" strokeWidth={2.4} strokeLinecap="round" />
      <path d={arrowhead(sL[0], sL[1], -1, 0)} fill="#B8962B" />
      <path d={arrowhead(sR[0], sR[1], 1, 0)} fill="#B8962B" />
      <circle cx={sL[0]} cy={sL[1]} r={4.5} fill="#D4AF37" />
      <circle cx={sR[0]} cy={sR[1]} r={4.5} fill="#D4AF37" />
      <Chip chip={{ x: chipNavy[0], y: chipNavy[1], text: 'Bony ledge to bony ledge', lead: [leadFrom, leadTo] }} />
      <Chip chip={{ x: chipGold[0], y: chipGold[1], text: 'Measure across the BACK', tone: 'gold' }} />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// diagram catalogue
// ---------------------------------------------------------------------------

// child landmarks are in the child's own 70%-scaled coordinate space
const DIAGRAMS: Record<MeasurementCategory, Record<string, DiagramSpec>> = {
  men: {
    neck: {
      crop: '55 55 210 150',
      tapes: [{ kind: 'circ', points: [[132, 100], [188, 100]] }],
      faded: [{ kind: 'circ', points: [[138, 114], [182, 114]], text: { x: 194, y: 120, anchor: 'start', label: 'collar line' } }],
      chips: [{ x: 160, y: 180, text: 'Snug at the base of the neck', lead: [[160, 168], [160, 106]] }],
    },
    chest: {
      crop: '50 105 220 175',
      tapes: [{ kind: 'circ', points: [[94, 160], [226, 160]] }],
      chips: [
        { x: 160, y: 130, text: 'level across the back', tone: 'gold', fs: 10 },
        { x: 160, y: 245, text: 'Under the arms, fullest part', lead: [[160, 233], [160, 170]] },
      ],
    },
    waist: {
      crop: '55 150 210 210',
      tapes: [{ kind: 'circ', points: [[100, 208], [220, 208]] }],
      faded: [{ kind: 'circ', points: [[100, 312], [220, 312]] }],
      chips: [
        { x: 160, y: 180, text: 'Narrowest part of your torso' },
        { x: 160, y: 338, text: 'NOT where trousers sit', tone: 'grey', fs: 10.5 },
      ],
    },
    seat: {
      crop: '55 205 210 205',
      tapes: [{ kind: 'circ', points: [[100, 272], [220, 272]] }],
      chips: [{ x: 160, y: 350, text: 'Fullest part, feet together', lead: [[160, 338], [160, 280]] }],
    },
    shoulder: { crop: '', back: true, tapes: [] },
    sleeve: {
      crop: '40 100 160 290',
      tapes: [{ kind: 'linear', points: [[106, 120], [88, 212], [91, 296]] }],
      chips: [
        { x: 120, y: 138, text: 'From the shoulder bone', fs: 10, lead: [[120, 148], [107, 124]] },
        { x: 120, y: 262, text: 'Slightly bent elbow', tone: 'gold', fs: 10 },
        { x: 128, y: 352, text: 'down to the wrist bone', fs: 10 },
      ],
    },
    inseam: {
      crop: '80 300 160 310',
      tapes: [{ kind: 'linear', points: [[152, 328], [148, 572]] }],
      faded: [{ kind: 'linear', points: [[152, 316], [152, 336]], text: { x: 158, y: 322, anchor: 'start', label: 'inner thigh' } }],
      chips: [{ x: 160, y: 596, text: 'Crotch to the hem you want', fs: 10, lead: [[160, 585], [149, 575]] }],
    },
  },

  women: {
    bust: {
      crop: '55 110 210 165',
      tapes: [{ kind: 'circ', points: [[96, 160], [224, 160]] }],
      chips: [
        { x: 160, y: 132, text: 'tape level at the back', tone: 'gold', fs: 10 },
        { x: 160, y: 250, text: 'Fullest part of the bust', lead: [[160, 238], [160, 168]] },
      ],
    },
    underbust: {
      crop: '55 110 210 165',
      tapes: [{ kind: 'circ', points: [[102, 184], [218, 184]] }],
      faded: [{ kind: 'circ', points: [[96, 160], [224, 160]], text: { x: 55, y: 152, anchor: 'start', label: 'bust' } }],
      chips: [
        { x: 185, y: 225, text: '5–10 cm below the bust', tone: 'gold', fs: 10.5 },
        { x: 160, y: 252, text: 'Where a bra band sits', fs: 10.5 },
      ],
    },
    waist: {
      crop: '60 150 200 200',
      tapes: [{ kind: 'circ', points: [[116, 210], [204, 210]] }],
      faded: [{ kind: 'circ', points: [[98, 270], [222, 270]] }],
      note: { x: 160, y: 240, text: 'bend sideways to find it', anchor: 'middle' },
      chips: [
        { x: 160, y: 180, text: 'The crease is your waist' },
        { x: 160, y: 322, text: 'Hips — not here!', tone: 'grey', fs: 10.5 },
      ],
    },
    hips: {
      crop: '55 200 210 210',
      tapes: [{ kind: 'circ', points: [[98, 270], [222, 270]] }],
      note: { x: 160, y: 238, text: '≈ 20 cm below the waist', anchor: 'middle' },
      chips: [{ x: 160, y: 350, text: 'Fullest part, feet together', lead: [[160, 338], [160, 278]] }],
    },
    shoulder: { crop: '', back: true, tapes: [] },
    sleeve: {
      crop: '55 100 160 290',
      tapes: [{ kind: 'linear', points: [[114, 120], [96, 206], [101, 296]] }],
      chips: [
        { x: 125, y: 138, text: 'From the shoulder bone', fs: 10, lead: [[125, 148], [115, 124]] },
        { x: 120, y: 262, text: 'Slightly bent elbow', tone: 'gold', fs: 10 },
        { x: 132, y: 352, text: 'down to the wrist bone', fs: 10 },
      ],
    },
    length: {
      crop: '70 60 180 310',
      tapes: [{ kind: 'linear', points: [[160, 100], [160, 330]] }],
      hem: { x1: 146, x2: 174, y: 330 },
      chips: [
        { x: 160, y: 80, text: 'straight down the front', tone: 'gold', fs: 10 },
        { x: 160, y: 150, text: 'From the hollow of the neck', fs: 10.5 },
        { x: 160, y: 355, text: 'to where the hem falls', tone: 'grey', fs: 10.5 },
      ],
    },
  },

  children: {
    height: {
      crop: '30 175 260 360',
      wall: { x: 75, y1: 185, y2: 505, tick: { x1: 75, x2: 212, y: 199.6 } },
      tapes: [{ kind: 'linear', points: [[97, 206], [97, 490]] }],
      cont: { from: [97, 490], to: [97, 508] },
      chips: [
        { x: 170, y: 232, text: 'Mark the top of the head', tone: 'gold', lead: [[170, 222], [150, 201]] },
        { x: 170, y: 420, text: 'No shoes, heels to the wall' },
      ],
    },
    chest: {
      crop: '35 235 250 165',
      tapes: [{ kind: 'circ', points: [[119.4, 317.2], [200.6, 317.2]] }],
      chips: [{ x: 160, y: 378, text: 'Under the arms, fullest part', lead: [[160, 366], [160, 322]] }],
    },
    waist: {
      crop: '35 255 250 155',
      tapes: [{ kind: 'circ', points: [[123.2, 355], [196.8, 355]] }],
      note: { x: 160, y: 398, text: 'one finger of ease', anchor: 'middle' },
      chips: [{ x: 160, y: 285, text: 'The side-bend crease', lead: [[160, 295], [160, 350]] }],
    },
    hips: {
      crop: '35 300 250 160',
      tapes: [{ kind: 'circ', points: [[122.6, 385.8], [197.4, 385.8]] }],
      chips: [{ x: 160, y: 440, text: 'Fullest part, feet together', lead: [[160, 428], [160, 391]] }],
    },
    sleeve: {
      crop: '45 245 230 150',
      tapes: [{ kind: 'linear', points: [[133.4, 294.8], [115.9, 335.4], [120.1, 366.2]] }],
      chips: [
        { x: 160, y: 282, text: 'arm slightly bent', tone: 'gold', fs: 10, lead: [[160, 292], [134, 296]] },
        { x: 160, y: 388, text: 'Shoulder bone to wrist bone', fs: 10.5 },
      ],
    },
    inseam: {
      crop: '45 380 230 240',
      tapes: [{ kind: 'linear', points: [[128.4, 436.2], [140.8, 584.6]] }],
      chips: [
        { x: 110, y: 470, text: 'ask for a growth hem', tone: 'gold', fs: 10 },
        { x: 185, y: 606, text: 'Crotch to the ankle bone', fs: 10.5 },
      ],
    },
  },
}

// ---------------------------------------------------------------------------
// component
// ---------------------------------------------------------------------------

interface MeasurementDiagramProps {
  profile: MeasurementCategory
  id: string
  className?: string
}

export function MeasurementDiagram({ profile, id, className }: MeasurementDiagramProps) {
  const spec = DIAGRAMS[profile]?.[id]
  if (!spec) return null
  if (spec.back) return <BackViewFigure profile={profile} />

  const [vx, vy, vw, vh] = spec.crop.split(' ').map(Number)
  const label = MEASUREMENTS[profile].find((m) => m.id === id)?.label ?? id
  void vx
  void vy

  return (
    <svg
      viewBox={spec.crop}
      className={cn('h-auto w-full', className)}
      style={{ maxHeight: 250, aspectRatio: `${vw} / ${vh}` }}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`${label} close-up diagram`}
    >
      {/* the same mannequin, cropped to the relevant region */}
      <FigureBodyGroup profile={profile} />

      {/* faded "don't measure here" references */}
      {spec.faded?.map((f, i) => (
        <FadedRef key={i} spec={f} />
      ))}

      {/* wall + flat pencil mark (child height) */}
      {spec.wall && (
        <g>
          <line x1={spec.wall.x} y1={spec.wall.y1} x2={spec.wall.x} y2={spec.wall.y2} stroke="#3F5F88" strokeWidth={3} strokeLinecap="round" />
          <line x1={spec.wall.tick.x1} y1={spec.wall.tick.y} x2={spec.wall.tick.x2} y2={spec.wall.tick.y} stroke="#D4AF37" strokeWidth={3} strokeLinecap="round" />
        </g>
      )}

      {/* the gold tape(s) */}
      {spec.tapes.map((t, i) => (
        <TapePath key={i} tape={t} animated={i === 0} />
      ))}

      {/* hem tick (length measurements) */}
      {spec.hem && (
        <line x1={spec.hem.x1} y1={spec.hem.y} x2={spec.hem.x2} y2={spec.hem.y} stroke="#D4AF37" strokeWidth={2.4} strokeLinecap="round" />
      )}

      {/* dashed continuation (e.g. "…to the floor") */}
      {spec.cont && (
        <g>
          <line x1={spec.cont.from[0]} y1={spec.cont.from[1]} x2={spec.cont.to[0]} y2={spec.cont.to[1]} stroke="#8FA3BC" strokeWidth={1.6} strokeDasharray="5 4" strokeLinecap="round" />
          <path d={arrowhead(spec.cont.to[0], spec.cont.to[1], 0, 1, 6, 3)} fill="#8FA3BC" />
        </g>
      )}

      {/* gold note text */}
      {spec.note && (
        <text
          x={spec.note.x}
          y={spec.note.y}
          textAnchor={spec.note.anchor ?? 'middle'}
          className="font-sans text-[10.5px] font-semibold"
          fill="#947621"
        >
          {spec.note.text}
        </text>
      )}

      {/* callout chips */}
      {spec.chips?.map((c, i) => (
        <Chip key={i} chip={c} />
      ))}
    </svg>
  )
}
