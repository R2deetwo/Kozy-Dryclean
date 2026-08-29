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
// =============================================================================

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { MeasurementCategory } from '@/lib/measurements'

export interface FigureMeasureLine {
  id: string
  /** polyline points (x, y) in the 320x640 viewBox */
  points: [number, number][]
  label: { x: number; y: number; anchor: 'start' | 'middle' | 'end' }
}

type Pt = [number, number]

// ---------------------------------------------------------------------------
// Figure geometry — technical-flat croquis, 320x640 viewBox
// ---------------------------------------------------------------------------

const MALE_FIGURE = {
  head: { cx: 160, cy: 50, rx: 23, ry: 29 },
  neck: 'M 150 77 L 149 95 M 170 77 L 171 95',
  body:
    'M 116 106 ' +
    'C 106 112 100 130 102 152 ' +
    'C 103 176 108 196 112 214 ' +
    'C 114 236 112 258 110 278 ' +
    'C 108 296 112 310 122 318 ' +
    'L 128 330 ' +
    'C 126 390 124 450 126 510 ' +
    'C 127 540 128 556 128 566 ' +
    'L 152 566 ' +
    'C 152 500 152 440 152 400 ' +
    'L 152 336 ' +
    'L 168 336 ' +
    'C 168 440 168 500 168 566 ' +
    'L 192 566 ' +
    'C 192 540 194 510 194 480 ' +
    'C 196 420 194 390 192 330 ' +
    'L 198 318 ' +
    'C 208 310 212 296 210 278 ' +
    'C 208 258 206 236 208 214 ' +
    'C 212 196 217 176 218 152 ' +
    'C 220 130 214 112 204 106 ' +
    'C 190 100 170 98 160 98 ' +
    'C 150 98 130 100 116 106 Z',
  armL:
    'M 117 110 ' +
    'C 105 118 99 142 95 172 ' +
    'C 91 202 89 232 87 260 ' +
    'C 86 277 85 292 83 304 ' +
    'L 95 308 ' +
    'C 97 290 99 272 101 254 ' +
    'C 105 222 109 192 113 168 ' +
    'C 116 148 119 130 123 118 Z',
  armR:
    'M 203 110 ' +
    'C 215 118 221 142 225 172 ' +
    'C 229 202 231 232 233 260 ' +
    'C 234 277 235 292 237 304 ' +
    'L 225 308 ' +
    'C 223 290 221 272 219 254 ' +
    'C 215 222 211 192 207 168 ' +
    'C 204 148 201 130 197 118 Z',
  feet:
    'M 128 566 C 122 570 112 571 106 572 L 106 577 C 118 578 128 575 130 570 Z ' +
    'M 192 566 C 198 570 208 571 214 572 L 214 577 C 202 578 192 575 190 570 Z',
}

const FEMALE_FIGURE = {
  head: { cx: 160, cy: 50, rx: 21, ry: 28 },
  neck: 'M 151 76 L 150 95 M 169 76 L 170 95',
  body:
    'M 122 106 ' +
    'C 112 112 107 128 108 148 ' +
    'C 109 164 110 176 112 188 ' +      // bust side
    'C 114 204 118 226 124 244 ' +      // waist taper
    'C 128 258 130 268 128 280 ' +
    'C 124 296 116 302 114 312 ' +      // hip flare
    'C 112 322 118 330 126 336 ' +
    'L 131 344 ' +
    'C 129 400 127 452 129 508 ' +
    'C 130 538 131 554 131 564 ' +
    'L 153 564 ' +
    'C 153 498 153 438 153 398 ' +
    'L 153 348 ' +
    'L 167 348 ' +
    'C 167 438 167 498 167 564 ' +
    'L 189 564 ' +
    'C 189 554 190 538 191 508 ' +
    'C 193 452 191 400 189 344 ' +
    'L 194 336 ' +
    'C 202 330 208 322 206 312 ' +
    'C 204 302 196 296 192 280 ' +
    'C 190 268 192 258 196 244 ' +
    'C 202 226 206 204 208 188 ' +
    'C 210 176 211 164 212 148 ' +
    'C 213 128 208 112 198 106 ' +
    'C 185 100 170 98 160 98 ' +
    'C 150 98 135 100 122 106 Z',
  armL:
    'M 123 110 ' +
    'C 112 118 107 140 104 168 ' +
    'C 101 196 99 226 97 252 ' +
    'C 96 268 95 282 93 294 ' +
    'L 104 298 ' +
    'C 106 281 108 264 110 247 ' +
    'C 113 217 117 189 121 166 ' +
    'C 124 147 126 130 129 118 Z',
  armR:
    'M 197 110 ' +
    'C 208 118 213 140 216 168 ' +
    'C 219 196 221 226 223 252 ' +
    'C 224 268 225 282 227 294 ' +
    'L 216 298 ' +
    'C 214 281 212 264 210 247 ' +
    'C 207 217 203 189 199 166 ' +
    'C 196 147 194 130 191 118 Z',
  feet:
    'M 131 564 C 125 568 116 569 110 570 L 110 575 C 121 576 131 573 133 568 Z ' +
    'M 189 564 C 195 568 204 569 210 570 L 210 575 C 199 576 189 573 187 568 Z',
}

const CHILD_FIGURE = {
  head: { cx: 160, cy: 62, rx: 27, ry: 32 },
  neck: 'M 150 92 L 149 108 M 170 92 L 171 108',
  body:
    'M 128 118 ' +
    'C 118 124 113 140 114 160 ' +
    'C 115 178 118 198 122 220 ' +
    'C 124 238 124 254 122 270 ' +
    'C 120 288 116 300 118 312 ' +
    'C 120 324 126 330 132 336 ' +
    'L 136 346 ' +
    'C 134 402 132 452 134 500 ' +
    'C 135 528 136 546 136 558 ' +
    'L 154 558 ' +
    'C 154 500 154 448 154 406 ' +
    'L 154 352 ' +
    'L 166 352 ' +
    'C 166 448 166 500 166 558 ' +
    'L 184 558 ' +
    'C 184 546 185 528 186 500 ' +
    'C 188 452 186 402 184 346 ' +
    'L 188 336 ' +
    'C 194 330 200 324 202 312 ' +
    'C 204 300 200 288 198 270 ' +
    'C 196 254 196 238 198 220 ' +
    'C 202 198 205 178 206 160 ' +
    'C 207 140 202 124 192 118 ' +
    'C 181 112 170 110 160 110 ' +
    'C 150 110 139 112 128 118 Z',
  armL:
    'M 129 122 ' +
    'C 119 129 114 150 111 176 ' +
    'C 108 200 106 224 104 246 ' +
    'C 103 260 102 272 100 282 ' +
    'L 111 286 ' +
    'C 113 271 115 256 117 241 ' +
    'C 120 215 124 191 128 172 ' +
    'C 131 155 133 139 136 128 Z',
  armR:
    'M 191 122 ' +
    'C 201 129 206 150 209 176 ' +
    'C 212 200 214 224 216 246 ' +
    'C 217 260 218 272 220 282 ' +
    'L 209 286 ' +
    'C 207 271 205 256 203 241 ' +
    'C 200 215 196 191 192 172 ' +
    'C 189 155 187 139 184 128 Z',
  feet:
    'M 136 558 C 130 562 122 563 116 564 L 116 569 C 126 570 136 567 138 562 Z ' +
    'M 184 558 C 190 562 198 563 204 564 L 204 569 C 194 570 184 567 182 562 Z',
}

const FIGURES: Record<MeasurementCategory, typeof MALE_FIGURE> = {
  men: MALE_FIGURE,
  women: FEMALE_FIGURE,
  children: CHILD_FIGURE,
}

// measurement lines per profile — coordinates tuned to sit on the figure
const LINES: Record<MeasurementCategory, FigureMeasureLine[]> = {
  men: [
    { id: 'neck', points: [[131, 86], [189, 86]], label: { x: 196, y: 84, anchor: 'start' } },
    { id: 'chest', points: [[94, 158], [226, 158]], label: { x: 88, y: 156, anchor: 'end' } },
    { id: 'waist', points: [[106, 246], [214, 246]], label: { x: 100, y: 244, anchor: 'end' } },
    { id: 'seat', points: [[100, 296], [220, 296]], label: { x: 226, y: 294, anchor: 'start' } },
    { id: 'shoulder', points: [[108, 104], [212, 104]], label: { x: 160, y: 92, anchor: 'middle' } },
    { id: 'sleeve', points: [[112, 108], [88, 252], [84, 306]], label: { x: 66, y: 210, anchor: 'end' } },
    { id: 'inseam', points: [[154, 340], [155, 560]], label: { x: 148, y: 470, anchor: 'end' } },
    { id: 'shirt', points: [[160, 96], [160, 330]], label: { x: 168, y: 214, anchor: 'start' } },
  ],
  women: [
    { id: 'bust', points: [[98, 168], [222, 168]], label: { x: 92, y: 166, anchor: 'end' } },
    { id: 'underbust', points: [[104, 196], [216, 196]], label: { x: 234, y: 194, anchor: 'start' } },
    { id: 'waist', points: [[118, 252], [202, 252]], label: { x: 112, y: 250, anchor: 'end' } },
    { id: 'hips', points: [[102, 304], [218, 304]], label: { x: 234, y: 302, anchor: 'start' } },
    { id: 'shoulder', points: [[116, 104], [204, 104]], label: { x: 160, y: 92, anchor: 'middle' } },
    { id: 'sleeve', points: [[122, 108], [97, 252], [92, 300]], label: { x: 74, y: 210, anchor: 'end' } },
    { id: 'length', points: [[160, 96], [160, 560]], label: { x: 168, y: 420, anchor: 'start' } },
  ],
  children: [
    { id: 'height', points: [[74, 32], [74, 570]], label: { x: 74, y: 22, anchor: 'middle' } },
    { id: 'chest', points: [[104, 168], [216, 168]], label: { x: 226, y: 166, anchor: 'start' } },
    { id: 'waist', points: [[110, 258], [210, 258]], label: { x: 104, y: 256, anchor: 'end' } },
    { id: 'hips', points: [[106, 316], [214, 316]], label: { x: 226, y: 314, anchor: 'start' } },
    { id: 'sleeve', points: [[128, 122], [103, 246], [99, 286]], label: { x: 80, y: 205, anchor: 'end' } },
    { id: 'inseam', points: [[156, 352], [157, 556]], label: { x: 148, y: 470, anchor: 'end' } },
  ],
}

// extra label text per profile (ids not in the data model need a display name)
const LINE_LABELS: Record<string, string> = {
  shirt: 'Shirt length',
  length: 'Dress length',
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
      {/* --- figure (technical-flat croquis) --- */}
      <ellipse
        cx={fig.head.cx}
        cy={fig.head.cy}
        rx={fig.head.rx}
        ry={fig.head.ry}
        className="fill-white"
        strokeWidth={2}
        strokeLinejoin="round"
        style={{ stroke: '#9FB1C7' }}
      />
      <path d={fig.neck} fill="none" style={{ stroke: '#9FB1C7' }} strokeWidth={2} strokeLinecap="round" />
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
      <path
        d={fig.body}
        className="fill-white"
        strokeWidth={2}
        strokeLinejoin="round"
        style={{ stroke: '#9FB1C7' }}
      />
      <path d={fig.feet} className="fill-white" strokeWidth={2} strokeLinejoin="round" style={{ stroke: '#9FB1C7' }} />

      {/* --- measurement lines --- */}
      {lines.map((line) => {
        const active = line.id === activeId
        const d = pathFromPoints(line.points)
        const first = line.points[0]
        const last = line.points[line.points.length - 1]
        const t1 = tick(first, line.points[1] ?? last)
        const t2 = tick(last, line.points[line.points.length - 2] ?? first)
        const labelText = LINE_LABELS[line.id] ?? line.id.charAt(0).toUpperCase() + line.id.slice(1)

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
