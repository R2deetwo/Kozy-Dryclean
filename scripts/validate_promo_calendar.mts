// Validate the seasonal promo plan (promo-calendar.ts).
// Run: node scripts/validate_promo_calendar.mts
import {
  easterSunday,
  getSeasonalPromoPlan,
  getUpcomingPromoPlan,
  getPromoPlanStatus,
} from '../src/lib/promo-calendar.ts'

let failures = 0
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

// Locale-independent formatters (Lagos = UTC+1, no DST).
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const lagosParts = (d: Date) => {
  const l = new Date(d.getTime() + 60 * 60_000)
  return {
    y: l.getUTCFullYear(),
    m: l.getUTCMonth() + 1,
    d: l.getUTCDate(),
    hh: l.getUTCHours(),
    mm: l.getUTCMinutes(),
  }
}
const pad = (n: number) => String(n).padStart(2, '0')
const lagosMD = (d: Date) => { const p = lagosParts(d); return `${p.d} ${MONTHS[p.m - 1]}` }
const lagosMDY = (d: Date) => `${lagosMD(d)} ${lagosParts(d).y}`
const lagosFull = (d: Date) => { const p = lagosParts(d); return `${lagosMDY(d)} ${pad(p.hh)}:${pad(p.mm)}` }
const utcMD = (d: Date) => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`

// ---- 1. Easter algorithm (known dates) ----
const easterCases: [number, string][] = [
  [2024, '31 Mar'], [2025, '20 Apr'], [2026, '5 Apr'], [2027, '28 Mar'], [2028, '16 Apr'], [2030, '21 Apr'],
]
for (const [y, expected] of easterCases) {
  const got = utcMD(easterSunday(y))
  check(`Easter ${y} = ${expected}`, got === expected, got)
}

// ---- 2. Structure of the 2026 plan ----
const plan = getSeasonalPromoPlan(2026)
check('8 seasonal entries', plan.length === 8, `got ${plan.length}`)
check('unique codes', new Set(plan.map((p) => p.code)).size === 8)
check('sorted by start', plan.every((p, i) => i === 0 || plan[i - 1].start <= p.start))

// ---- 3. THE Dec-15 rule: DETTY15 window ----
const detty = plan.find((p) => p.code === 'DETTY15')!
check('DETTY15 starts 15 Dec 2026 00:00 Lagos', lagosFull(detty.start) === '15 Dec 2026 00:00', lagosFull(detty.start))
check('DETTY15 ends 5 Jan 2027 23:59 Lagos', lagosFull(detty.end) === '5 Jan 2027 23:59', lagosFull(detty.end))
check('DETTY15 note names December 15 + never December 1', /December 15/i.test(detty.note) && /never December 1/i.test(detty.note))
check('DETTY15 announce weeks 49-50', /49–50|49-50/.test(detty.announceWith))
check('DETTY15 prefill start = 2026-12-15T00:00', detty.startLocal === '2026-12-15T00:00', detty.startLocal)
check('DETTY15 prefill end = 2027-01-05T23:59', detty.endLocal === '2027-01-05T23:59', detty.endLocal)

// ---- 4. Other windows keyed to their anchors ----
const by = (code: string) => plan.find((p) => p.code === code)!
check('NIGERIA65 opens 1 Oct, closes 7 Oct', lagosMD(by('NIGERIA65').start) === '1 Oct' && lagosMD(by('NIGERIA65').end) === '7 Oct')
check('VALENTINE opens 1 Feb, closes 14 Feb', lagosMD(by('VALENTINE').start) === '1 Feb' && lagosMD(by('VALENTINE').end) === '14 Feb')
check('CORP20 = November only', lagosMD(by('CORP20').start) === '1 Nov' && lagosMD(by('CORP20').end) === '30 Nov')
check('BACK2WORK = September only', lagosMD(by('BACK2WORK').start) === '1 Sep' && lagosMD(by('BACK2WORK').end) === '30 Sep')
check('BACK2SCHOOL = August only', lagosMD(by('BACK2SCHOOL').start) === '1 Aug' && lagosMD(by('BACK2SCHOOL').end) === '31 Aug')
check('FRESHSTART starts 6 Jan (after Detty closes)', lagosMD(by('FRESHSTART').start) === '6 Jan')
const e10 = by('EASTER10')
const easter2026 = easterSunday(2026)
const twoWeeksBefore = new Date(easter2026.getTime() - 14 * 86_400_000)
const easterMonday = new Date(easter2026.getTime() + 86_400_000)
check('EASTER10 opens 2 weeks before Easter Sunday', lagosMD(e10.start) === utcMD(twoWeeksBefore), `${lagosMD(e10.start)} vs ${utcMD(twoWeeksBefore)}`)
check('EASTER10 closes Easter Monday', lagosMD(e10.end) === utcMD(easterMonday), `${lagosMD(e10.end)} vs ${utcMD(easterMonday)}`)
check('EASTER10 window is in the same year as Easter', lagosParts(e10.start).y === 2026 && lagosParts(e10.end).y === 2026)

// ---- 5. No window overlaps (incl. DETTY tail vs next year's FRESHSTART) ----
const all = [...getSeasonalPromoPlan(2025), ...getSeasonalPromoPlan(2026), ...getSeasonalPromoPlan(2027)]
let overlaps = 0
for (let i = 0; i < all.length; i++) {
  for (let j = i + 1; j < all.length; j++) {
    const a = all[i], b = all[j]
    if (a.id === b.id) continue
    if (a.start <= b.end && b.start <= a.end) {
      overlaps++
      console.log(`  overlap: ${a.id} (${lagosFull(a.start)}–${lagosFull(a.end)}) × ${b.id} (${lagosFull(b.start)}–${lagosFull(b.end)})`)
    }
  }
}
check('no overlapping windows across 2025-2027', overlaps === 0, `${overlaps} overlaps`)

// ---- 6. Status logic around Dec 15 ----
const before = new Date('2026-12-14T22:00:00Z') // strictly before 15 Dec 00:00 Lagos
const during = new Date('2026-12-20T12:00:00Z')
const after = new Date('2027-01-06T00:00:00Z') // after 5 Jan 23:59 Lagos
check('DETTY15 UPCOMING on 14 Dec', getPromoPlanStatus(detty, before) === 'UPCOMING')
check('DETTY15 LIVE on 20 Dec', getPromoPlanStatus(detty, during) === 'LIVE')
check('DETTY15 ENDED after 5 Jan', getPromoPlanStatus(detty, after) === 'ENDED')

// ---- 7. getUpcomingPromoPlan for "now" (2026-09-17) ----
const now = new Date('2026-09-17T12:00:00Z')
const upcoming = getUpcomingPromoPlan(now)
check('upcoming plan has 8 entries', upcoming.length === 8, `got ${upcoming.length}`)
check('upcoming plan drops ended windows', upcoming.every((p) => p.end >= now))
check('upcoming plan sorted soonest-first', upcoming.every((p, i) => i === 0 || upcoming[i - 1].start <= p.start))
check('first is BACK2WORK (LIVE now)', upcoming[0].code === 'BACK2WORK' && getPromoPlanStatus(upcoming[0], now) === 'LIVE', upcoming[0].code)
const janNow = new Date('2027-01-02T12:00:00Z') // early January: Detty still live
const janPlan = getUpcomingPromoPlan(janNow)
check('early-January plan keeps DETTY15 (runs into new year)', janPlan.some((p) => p.code === 'DETTY15' && getPromoPlanStatus(p, janNow) === 'LIVE'))

// ---- 8. Rules carried on entries ----
check('FRESHSTART: 1 per customer + ₦5,000 cap', by('FRESHSTART').maxUsesPerUser === 1 && by('FRESHSTART').maxDiscount === 5000)
check('VALENTINE: ₦10,000 min spend', by('VALENTINE').minOrderValue === 10000)
check('NIGERIA65: ₦5,000 min spend', by('NIGERIA65').minOrderValue === 5000)
check('DETTY15: B2C 15% + ₦5,000 cap', detty.appliesTo === 'B2C' && detty.value === 15 && detty.maxDiscount === 5000)

console.log('\n--- the 2026 plan (for review) ---')
for (const p of plan) {
  console.log(`${p.code.padEnd(13)} ${lagosFull(p.start)} → ${lagosFull(p.end)}  [${getPromoPlanStatus(p, now)}]  announce: ${p.announceWith}`)
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASS' : `${failures} CHECK(S) FAILED`}`)
process.exit(failures === 0 ? 0 : 1)
