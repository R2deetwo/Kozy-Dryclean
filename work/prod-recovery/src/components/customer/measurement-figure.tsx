'use client'

// =============================================================================
// MeasurementFigure — an interactive tailoring croquis with highlightable
// measurement tapes, in Kozy brand style.
// =============================================================================
// Client directive (Phase 18): "a full guide and tutorial... cleverly,
// interactively done that sort of allows men and women to be able to measure
// themselves, or their children... nice diagrams to help with understanding
// from where to where you measure a particular part."
//
// Interaction model: the parent owns `activeId` (hover/click from the
// measurement list). Clicking a tape selects the measurement too — the
// diagram and the list stay in sync.
//
// v3 rendering (Phase 27, client directive: "the mannequins still look like
// stick figures... much better guides to be emulated out there"): the figures
// are now drawn like a tailor's mannequin, following the conventions of
// professional bespoke measurement guides —
//   • the body is a FILLED silhouette in warm linen/sand tones with a
//     per-part light gradient (lit centre, shaded edges) so limbs read as
//     volumes, not stick outlines; subtle clavicle / centre-front / bust /
//     knee detail strokes give human cues;
//   • circumference measurements (neck, chest, waist, hips...) draw as a
//     real tape: a solid gold front arc plus a dashed "hidden" back line
//     slightly above it — the classic drafting convention for "this wraps
//     AROUND the body" — with a double-headed arrow showing the span;
//   • point-to-point measurements (shoulder, sleeve, inseam, length...) draw
//     with arrowheads at both ends and gold dots on the anatomical landmarks;
//   • labels are numbered to match the numbered measurement cards.
//
// Anatomy (Phase 26): landmark-ring figures, Catmull-Rom smoothed, exact
// mirror symmetry. men ~8.0 heads, women ~8.3 heads, children ~5.6 heads
// rendered at 70% scale on the same ground line.
// =============================================================================

import { useId } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { MEASUREMENTS, type MeasurementCategory } from '@/lib/measurements'

export type Pt = [number, number]

export interface FigureMeasureLine {
  id: string
  /**
   * 'circ'  — circumference: the tape wraps the body (solid front arc +
   *            dashed back line + double arrow across the span).
   * 'linear' — point-to-point: straight/dog-leg path with arrowheads and
   *            landmark dots at both ends.
   */
  kind: 'circ' | 'linear'
  /** for 'circ': [leftEdge, rightEdge] at the tape height; for 'linear': the path */
  points: Pt[]
  label: { x: number; y: number; anchor: 'start' | 'middle' | 'end' }
}

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
    neck: 'M 152 87 L 168 87 L 170 110 L 150 110 Z',
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
    neck: 'M 153 88 L 167 88 L 170 110 L 150 110 Z',
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
    [125, 170], [123, 182],                                // deltoid → armpit
    [125, 196],                                            // chest (±35)
    [122, 212], [120, 228],                                // straight sides (no waist)
    [114, 244], [112, 262], [115, 278],                    // ROUND belly (±48)
    [115, 294],                                            // hip (±45)
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
  const neck = scPts([[147, 125], [173, 125], [175, 143], [145, 143]])
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`)
    .join(' ') + ' Z'
  return {
    head: smoothClosed(ringFromLeftHalf(scPts(headLeft))),
    neck,
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
  { id: 'height', kind: 'linear', points: scPts([[70, 28], [70, 600]]), label: scLabel(70, 18, 'middle') },
  { id: 'chest', kind: 'circ', points: scPts([[102, 196], [218, 196]]), label: scLabel(238, 194, 'start') },
  { id: 'waist', kind: 'circ', points: scPts([[104, 250], [216, 250]]), label: scLabel(236, 248, 'start') },
  { id: 'hips', kind: 'circ', points: scPts([[98, 294], [222, 294]]), label: scLabel(236, 292, 'start') },
  { id: 'sleeve', kind: 'linear', points: scPts([[122, 164], [97, 222], [103, 266]]), label: scLabel(128, 150, 'end') },
  { id: 'inseam', kind: 'linear', points: scPts([[152, 366], [144, 578]]), label: scLabel(160, 616, 'middle') },
]

export const FIGURES: Record<MeasurementCategory, typeof MALE_FIGURE> = {
  men: MALE_FIGURE,
  women: FEMALE_FIGURE,
  children: CHILD_FIGURE,
}

// measurement tapes per profile — retuned to sit exactly on the landmarks
// above (chest at the fullest line, waist at the natural waist, seat at the
// hip fullest, sleeve along shoulder→elbow→wrist). Labels live in the clear
// negative space either side of the arms/legs.
export const LINES: Record<MeasurementCategory, FigureMeasureLine[]> = {
  men: [
    { id: 'neck', kind: 'circ', points: [[132, 100], [188, 100]], label: { x: 124, y: 104, anchor: 'end' } },
    { id: 'chest', kind: 'circ', points: [[94, 160], [226, 160]], label: { x: 84, y: 158, anchor: 'end' } },
    { id: 'waist', kind: 'circ', points: [[100, 208], [220, 208]], label: { x: 88, y: 208, anchor: 'end' } },
    { id: 'seat', kind: 'circ', points: [[100, 272], [220, 272]], label: { x: 86, y: 270, anchor: 'end' } },
    { id: 'shoulder', kind: 'linear', points: [[102, 120], [218, 120]], label: { x: 226, y: 112, anchor: 'start' } },
    { id: 'sleeve', kind: 'linear', points: [[106, 120], [88, 212], [91, 296]], label: { x: 88, y: 244, anchor: 'end' } },
    { id: 'inseam', kind: 'linear', points: [[152, 328], [148, 572]], label: { x: 118, y: 470, anchor: 'end' } },
    { id: 'shirt', kind: 'linear', points: [[160, 96], [160, 328]], label: { x: 168, y: 184, anchor: 'start' } },
  ],
  women: [
    { id: 'bust', kind: 'circ', points: [[96, 160], [224, 160]], label: { x: 92, y: 148, anchor: 'end' } },
    { id: 'underbust', kind: 'circ', points: [[102, 184], [218, 184]], label: { x: 92, y: 196, anchor: 'end' } },
    { id: 'waist', kind: 'circ', points: [[116, 210], [204, 210]], label: { x: 228, y: 226, anchor: 'start' } },
    { id: 'hips', kind: 'circ', points: [[98, 270], [222, 270]], label: { x: 230, y: 262, anchor: 'start' } },
    { id: 'shoulder', kind: 'linear', points: [[106, 120], [214, 120]], label: { x: 222, y: 110, anchor: 'start' } },
    { id: 'sleeve', kind: 'linear', points: [[114, 120], [96, 206], [101, 296]], label: { x: 88, y: 232, anchor: 'end' } },
    { id: 'length', kind: 'linear', points: [[160, 96], [160, 560]], label: { x: 204, y: 552, anchor: 'start' } },
  ],
  children: CHILD_LINES,
}

// display names for figure-only lines not present in the measurement list;
// every other label is pulled from MEASUREMENTS so the diagram and the
// measurement cards always use identical terminology
export const LINE_LABELS: Record<string, string> = {
  shirt: 'Shirt length',
}

// subtle anatomy detail strokes — the "this is a body, not a stick" cues
const DETAIL_SOLID: Record<MeasurementCategory, string[]> = {
  men: [
    'M 150 117 Q 137 114 123 121',      // clavicle, left
    'M 170 117 Q 183 114 197 121',      // clavicle, right
    'M 121 433 Q 127 438 124 445',      // knee crease, left
    'M 199 433 Q 193 438 196 445',      // knee crease, right
  ],
  women: [
    'M 151 118 Q 139 115 127 121',      // clavicle, left
    'M 169 118 Q 181 115 193 121',      // clavicle, right
    'M 138 153 Q 147 167 155 155',      // bust hint, left
    'M 182 153 Q 173 167 165 155',      // bust hint, right
    'M 121 443 Q 127 448 124 455',      // knee crease, left
    'M 199 443 Q 193 448 196 455',      // knee crease, right
  ],
  children: [],
}

const DETAIL_DASHED: Record<MeasurementCategory, string[]> = {
  men: ['M 160 124 L 160 322'],          // centre front
  women: ['M 160 126 L 160 330'],        // centre front
  children: [],
}

// ---------------------------------------------------------------------------
// Tape geometry helpers
// ---------------------------------------------------------------------------

/** Front (solid) and back (dashed "hidden") arcs for a circumference tape. */
export function tapeArcs(line: FigureMeasureLine, backOffset?: number): { front: string; back: string } {
  const [L, Rr] = line.points
  const y = L[1]
  const width = Rr[0] - L[0]
  const bulge = Math.min(9, Math.max(3, width * 0.05))
  const cx = (L[0] + Rr[0]) / 2
  const off = backOffset ?? (width < 80 ? 4.5 : 6.5)
  const front = `M ${r(L[0])} ${r(y)} Q ${r(cx)} ${r(y + bulge)} ${r(Rr[0])} ${r(y)}`
  const back = `M ${r(L[0] + 2)} ${r(y - off)} Q ${r(cx)} ${r(y - off - bulge * 0.6)} ${r(Rr[0] - 2)} ${r(y - off)}`
  return { front, back }
}

function norm(ax: number, ay: number, bx: number, by: number): Pt {
  const dx = ax - bx
  const dy = ay - by
  const m = Math.hypot(dx, dy) || 1
  return [dx / m, dy / m]
}

/** Filled arrowhead polygon with its tip at (tx,ty) pointing along (dx,dy). */
export function arrowhead(tipX: number, tipY: number, dx: number, dy: number, size = 7, halfW = 3.4): string {
  const bx = tipX - dx * size
  const by = tipY - dy * size
  const px = -dy
  const py = dx
  return `M ${r(tipX)} ${r(tipY)} L ${r(bx + px * halfW)} ${r(by + py * halfW)} L ${r(bx - px * halfW)} ${r(by - py * halfW)} Z`
}

function pathFromPoints(points: Pt[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ')
}

// ---------------------------------------------------------------------------
// FigureBodyGroup — the shaded mannequin body, reusable in close-up crops
// ---------------------------------------------------------------------------

/**
 * The filled, shaded figure (no measurement lines). Reused by the main
 * interactive diagram AND by the per-measurement close-up diagrams, so every
 * view shows the very same mannequin.
 */
export function FigureBodyGroup({ profile }: { profile: MeasurementCategory }) {
  const fig = FIGURES[profile]
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const fill = `url(#kozy-body-${uid})`
  const stroke = '#9FB1C7'

  return (
    <g>
      <defs>
        {/* per-part cylinder shading: lit centre, shaded edges */}
        <linearGradient id={`kozy-body-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#CBB894" />
          <stop offset="0.18" stopColor="#E7DABF" />
          <stop offset="0.5" stopColor="#FAF4E6" />
          <stop offset="0.82" stopColor="#E7DABF" />
          <stop offset="1" stopColor="#CBB894" />
        </linearGradient>
      </defs>

      {/* torso + legs, arms, feet, neck, head — all gradient-filled */}
      <path d={fig.body} fill={fill} strokeWidth={2} strokeLinejoin="round" stroke={stroke} />
      <path d={fig.armL} fill={fill} strokeWidth={2} strokeLinejoin="round" stroke={stroke} />
      <path d={fig.armR} fill={fill} strokeWidth={2} strokeLinejoin="round" stroke={stroke} />
      <path d={fig.feet} fill={fill} strokeWidth={2} strokeLinejoin="round" stroke={stroke} />
      <path d={fig.neck} fill={fill} strokeWidth={2} strokeLinejoin="round" stroke={stroke} />
      <path d={fig.head} fill={fill} strokeWidth={2} strokeLinejoin="round" stroke={stroke} />

      {/* subtle anatomy cues */}
      <g fill="none" stroke="#B7C4D6" strokeWidth={1} strokeLinecap="round" opacity={0.7}>
        {DETAIL_SOLID[profile].map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <g fill="none" stroke="#B7C4D6" strokeWidth={1} strokeLinecap="round" opacity={0.45}>
        {DETAIL_DASHED[profile].map((d) => (
          <path key={d} d={d} strokeDasharray="3 5" />
        ))}
      </g>
    </g>
  )
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
  const measures = MEASUREMENTS[profile]

  return (
    <svg
      viewBox="0 0 320 640"
      className={cn('h-full w-full select-none', className)}
      role="img"
      aria-label={`${profile} measurement diagram`}
    >
      {/* --- ground shadow (draws the figure into space) --- */}
      <ellipse cx={fig.shadow.cx} cy={fig.shadow.cy} rx={fig.shadow.rx} ry={fig.shadow.ry} fill="#E9EEF6" />

      {/* --- the mannequin --- */}
      <FigureBodyGroup profile={profile} />

      {/* --- measurement tapes --- */}
      {lines.map((line) => {
        const active = line.id === activeId
        const numbered = measures.findIndex((m) => m.id === line.id)
        const labelText =
          LINE_LABELS[line.id] ?? measures.find((m) => m.id === line.id)?.label ?? line.id
        const labelWithNum = numbered >= 0 ? `${numbered + 1} · ${labelText}` : labelText
        const tape = active ? '#D4AF37' : '#C8D2DF'
        const tapeBack = active ? '#E3BE4F' : '#C8D2DF'
        const clickable = numbered >= 0

        // circumference tapes: solid front arc + dashed back line + span arrows
        if (line.kind === 'circ') {
          const { front, back } = tapeArcs(line)
          const [L, Rr] = line.points
          const y = L[1]
          return (
            <g
              key={line.id}
              className={clickable ? 'cursor-pointer' : undefined}
              onClick={clickable ? () => onSelect(line.id) : undefined}
            >
              {/* fat invisible hit area */}
              <path d={front} fill="none" stroke="transparent" strokeWidth={20} pointerEvents="stroke" />

              {/* hidden back half of the tape — the "wraps around" convention */}
              <path
                d={back}
                fill="none"
                strokeDasharray="4 3"
                strokeLinecap="round"
                strokeWidth={active ? 1.6 : 1.1}
                style={{ stroke: tapeBack, transition: 'stroke 200ms' }}
              />

              {/* front half of the tape */}
              <path
                d={front}
                fill="none"
                strokeLinecap="round"
                strokeWidth={active ? 2.6 : 1.5}
                style={{ stroke: tape, transition: 'stroke 200ms, stroke-width 200ms' }}
              />

              {/* double-headed span arrows */}
              {[arrowhead(L[0] + 0.5, y, -1, 0), arrowhead(Rr[0] - 0.5, y, 1, 0)].map((d, i) => (
                <path
                  key={i}
                  d={d}
                  style={{ fill: tape, transition: 'fill 200ms' }}
                />
              ))}

              {active && (
                <motion.path
                  d={front}
                  fill="none"
                  stroke="#D4AF37"
                  strokeWidth={2.6}
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0.9 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              )}

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
                {labelWithNum}
              </text>
            </g>
          )
        }

        // point-to-point tapes: path + landmark dots + end arrows
        const d = pathFromPoints(line.points)
        const first = line.points[0]
        const last = line.points[line.points.length - 1]
        const dirStart = norm(first[0], first[1], line.points[1][0], line.points[1][1])
        const dirEnd = norm(
          last[0],
          last[1],
          line.points[line.points.length - 2][0],
          line.points[line.points.length - 2][1],
        )
        return (
          <g
            key={line.id}
            className={clickable ? 'cursor-pointer' : undefined}
            onClick={clickable ? () => onSelect(line.id) : undefined}
          >
            {/* fat invisible hit area */}
            <path d={d} fill="none" stroke="transparent" strokeWidth={20} pointerEvents="stroke" />

            {/* the tape */}
            <path
              d={d}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={active ? 2.6 : 1.5}
              style={{ stroke: tape, transition: 'stroke 200ms, stroke-width 200ms' }}
            />

            {/* end arrows along the path direction */}
            {[arrowhead(first[0], first[1], dirStart[0], dirStart[1]),
              arrowhead(last[0], last[1], dirEnd[0], dirEnd[1])].map((ah, i) => (
              <path key={i} d={ah} style={{ fill: tape, transition: 'fill 200ms' }} />
            ))}

            {/* landmark dots */}
            {[first, last].map((p, i) =>
              active ? (
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
              ) : (
                <circle key={i} cx={p[0]} cy={p[1]} r={2.4} fill="#C8D2DF" />
              ),
            )}

            {active && (
              <motion.path
                d={d}
                fill="none"
                stroke="#D4AF37"
                strokeWidth={2.6}
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0.9 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.55, ease: 'easeOut' }}
              />
            )}

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
              {labelWithNum}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
