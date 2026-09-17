// =============================================================================
// The seasonal promo plan — recommended coupon windows for the Nigerian year
// =============================================================================
// Companion to the 52-week newsletter library (newsletter-content.ts): the
// same seasons, expressed as coupon windows the owner can create in the
// Marketing tab → Coupons.
//
// TIMING RULES (per the client):
//   - DETTY DECEMBER STARTS ON DECEMBER 15 and runs into the new year — its
//     promo window opens ON the 15th (Dec 15 → Jan 5), NEVER December 1.
//     Nothing before the week containing December 15 may treat the season
//     as open (same rule as the newsletter library, weeks 49/50).
//   - Every other window is keyed to its season's real anchor: Valentine's
//     Day, Easter Sunday (computed per year — it moves), school resumption,
//     October 1, the November corporate-prep month.
//
// This is GUIDANCE, not automation: the plan prefills the coupon form and
// the owner presses Create — coupons are never created automatically, the
// same approval gate as the newsletter engine. Values/codes are suggestions
// from the original marketing plan (BACK2WORK, NIGERIA65, CORP20, DETTY15,
// FRESHSTART, VALENTINE) plus two fillers for the rest of the year; every
// field is editable in the form before creation.
//
// All wall-clock math is Africa/Lagos (UTC+1, no DST).
// =============================================================================

const LAGOS_OFFSET_MIN = 60

export type PromoSegment = 'ALL' | 'B2C' | 'B2B' | 'FIRST_ORDER'

export interface PromoPlanEntry {
  /** Unique key — `${code}-${year}` */
  id: string
  /** The season label, e.g. 'Detty December' */
  season: string
  /** Suggested coupon name (becomes the coupon's admin-facing name) */
  name: string
  /** Suggested code — the owner can change it in the form */
  code: string
  /** Admin-facing description (customers only ever see the code working) */
  description: string
  appliesTo: PromoSegment
  type: 'PERCENTAGE' | 'FIXED'
  value: number
  minOrderValue?: number
  maxDiscount?: number
  maxUsesPerUser?: number
  /** Window start as an instant (Lagos wall clock converted to UTC) */
  start: Date
  /** Window end as an instant (inclusive, Lagos wall clock) */
  end: Date
  /** datetime-local prefill for the coupon form's Start field (Lagos) */
  startLocal: string
  /** datetime-local prefill for the coupon form's End field (Lagos) */
  endLocal: string
  /** One line: why the window sits where it sits */
  note: string
  /** Which newsletter weeks should carry the announcement */
  announceWith: string
}

export type PromoPlanStatus = 'UPCOMING' | 'LIVE' | 'ENDED'

// -----------------------------------------------------------------------------
// Lagos wall-clock helpers
// -----------------------------------------------------------------------------
interface LagosStamp {
  utc: Date
  /** "YYYY-MM-DDTHH:mm" — the value a datetime-local input expects */
  local: string
}

/** Build a Lagos wall-clock moment from calendar components. */
function lagos(year: number, month: number, day: number, hour = 0, minute = 0): LagosStamp {
  const pad = (n: number) => String(n).padStart(2, '0')
  const utc = new Date(
    Date.UTC(year, month - 1, day, hour, minute, 0, 0) - LAGOS_OFFSET_MIN * 60_000
  )
  return {
    utc,
    local: `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}`,
  }
}

/** The year it currently is in Lagos. */
function lagosYear(now: Date = new Date()): number {
  return new Date(now.getTime() + LAGOS_OFFSET_MIN * 60_000).getUTCFullYear()
}

/** Easter Sunday (Gregorian computus — exact for all practical years). */
export function easterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(Date.UTC(year, month - 1, day))
}

// -----------------------------------------------------------------------------
// The plan
// -----------------------------------------------------------------------------
/**
 * The recommended seasonal coupons for a given year, in calendar order.
 * Windows never overlap, so the owner never runs two seasonal codes at once
 * (ad-hoc coupons like WEEKEND12 are unaffected — checkout takes one code).
 */
export function getSeasonalPromoPlan(year: number): PromoPlanEntry[] {
  const easter = easterSunday(year)
  const easterMonth = easter.getUTCMonth() + 1
  const easterDay = easter.getUTCDate()
  // Two weeks before Easter Sunday → Easter Monday (outfits go in early).
  const twoWeeksBefore = new Date(easter.getTime() - 14 * 86_400_000)
  const easterMonday = new Date(easter.getTime() + 86_400_000)

  const mk = (
    season: string,
    name: string,
    code: string,
    description: string,
    appliesTo: PromoSegment,
    type: 'PERCENTAGE' | 'FIXED',
    value: number,
    start: LagosStamp,
    end: LagosStamp,
    note: string,
    announceWith: string,
    rules: { minOrderValue?: number; maxDiscount?: number; maxUsesPerUser?: number } = {}
  ): PromoPlanEntry => ({
    id: `${code}-${year}`,
    season,
    name,
    code,
    description,
    appliesTo,
    type,
    value,
    ...rules,
    start: start.utc,
    end: end.utc,
    startLocal: start.local,
    endLocal: end.local,
    note,
    announceWith,
  })

  return [
    mk(
      'New Year win-back',
      'New Year, New Wardrobe',
      'FRESHSTART',
      `Win-back offer — ${year}'s first clean at a discount. Send it to the lapsed-customer segment (no order in 60+ days) via a campaign.`,
      'ALL',
      'PERCENTAGE',
      25,
      lagos(year, 1, 6, 0, 0),
      lagos(year, 1, 31, 23, 59),
      'January is the second-busiest clean of the year — everyone sends December\'s outfits at once, and lapsed customers decide who to trust again. Starts on the 6th, after Detty December closes.',
      'the January emails — weeks 1–3',
      { maxDiscount: 5000, maxUsesPerUser: 1 }
    ),
    mk(
      'Valentine',
      'Valentine\'s Date Night',
      'VALENTINE',
      'Fixed amount off date-night cleaning — outfits must be back before the 14th.',
      'B2C',
      'FIXED',
      1000,
      lagos(year, 2, 1, 0, 0),
      lagos(year, 2, 14, 23, 59),
      'Opens two weeks before the day and closes on Valentine\'s night — after the 14th the moment (and the outfit) has passed.',
      'week 6 (Valentine outfits ready)',
      { minOrderValue: 10000 }
    ),
    mk(
      'Easter',
      'Easter Sunday Best',
      'EASTER10',
      `Seasonal discount for Easter cleaning. Window computed from Easter Sunday (${easterDay === 1 ? 'April' : 'March/April'} — it moves every year).`,
      'B2C',
      'PERCENTAGE',
      10,
      lagos(twoWeeksBefore.getUTCFullYear(), twoWeeksBefore.getUTCMonth() + 1, twoWeeksBefore.getUTCDate(), 0, 0),
      lagos(easterMonday.getUTCFullYear(), easterMonday.getUTCMonth() + 1, easterMonday.getUTCDate(), 23, 59),
      `Easter Sunday is ${easterMonth}/${easterDay} — the window opens two weeks out (when the Sunday-best starts going in) and closes Easter Monday.`,
      'week 14 (Easter Sunday best — floats with the calendar)',
      { maxDiscount: 3000 }
    ),
    mk(
      'Back to school',
      'Back to School',
      'BACK2SCHOOL',
      'Uniform season — deep-clean the old set before resumption while the new set is being bought.',
      'B2C',
      'PERCENTAGE',
      10,
      lagos(year, 8, 1, 0, 0),
      lagos(year, 8, 31, 23, 59),
      'August is uniform month — the window closes as school resumes and the September rush begins.',
      'weeks 30 & 33 (back to school)',
      { maxDiscount: 2000 }
    ),
    mk(
      'Back to work',
      'Back to Work Refresh',
      'BACK2WORK',
      'The September reset — suits, shirts and work wardrobes restart after the holidays.',
      'B2C',
      'PERCENTAGE',
      15,
      lagos(year, 9, 1, 0, 0),
      lagos(year, 9, 30, 23, 59),
      'September is when offices get serious again — one month, then the Independence and owambe windows take over.',
      'week 38 (the end-of-year circuit email)',
      { maxDiscount: 3000 }
    ),
    mk(
      'Independence',
      'Independence Clean',
      'NIGERIA65',
      'A green-and-white moment — fixed amount off in the week of October 1.',
      'ALL',
      'FIXED',
      650,
      lagos(year, 10, 1, 0, 0),
      lagos(year, 10, 7, 23, 59),
      'Keyed to October 1 — a one-week moment, then the owambe circuit proper begins.',
      'week 39 (Independence Day)',
      { minOrderValue: 5000 }
    ),
    mk(
      'Corporate prep',
      'Dry Season Corporate Prep',
      'CORP20',
      'Corporate rate for hotels and businesses arranging December backup — the standing HOTEL15 alternative for one month.',
      'B2B',
      'PERCENTAGE',
      20,
      lagos(year, 11, 1, 0, 0),
      lagos(year, 11, 30, 23, 59),
      'November is when hotels arrange their December capacity — the corporate conversation happens now, not in the rush.',
      'week 46 (hotel & corporate push)',
      { maxDiscount: 10000 }
    ),
    mk(
      'Detty December',
      'Detty December Ready',
      'DETTY15',
      `Detty December runs from December 15 into the new year — the window opens ON the 15th. Announce it in the emails right before, never with a "December has started" framing.`,
      'B2C',
      'PERCENTAGE',
      15,
      lagos(year, 12, 15, 0, 0),
      lagos(year + 1, 1, 5, 23, 59),
      'DETTY DECEMBER STARTS ON DECEMBER 15 — never December 1. The window opens on the 15th and runs into the first week of the new year.',
      'weeks 49–50 (the emails just before December 15)',
      { maxDiscount: 5000 }
    ),
  ]
}

/**
 * The promo plan the Coupons tab shows: everything not yet ended (a LIVE
 * window from last year still counts in early January — Detty December runs
 * into the new year), soonest first, capped at 8 rows.
 */
export function getUpcomingPromoPlan(now: Date = new Date()): PromoPlanEntry[] {
  const y = lagosYear(now)
  return [y - 1, y, y + 1]
    .flatMap((yr) => getSeasonalPromoPlan(yr))
    .filter((p) => p.end.getTime() >= now.getTime())
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .slice(0, 8)
}

/** LIVE inside the window, UPCOMING before it, ENDED after it. */
export function getPromoPlanStatus(entry: PromoPlanEntry, now: Date = new Date()): PromoPlanStatus {
  if (now < entry.start) return 'UPCOMING'
  if (now > entry.end) return 'ENDED'
  return 'LIVE'
}
