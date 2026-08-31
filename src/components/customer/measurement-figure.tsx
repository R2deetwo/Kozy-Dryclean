'use client'

// =============================================================================
// MeasurementFigure — an interactive tailoring croquis (line-art figure) with
// highlightable measurement lines, in Kozy brand style.
// =============================================================================
// Client directive (Phase 18): "a full guide and tutorial... cleverly,
// interactively done that sort of allows men and women to be able to measure
// themselves, or their children... nice diagrams to help with understanding
// from where to where you measure a particular part."
//
// Interaction model: the parent owns `activeId` (hover/click from the
// measurement list). Each measurement renders as a technical dashed line
// with end ticks; the active one animates in gold. Clicking a line selects
// the measurement too — the diagram and the list stay in sync.
//
// v2/v3 anatomy (Phase 26): the figures are rebuilt from anatomical landmark
// rings instead of hand-written blocky paths. Left halves are authored in
// head-unit canons and mirrored for exact symmetry; Catmull-Rom smoothing
// turns the rings into organic curves. Duplicated landmarks create crisp
// corners at the knee/elbow/ankle, so limbs taper like real anatomy
// (thigh → knee pinch → calf bulge → narrow ankle) instead of "sausage
// tubes". The crotch is a soft rounded U, the trapezius slopes smoothly
// from the neck, and the child follows a true ~5.5-head canon.
//   men      ~8.0 heads — shoulders ≈ 2.1 head-widths, V-taper torso
//   women    ~8.3 heads (fashion elongation) — hips ≥ shoulders, gentle
//             hourglass, long leg line
//   children ~5.5 heads — big round head, short limbs, round belly with no
//             waist pinch, elbows at the natural waistline
// =============================================================================

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { MEASUREMENTS, type MeasurementCategory } from '@/lib/measurements'

export interface FigureMeasureLine {
  id: string
  /** polyline points (x, y) in the 320x640 viewBox */
  points: [number, number][]
  label: { x: number; y: number; anchor: 'start' | 'middle' | 'end' }
}

type Pt = [number, number]

// ---------------------------------------------------------------------------
// Geometry helpers — Catmull-Rom → cubic bezier
// ---------------------------------------------------------------------------

const CX = 160 // figure centerline in the 320-wide viewBox

function r(n: number): number {
  return Math.round(n * 10) / 10
}

/** Smooth closed path through all points (wraps last→first). */
function smoothClosed(pts: Pt[]): string {
  const n = pts.length
  let d = `M ${r(pts[0][0])} ${r(pts[0][1])}`
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]
    const p1 = pts[i]
    const p2 = pts[(i + 1) % n]
    const p3 = pts[(i + 2) % n]
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C ${r(c1x)} ${r(c1y)}, ${r(c2x)} ${r(c2y)}, ${r(p2[0])} ${r(p2[1])}`
  }
  return d + ' Z'
}

/** Mirror points across the figure centerline (right = 320 - left). */
function mirrorPts(pts: Pt[]): Pt[] {
  return pts.map(([x, y]) => [2 * CX - x, y] as Pt)
}

/**
 * Build a full symmetric ring from an authored LEFT half. The half must run
 * from a centerline point (e.g. neck base) around to the NEXT centerline
 * point (e.g. crotch or chin); the mirrored half is appended in reverse.
 */
function ringFromLeftHalf(left: Pt[]): Pt[] {
  const mirrored = mirrorPts(left).reverse()
  return [...left, ...mirrored.slice(1, -1)]
}

// ---------------------------------------------------------------------------
// Figure geometry — anatomically-proportioned croquis, 320x640 viewBox
// ---------------------------------------------------------------------------

const MALE_FIGURE = (() => {
  // head: 50w x 70h, egg skull tapering to a real chin (~8 heads total)
  const headLeft: Pt[] = [
    [160, 22], [146, 25], [138, 32], [136, 46], [136, 58],
    [139, 71], [145, 83], [152, 90], [160, 92],
  ]
  // torso + both legs, one closed silhouette (inner leg lines included).
  // Smooth trapezius into the shoulder; V-taper chest → waist; thigh →
  // knee pinch → calf bulge → narrow ankle; soft rounded crotch.
  const torsoLeft: Pt[] = [
    [150, 112],                                            // neck base
    [142, 114], [131, 117], [119, 121],                    // trapezius slope
    [108, 126],                                            // shoulder point
    [105, 134], [108, 148],                                // deltoid → armpit
    [107, 158], [106, 172], [108, 186],                    // chest, ribs
    [111, 196], [112, 208],                                // natural waist
    [114, 228], [114, 244],                                // iliac
    [113, 258], [112, 272],                                // seat (fullest)
    [114, 290], [117, 312], [118, 328],                    // outer thigh
    [119, 368], [121, 405],                                // thigh taper
    [126, 430], [126, 430],                                // knee (corner)
    [124, 448], [123, 466],                                // below knee
    [121, 490], [123, 516], [126, 542],                    // calf bulge
    [129, 568], [129, 568],                                // ankle (corner)
    [138, 576], [147, 568], [147, 568],                    // leg end (foot covers)
    [149, 538], [150, 508], [149, 478],                    // inner calf
    [148, 452], [148, 436], [148, 436],                    // inner knee (corner)
    [149, 404], [151, 366], [152, 332],                    // inner thigh
    [156, 327], [160, 324],                                // soft crotch U
  ]
  // arm hanging in relaxed A-pose: deltoid → bicep → elbow (waist level) →
  // tapering forearm → wrist → simple hand wedge
  const armLeft: Pt[] = [
    [106, 120],                                            // deltoid top
    [97, 128], [89, 144], [86, 163],                       // bicep outer
    [86, 183], [88, 210], [88, 210],                       // elbow (corner)
    [90, 234], [91, 264], [91, 292],                       // forearm outer
    [93, 306],                                             // wrist
    [96, 318], [100, 328], [101, 335],                     // hand outer
    [98, 340],                                             // fingertip
    [95, 334], [96, 322], [98, 308],                       // hand inner
    [100, 278], [102, 246], [103, 214], [103, 214],        // inner elbow (corner)
    [103, 190], [104, 166], [105, 148],                    // inner bicep → armpit
    [104, 132],
  ]
  // foot in slight outward stance: heel, arch, instep dip, toe
  const footLeft: Pt[] = [
    [127, 565], [120, 569], [114, 573], [111, 579],
    [111, 583], [114, 585],
    [120, 586], [128, 584], [135, 580],
    [140, 578], [145, 574], [147, 568],
    [148, 566], [145, 562], [139, 561], [133, 562], [129, 564],
  ]
  return {
    head: smoothClosed(ringFromLeftHalf(headLeft)),
    neck: 'M 152 87 L 150 110 M 168 87 L 170 110',
    body: smoothClosed(ringFromLeftHalf(torsoLeft)),
    armL: smoothClosed(armLeft),
    armR: smoothClosed(mirrorPts(armLeft)),
    feet: smoothClosed(footLeft) + ' ' + smoothClosed(mirrorPts(footLeft)),
    shadow: { cx: CX, cy: 596, rx: 52, ry: 7 },
  }
})()

const FEMALE_FIGURE = (() => {
  // head: 44w x 68h, narrower jaw
  const headLeft: Pt[] = [
    [160, 24], [148, 27], [139, 34], [137, 46], [137, 58],
    [140, 71], [146, 83], [153, 90], [160, 92],
  ]
  // hourglass with a GENTLE waist (shoulders ±44, bust ±42, waist ±27,
  // hips ±47 — hips slightly wider than shoulders, no corset pinch)
  const torsoLeft: Pt[] = [
    [150, 112],                                            // neck base
    [142, 114], [132, 117], [122, 121],                    // trapezius slope
    [116, 126],                                            // shoulder point
    [114, 134], [118, 148],                                // deltoid → armpit
    [118, 158],                                            // bust side (fullest)
    [121, 170], [124, 184],                                // underbust
    [130, 196], [133, 208],                                // waist (soft pinch)
    [131, 222], [126, 236],                                // high hip
    [119, 250], [114, 262], [113, 270],                    // hip (fullest)
    [115, 288], [117, 306], [118, 322],                    // outer thigh
    [118, 360], [120, 395],                                // thigh taper
    [126, 440], [126, 440],                                // knee (corner)
    [124, 460], [123, 484],                                // below knee
    [123, 508], [125, 534], [127, 558],                    // calf bulge
    [129, 570], [129, 570],                                // ankle (corner)
    [138, 577], [147, 570], [147, 570],                    // leg end
    [149, 542], [150, 512], [149, 484],                    // inner calf
    [148, 462], [148, 446], [148, 446],                    // inner knee (corner)
    [149, 412], [151, 374], [152, 340],                    // inner thigh
    [156, 334], [160, 332],                                // soft crotch U
  ]
  // slimmer arm with a graceful outward line; wrist at hip level
  const armLeft: Pt[] = [
    [114, 121],                                            // deltoid top
    [104, 128], [97, 143], [95, 162],                      // bicep outer
    [95, 182], [97, 206], [97, 206],                       // elbow (corner)
    [99, 228], [101, 258], [101, 286],                     // forearm outer
    [103, 300],                                            // wrist
    [106, 311], [109, 320], [109, 328],                    // hand outer
    [106, 332],                                            // fingertip
    [103, 327], [104, 316], [105, 305],                    // hand inner
    [106, 276], [107, 244], [108, 212], [108, 212],        // inner elbow (corner)
    [108, 190], [109, 168], [110, 150],                    // inner bicep → armpit
    [109, 136],
  ]
  const footLeft: Pt[] = [
    [130, 567], [124, 571], [118, 575], [115, 581],
    [115, 585], [118, 587],
    [124, 588], [131, 586], [137, 582],
    [142, 580], [146, 576], [148, 570],
    [149, 568], [146, 564], [140, 563], [134, 564], [131, 566],
  ]
  return {
    head: smoothClosed(ringFromLeftHalf(headLeft)),
    neck: 'M 153 88 L 150 110 M 167 88 L 170 110',
    body: smoothClosed(ringFromLeftHalf(torsoLeft)),
    armL: smoothClosed(armLeft),
    armR: smoothClosed(mirrorPts(armLeft)),
    feet: smoothClosed(footLeft) + ' ' + smoothClosed(mirrorPts(footLeft)),
    shadow: { cx: CX, cy: 594, rx: 48, ry: 6.5 },
  }
})()

// The child is authored full-size in its own ~5.5-head canon, then rendered
// at 70% on the SAME ground line — a child IS smaller than the adults, and
// the size difference is the strongest "this is a child" cue of all.
const CHILD_S = 0.7
const CHILD_GROUND = 600

function scPt(x: number, y: number): Pt {
  return [
    Math.round((CX + (x - CX) * CHILD_S) * 10) / 10,
    Math.round((CHILD_GROUND + (y - CHILD_GROUND) * CHILD_S) * 10) / 10,
  ]
}

function scPts(pts: Pt[]): Pt[] {
  return pts.map(([x, y]) => scPt(x, y))
}

function scLabel(x: number, y: number, anchor: 'start' | 'middle' | 'end') {
  const p = scPt(x, y)
  return { x: p[0], y: p[1], anchor }
}

const CHILD_FIGURE = (() => {
  // child canon: ~5.6 heads — big ROUND head (100w x 101h) clearly wider
  // than the shoulders, soft jaw; chunky toddler proportions, arms held
  // close to the body, cylindrical legs without adult calf musculature
  const headLeft: Pt[] = [
    [160, 28], [144, 31], [124, 41], [112, 57], [110, 76],
    [113, 94], [123, 108], [136, 119], [149, 126], [160, 129],
  ]
  // short torso with a PROMINENT round belly (±48 vs chest ±31), no waist
  // pinch, narrow sloped shoulders, chunky cylindrical legs, crotch at
  // ~57% of height with a DEEP soft U (survives the 70% render scale)
  const torsoLeft: Pt[] = [
    [148, 145],                                            // neck base
    [137, 148], [127, 154], [121, 162],                    // sloped narrow shoulders (±39)
    [125, 170], [125, 182],                                // deltoid → armpit
    [129, 196],                                            // chest (±31)
    [126, 212], [124, 228],                                // straight sides (no waist)
    [114, 244], [112, 262], [115, 278],                    // ROUND belly (±48)
    [118, 294],                                            // hip (±42)
    [119, 314], [114, 342], [113, 378], [116, 412],        // chunky outer thigh (±47)
    [119, 448],                                            // knee (smooth — no adult corner)
    [117, 470], [116, 495],                                // cylindrical lower leg
    [118, 520], [122, 548],                                // gentle taper
    [125, 572], [125, 572],                                // ankle (corner)
    [135, 584], [143, 578], [143, 578],                    // leg end
    [144, 548], [146, 524], [147, 500],                    // inner lower leg (smooth)
    [147, 476], [147, 450],                                // inner knee (smooth)
    [148, 412], [150, 382],                                // inner thigh
    [152, 354], [156, 356], [160, 362],                    // DEEP soft crotch U
  ]
  // short chubby arm held close to the body; elbow just above the natural
  // waist (y≈222), fingertips at upper thigh (y≈296)
  const armLeft: Pt[] = [
    [122, 164],                                            // deltoid top
    [108, 170], [99, 186], [97, 204],                      // chunky bicep outer
    [97, 222], [97, 222],                                  // elbow (corner)
    [99, 240], [101, 256],                                 // forearm outer
    [103, 266],                                            // wrist
    [107, 274], [109, 282], [110, 290],                    // hand outer
    [106, 296],                                            // fingertip
    [103, 289], [104, 279], [104, 271],                    // hand inner
    [105, 266],                                            // inner wrist
    [107, 248], [108, 230],                                // inner forearm
    [109, 222], [109, 222],                                // inner elbow (corner)
    [112, 202], [115, 186], [117, 172],                    // inner bicep
  ]
  const footLeft: Pt[] = [
    [131, 572], [121, 578], [113, 588], [115, 595],
    [123, 597], [133, 594],
    [142, 589], [148, 582], [149, 577],
    [145, 573], [139, 571],
  ]
  const seg = (a: Pt, b: Pt): string => {
    const p = scPt(a[0], a[1])
    const q = scPt(b[0], b[1])
    return `M ${p[0]} ${p[1]} L ${q[0]} ${q[1]}`
  }
  return {
    head: smoothClosed(ringFromLeftHalf(scPts(headLeft))),
    neck: seg([147, 125], [145, 143]) + ' ' + seg([173, 125], [175, 143]),
    body: smoothClosed(ringFromLeftHalf(scPts(torsoLeft))),
    armL: smoothClosed(scPts(armLeft)),
    armR: smoothClosed(mirrorPts(scPts(armLeft))),
    feet: smoothClosed(scPts(footLeft)) + ' ' + smoothClosed(mirrorPts(scPts(footLeft))),
    shadow: { cx: CX, cy: 604, rx: 33, ry: 5 },
  }
})()

// Child measurement lines — authored full-size, scaled to the child's 70%
// render (labels keep their font size, only positions scale)
const CHILD_LINES: FigureMeasureLine[] = [
  { id: 'height', points: scPts([[70, 28], [70, 600]]), label: scLabel(70, 18, 'middle') },
  { id: 'chest', points: scPts([[102, 196], [218, 196]]), label: scLabel(238, 194, 'start') },
  { id: 'waist', points: scPts([[104, 250], [216, 250]]), label: scLabel(236, 248, 'start') },
  { id: 'hips', points: scPts([[98, 294], [222, 294]]), label: scLabel(236, 292, 'start') },
  { id: 'sleeve', points: scPts([[122, 164], [97, 222], [103, 266]]), label: scLabel(128, 150, 'end') },
  { id: 'inseam', points: scPts([[152, 366], [144, 578]]), label: scLabel(160, 616, 'middle') },
]

const FIGURES: Record<MeasurementCategory, typeof MALE_FIGURE> = {
  men: MALE_FIGURE,
  women: FEMALE_FIGURE,
  children: CHILD_FIGURE,
}

// measurement lines per profile — retuned to sit exactly on the landmarks
// above (chest at the fullest line, waist at the natural waist, seat at the
// hip fullest, sleeve along shoulder→elbow→wrist). Labels live in the clear
// negative space either side of the arms/legs.
const LINES: Record<MeasurementCategory, FigureMeasureLine[]> = {
  men: [
    { id: 'neck', points: [[132, 100], [188, 100]], label: { x: 124, y: 104, anchor: 'end' } },
    { id: 'chest', points: [[94, 160], [226, 160]], label: { x: 82, y: 158, anchor: 'end' } },
    { id: 'waist', points: [[100, 208], [220, 208]], label: { x: 82, y: 208, anchor: 'end' } },
    { id: 'seat', points: [[100, 272], [220, 272]], label: { x: 86, y: 270, anchor: 'end' } },
    { id: 'shoulder', points: [[102, 120], [218, 120]], label: { x: 226, y: 112, anchor: 'start' } },
    { id: 'sleeve', points: [[106, 120], [88, 212], [91, 296]], label: { x: 84, y: 244, anchor: 'end' } },
    { id: 'inseam', points: [[152, 328], [148, 572]], label: { x: 118, y: 470, anchor: 'end' } },
    { id: 'shirt', points: [[160, 96], [160, 328]], label: { x: 170, y: 190, anchor: 'start' } },
  ],
  women: [
    { id: 'bust', points: [[96, 160], [224, 160]], label: { x: 90, y: 148, anchor: 'end' } },
    { id: 'underbust', points: [[102, 184], [218, 184]], label: { x: 90, y: 196, anchor: 'end' } },
    { id: 'waist', points: [[116, 210], [204, 210]], label: { x: 228, y: 226, anchor: 'start' } },
    { id: 'hips', points: [[98, 270], [222, 270]], label: { x: 230, y: 262, anchor: 'start' } },
    { id: 'shoulder', points: [[106, 120], [214, 120]], label: { x: 222, y: 110, anchor: 'start' } },
    { id: 'sleeve', points: [[114, 120], [96, 206], [101, 296]], label: { x: 70, y: 232, anchor: 'end' } },
    { id: 'length', points: [[160, 96], [160, 560]], label: { x: 204, y: 552, anchor: 'start' } },
  ],
  children: CHILD_LINES,
}

// display names for figure-only lines not present in the measurement list;
// every other label is pulled from MEASUREMENTS so the diagram and the
// measurement cards always use identical terminology
const LINE_LABELS: Record<string, string> = {
  shirt: 'Shirt length',
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function pathFromPoints(points: Pt[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ')
}

function tick(
  point: Pt,
  towards: Pt,
  len = 9,
): { x1: number; y1: number; x2: number; y2: number } {
  const dx = towards[0] - point[0]
  const dy = towards[1] - point[1]
  const mag = Math.hypot(dx, dy) || 1
  // perpendicular unit vector
  const px = -dy / mag
  const py = dx / mag
  return {
    x1: point[0] + px * len / 2,
    y1: point[1] + py * len / 2,
    x2: point[0] - px * len / 2,
    y2: point[1] - py * len / 2,
  }
}

// ---------------------------------------------------------------------------
// component
// ---------------------------------------------------------------------------

interface MeasurementFigureProps {
  profile: MeasurementCategory
  activeId: string | null
  onSelect: (id: string) => void
  className?: string
}

export function MeasurementFigure({ profile, activeId, onSelect, className }: MeasurementFigureProps) {
  const fig = FIGURES[profile]
  const lines = LINES[profile]

  return (
    <svg
      viewBox="0 0 320 640"
      className={cn('h-full w-full select-none', className)}
      role="img"
      aria-label={`${profile} measurement diagram`}
    >
      {/* --- ground shadow (draws the figure into space) --- */}
      <ellipse
        cx={fig.shadow.cx}
        cy={fig.shadow.cy}
        rx={fig.shadow.rx}
        ry={fig.shadow.ry}
        fill="#E9EEF6"
      />

      {/* --- figure (anatomical croquis) --- */}
      <path
        d={fig.body}
        className="fill-white"
        strokeWidth={2}
        strokeLinejoin="round"
        style={{ stroke: '#9FB1C7' }}
      />
      <path
        d={fig.armL}
        className="fill-white"
        strokeWidth={2}
        strokeLinejoin="round"
        style={{ stroke: '#9FB1C7' }}
      />
      <path
        d={fig.armR}
        className="fill-white"
        strokeWidth={2}
        strokeLinejoin="round"
        style={{ stroke: '#9FB1C7' }}
      />
      <path d={fig.feet} className="fill-white" strokeWidth={2} strokeLinejoin="round" style={{ stroke: '#9FB1C7' }} />
      <path d={fig.neck} fill="none" style={{ stroke: '#9FB1C7' }} strokeWidth={2} strokeLinecap="round" />
      <path
        d={fig.head}
        className="fill-white"
        strokeWidth={2}
        strokeLinejoin="round"
        style={{ stroke: '#9FB1C7' }}
      />

      {/* --- measurement lines --- */}
      {lines.map((line) => {
        const active = line.id === activeId
        const d = pathFromPoints(line.points)
        const first = line.points[0]
        const last = line.points[line.points.length - 1]
        const t1 = tick(first, line.points[1] ?? last)
        const t2 = tick(last, line.points[line.points.length - 2] ?? first)
        const labelText =
          LINE_LABELS[line.id] ??
          MEASUREMENTS[profile].find((m) => m.id === line.id)?.label ??
          line.id.charAt(0).toUpperCase() + line.id.slice(1)

        return (
          <g key={line.id} className="cursor-pointer" onClick={() => onSelect(line.id)}>
            {/* fat invisible hit area */}
            <path d={d} fill="none" stroke="transparent" strokeWidth={18} pointerEvents="stroke" />

            {/* base line */}
            <path
              d={d}
              fill="none"
              strokeLinecap="round"
              strokeWidth={active ? 2.5 : 1.5}
              strokeDasharray={active ? undefined : '5 4'}
              style={{
                stroke: active ? '#B8962B' : '#C8D2DF',
                transition: 'stroke 200ms, stroke-width 200ms',
              }}
            />

            {/* end ticks */}
            {[t1, t2].map((t, i) => (
              <line
                key={i}
                x1={t.x1}
                y1={t.y1}
                x2={t.x2}
                y2={t.y2}
                strokeLinecap="round"
                strokeWidth={active ? 2.5 : 1.5}
                style={{
                  stroke: active ? '#B8962B' : '#C8D2DF',
                  transition: 'stroke 200ms',
                }}
              />
            ))}

            {/* end dots when active */}
            {active && (
              <>
                {[first, last].map((p, i) => (
                  <motion.circle
                    key={i}
                    cx={p[0]}
                    cy={p[1]}
                    r={4.5}
                    fill="#D4AF37"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: i * 0.12, type: 'spring', stiffness: 300, damping: 15 }}
                  />
                ))}
                {/* animated draw-in */}
                <motion.path
                  d={d}
                  fill="none"
                  stroke="#D4AF37"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0.9 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.55, ease: 'easeOut' }}
                />
              </>
            )}

            {/* label */}
            <text
              x={line.label.x}
              y={line.label.y}
              textAnchor={line.label.anchor}
              className={cn(
                'font-sans',
                active ? 'fill-navy-500 text-[12px] font-bold' : 'fill-navy-300 text-[10.5px] font-medium',
              )}
              style={{ transition: 'fill 200ms' }}
            >
              {labelText}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
