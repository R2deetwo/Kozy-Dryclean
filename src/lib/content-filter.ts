// =============================================================================
// Content moderation — regex-based screen for user-submitted public text
// =============================================================================
// Phase 17, client directive: reviews and feedback pass an automated screen
// so improper content (sexual material, profanity, slurs, illegal-goods
// solicitation, spam links) can NEVER reach the public testimonials wall —
// no matter how many stars it carries. Everything here is defensive:
//
//   • normalize() defeats trivial obfuscation (leetspeak, intra-word
//     separators like "p.o.r.n", repeated characters) before matching,
//     while PRESERVING word boundaries — so "is excellent" can never
//     false-positive as "sex" the way fully-joined matching would
//   • HARD_BLOCK terms reject the submission with a friendly message
//   • URL / instant-messaging handles are rejected on public surfaces
//
// The filter errs on the side of blocking; a human still reads everything
// in the admin inbox, and the caller decides rejection vs. flagging.
// =============================================================================

/** Normalize text for matching: lowercase, strip accents/diacritics, map
 *  common leetspeak, remove intra-word separator characters (so "p.o.r.n"
 *  and "p-0-r-n" match "porn") while KEEPING whitespace as the word
 *  boundary. Runs of 3+ identical characters collapse to 2 ("pooorn" ->
 *  "poorn" still matches "porn" via its own collapse; "xxl" sizes are
 *  untouched). */
export function normalizeForModeration(input: string): string {
  let s = (input || '').toLowerCase()
  // strip diacritics (é -> e)
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  // leetspeak -> letters
  s = s
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/8/g, 'b')
    .replace(/@/g, 'a')
    .replace(/\$/g, 's')
    .replace(/\!/g, 'i')
    .replace(/\*/g, 'o')
  // remove intra-word separators (dots, dashes, underscores…) but keep
  // whitespace — it is the word boundary that prevents cross-word matches
  s = s.replace(/[._\-+,#/\\|~^`'"()\[\]{}<>:;?]+/g, '')
  // collapse runs of 3+ identical characters down to 2
  s = s.replace(/(.)\1{2,}/g, '$1$1')
  // normalize whitespace runs to single spaces
  s = s.replace(/\s+/g, ' ').trim()
  return s
}

// ---------------------------------------------------------------------------
// Hard-block vocabulary.
// Matched as SUBSTRINGS of the normalized (boundary-preserving) text, so
// "bullshit" still catches "shit" while "is excellent" never catches "sex".
// ---------------------------------------------------------------------------
const SEXUAL_TERMS = [
  'porn', 'sex', 'sexy', 'nude', 'naked', 'nudes', 'erotic', 'escort',
  'prostitut', 'brothel', 'orgasm', 'genital', 'penis', 'vagina', 'boobs',
  'titties', 'nipple', 'analsex', 'blowjob', 'handjob', 'cumshot', 'horny',
  'fetish', 'bdsm', 'hookup', 'sugar mummy', 'sugarmummy', 'sugar daddy',
  'sugardaddy', 'nudity', 'onlyfans', 'sexchat', 'sext',
]

const PROFANITY_TERMS = [
  'fuck', 'fuk', 'shit', 'bitch', 'bastard', 'asshole', 'dickhead',
  'motherfucker', 'mofo', 'cunt', 'wanker', 'bollocks', 'twat', 'whore',
  'slut', 'dumbass', 'jackass', 'goddamn',
]

const SLUR_TERMS = [
  'nigger', 'nigga', 'faggot', 'retard', 'spastic', 'chink', 'kike',
  'wetback', 'coon', 'tranny',
]

const ILLEGAL_TERMS = [
  'cocaine', 'heroin', 'crack cocaine', 'marijuana', 'weed for sale',
  'drugdealer', 'gunforsale', 'ransom', 'kidnap', '419scam', 'yahoo boy',
  'yahboi', 'bloodmoney', 'ritualkill',
]

// ---------------------------------------------------------------------------
// Boundary-sensitive terms: matched with word boundaries on the RAW text
// because their plain forms are substrings of innocent laundry vocabulary
// ("rape" vs "drapes", "anal" vs "canal", "xxx" vs "xxl/xxxl" sizes).
// ---------------------------------------------------------------------------
const BOUNDARY_PATTERNS: { re: RegExp; category: 'sexual' | 'illegal'; label: string }[] = [
  { re: /\b(rape[sd]?|raping|rapist)\b/i, category: 'sexual', label: 'rape' },
  { re: /\bmolest\w*\b/i, category: 'sexual', label: 'molest' },
  { re: /\banal\b/i, category: 'sexual', label: 'anal' },
  // three or more bare x's ("xxx") — \b stops this matching inside "xxl"/"xxxl"
  { re: /\bx{3,}\b/i, category: 'sexual', label: 'xxx' },
]

// ---------------------------------------------------------------------------
// URL / contact-spam screen (public reviews only)
// ---------------------------------------------------------------------------
const URL_RE = /(https?:\/\/|www\.)\S+/i
const HANDLE_SPAM_RE = /\b(whatsapp|telegram|signal)\s*[-:]?\s*\+?\d[\d\s-]{7,}/i

export interface ModerationResult {
  ok: boolean
  /** Machine-readable category — for logs/admin flags */
  reason?: 'sexual' | 'profanity' | 'slur' | 'illegal' | 'spam'
  /** Human-friendly message safe to show the submitter */
  message?: string
}

const FRIENDLY = {
  sexual:
    'Your message contains content we cannot publish. Please remove any sexual or explicit language and try again.',
  profanity:
    'Please remove the strong language from your message and submit again — we publish reviews that everyone can read.',
  slur: 'Your message contains language we cannot accept. Please rephrase and submit again.',
  illegal:
    'Your message appears to reference illegal activity, so we cannot accept it. Please contact our team by phone if you need help.',
  spam: 'Please remove links or contact details from your message — reviews are for describing your experience.',
}

function checkList(normalized: string, terms: string[]): string | undefined {
  for (const t of terms) {
    const nt = normalizeForModeration(t)
    if (nt && normalized.includes(nt)) return t
  }
  return undefined
}

/**
 * Screen one or more user-submitted text fields (comment, display name,
 * location…). Returns ok=false with a friendly message when any hard-block
 * term is found.
 */
export function moderateText(...fields: (string | null | undefined)[]): ModerationResult {
  const combined = fields.filter(Boolean).join(' \n ')
  if (!combined.trim()) return { ok: true }
  const normalized = normalizeForModeration(combined)

  // Boundary-sensitive terms first (word-boundary on raw text)
  for (const p of BOUNDARY_PATTERNS) {
    if (p.re.test(combined)) {
      return { ok: false, reason: p.category, message: FRIENDLY[p.category] }
    }
  }

  const reason: ModerationResult['reason'] | undefined = checkList(normalized, SLUR_TERMS)
    ? 'slur'
    : checkList(normalized, SEXUAL_TERMS)
      ? 'sexual'
      : checkList(normalized, ILLEGAL_TERMS)
        ? 'illegal'
        : checkList(normalized, PROFANITY_TERMS)
          ? 'profanity'
          : undefined

  if (reason) {
    return { ok: false, reason, message: FRIENDLY[reason] }
  }

  return { ok: true }
}

/**
 * Additional screen for PUBLIC surfaces (testimonial wall candidates):
 * links and instant-messaging handles are spam vectors and never publish.
 */
export function moderatePublicText(...fields: (string | null | undefined)[]): ModerationResult {
  const base = moderateText(...fields)
  if (!base.ok) return base
  const combined = fields.filter(Boolean).join(' \n ')
  if (URL_RE.test(combined) || HANDLE_SPAM_RE.test(combined)) {
    return { ok: false, reason: 'spam', message: FRIENDLY.spam }
  }
  return { ok: true }
}
