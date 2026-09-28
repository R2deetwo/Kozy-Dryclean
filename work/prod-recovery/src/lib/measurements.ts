// =============================================================================
// measurements.ts — the measurement guide data model (Phase 18, client
// directive: "some people don't know how to measure themselves... there
// should be some kind of mini tutorial... allows men and women to be able
// to measure themselves, or their children").
// =============================================================================
// The guide educates customers for free (Charles Tyrwhitt-style) and lets
// them SAVE their measurements so alterations requests don't need the same
// numbers typed out every time ("if they want alterations, they don't have
// to put their size in all the time").
// Saved values live in localStorage — private to the customer's browser,
// no account required. The booking wizard can attach them to the
// seamstress note.
// =============================================================================

export type MeasurementCategory = 'men' | 'women' | 'children'

export interface MeasurementDef {
  id: string
  label: string
  /** plain-English "what is this" */
  tagline: string
  /** step-by-step how to take it */
  howTo: string[]
  /** what the seamstress uses it for */
  why: string
  /** the classic mistake people make */
  mistake?: string
}

export interface SavedMeasurements {
  profile: MeasurementCategory
  unit: 'cm' | 'in'
  values: Record<string, string>
  savedAt: string // ISO date
}

export const STORAGE_KEY = 'kozy-saved-measurements-v1'

// ---------------------------------------------------------------------------
// The measurement catalogue
// ---------------------------------------------------------------------------
export const MEASUREMENTS: Record<MeasurementCategory, MeasurementDef[]> = {
  men: [
    {
      id: 'neck',
      label: 'Neck',
      tagline: 'Where your collar sits — the base of the neck, not the Adam\u2019s apple.',
      howTo: [
        'Stand relaxed and look straight ahead.',
        'Wrap the tape around the base of your neck, just above where a shirt collar would rest.',
        'Keep one finger under the tape so it is snug but not tight.',
        'Note the number where the tape meets the start.',
      ],
      why: 'Shirt collars, agbada and kaftan necklines. Even half a centimetre here changes how a collar feels all day.',
      mistake: 'Tilting your chin down — it shortens the neck and shrinks the measurement. Keep your head level.',
    },
    {
      id: 'chest',
      label: 'Chest',
      tagline: 'The fullest part of your chest, measured under the arms and across the shoulder blades.',
      howTo: [
        'Stand with arms relaxed at your sides — do not flex or puff up.',
        'Wrap the tape under your armpits and across the fullest part of your chest.',
        'Make sure the tape crosses your shoulder blades at the same height at the back.',
        'Breathe normally and read the number — do not exhale hard first.',
      ],
      why: 'Shirts, kaftans, blazers and any take-in or let-out work on the body of a garment.',
      mistake: 'Raising your arms while measuring — it widens the chest unrealistically. Keep arms down and let a helper place the tape.',
    },
    {
      id: 'waist',
      label: 'Natural waist',
      tagline: 'The narrowest part of your torso — usually just above the navel. NOT where your trousers sit.',
      howTo: [
        'Find the narrowest point: bend gently to one side and note where your body creases.',
        'Wrap the tape around that point, keeping it level all the way round.',
        'Keep the tape snug — you should be able to slide one finger under it.',
        'Relax your stomach completely before you read the number.',
      ],
      why: 'Waist adjustments, trouser take-ins and fitted traditional wear. This is the number your seamstress quotes waist work from.',
      mistake: 'Measuring where low-rise trousers actually sit, which is several centimetres below the natural waist — and sucking your stomach in.',
    },
    {
      id: 'seat',
      label: 'Seat / hips',
      tagline: 'The fullest part around your bottom and hips, feet together.',
      howTo: [
        'Stand with your feet together and weight even on both legs.',
        'Wrap the tape around the fullest part of your seat.',
        'Check in a mirror (or ask your helper) that the tape stays level.',
        'Read the number without clenching.',
      ],
      why: 'Trouser seat fit, tapering, and making sure adjustments at the waist do not pull at the hips.',
    },
    {
      id: 'shoulder',
      label: 'Shoulder width',
      tagline: 'Across your back, from the bony point at the end of one shoulder to the other.',
      howTo: [
        'Stand up straight with arms relaxed.',
        'Ask a helper to find the small bony ledge at the end of each shoulder.',
        'Measure straight across your back from one point to the other.',
        'Keep the tape flat against the back — do not let it arc over the shoulder blades.',
      ],
      why: 'Shirts, blazers and agbada. A shoulder seam that is off by a little makes the whole garment look borrowed.',
      mistake: 'Measuring over the chest instead of the back — the front route reads narrower.',
    },
    {
      id: 'sleeve',
      label: 'Sleeve length',
      tagline: 'From the shoulder bone, over a slightly bent elbow, down to the wrist bone.',
      howTo: [
        'Relax one arm and bend it slightly, as if reaching for a handshake.',
        'Start the tape at the bony point at the end of your shoulder.',
        'Run it over the outside of your elbow, down to the knobbly wrist bone.',
        'Measure both arms — most people have one arm slightly longer.',
      ],
      why: 'Sleeve shortening and lengthening — the single most common alteration we do on shirts and blazers.',
    },
    {
      id: 'inseam',
      label: 'Inseam',
      tagline: 'From the highest point of your inner thigh straight down to where you want the trouser hem.',
      howTo: [
        'Wear your best-fitting trousers and stand straight.',
        'Measure from the crotch seam down the inner leg to the hem.',
        'Or measure your body: from the top of the inner thigh to the floor, then subtract to where you want the break.',
        'For jeans, hem slightly longer; for formal trousers, the hem should kiss the top of your shoe.',
      ],
      why: 'Hemming and re-hemming trousers. Give us this number and say which garment it came from.',
    },
  ],

  women: [
    {
      id: 'bust',
      label: 'Bust',
      tagline: 'The fullest part of your bust, tape parallel to the floor, arms relaxed down.',
      howTo: [
        'Wear your usual, unpadded bra and stand with arms at your sides.',
        'Wrap the tape around the fullest part of the bust.',
        'Check that the tape is level across the back — a mirror or helper helps.',
        'Breathe normally and read the number without compressing.',
      ],
      why: 'Dresses, blouses, kaftans and any bodice work. This is your fullest-point number, not your bra band size.',
      mistake: 'Confusing the bust measurement with the bra band size — the band is measured under the bust (see next).',
    },
    {
      id: 'underbust',
      label: 'Underbust',
      tagline: 'Snug around your ribcage, directly under the bust — where a bra band sits.',
      howTo: [
        'Wrap the tape around your ribcage, immediately under the bust.',
        'Keep it snug and level all the way round.',
        'Exhale normally — do not hold your breath.',
        'This number is usually 5\u201310\u2009cm less than your bust.',
      ],
      why: 'Fitted bodices, dresses with waist seams, and checking whether a garment should be sized up or taken in.',
    },
    {
      id: 'waist',
      label: 'Natural waist',
      tagline: 'The narrowest part of your torso — usually just above the navel. Your waist is NOT your hips.',
      howTo: [
        'Bend gently to one side — the crease that forms is your natural waistline.',
        'Wrap the tape around that point, level all the way round.',
        'Keep it snug with one finger of ease; relax your tummy.',
        'Read the number — do not pull the tape tight to flatter yourself.',
      ],
      why: 'Waistbands, dress take-ins, skirts and iro & buba adjustments. Almost every alteration starts from the natural waist.',
      mistake: 'Measuring at the hips (where low-rise jeans sit) — that number can be 10\u201315\u2009cm bigger than the natural waist.',
    },
    {
      id: 'hips',
      label: 'Hips',
      tagline: 'The fullest part of your hips and bottom — usually about 20\u2009cm below your natural waist.',
      howTo: [
        'Stand with feet together and weight even.',
        'Wrap the tape around the fullest part of your hips and seat.',
        'Keep the tape level — check in a mirror or ask a helper.',
        'Read the number while standing normally.',
      ],
      why: 'Skirts, dresses and trousers. A waist taken in without the hip number can pull or crease at the sides.',
    },
    {
      id: 'shoulder',
      label: 'Shoulder width',
      tagline: 'Across the back, from the bony end of one shoulder to the other.',
      howTo: [
        'Stand straight with arms relaxed at your sides.',
        'Have a helper find the small bony ledge at each shoulder\u2019s end.',
        'Measure straight across the back between the two points.',
        'Keep the tape flat, not arcing over the shoulder blades.',
      ],
      why: 'Blouses, blazers and fitted dresses — the shoulder seam is the anchor every other line hangs from.',
    },
    {
      id: 'sleeve',
      label: 'Sleeve length',
      tagline: 'From the shoulder bone over a slightly bent elbow to the wrist bone.',
      howTo: [
        'Bend one arm slightly, as if offering a handshake.',
        'Start at the bony shoulder point.',
        'Run the tape over the elbow down to the wrist bone.',
        'Repeat on the other arm — small differences are normal.',
      ],
      why: 'Sleeve shortening on blouses, blazers and kaftan sleeves that swallow the wrist.',
    },
    {
      id: 'length',
      label: 'Dress / skirt length',
      tagline: 'From the shoulder at the neck, straight down the front to where the hem should fall.',
      howTo: [
        'Stand straight in front of a mirror.',
        'Start the tape at the hollow of your neck, at the top of the sternum.',
        'Run it straight down the front over the bust to the point where you want the hem.',
        'For skirts without a bodice, measure from the natural waist down instead.',
      ],
      why: 'Hemming dresses, gowns and skirts — the difference between "just above the knee" and "tea length" is one clear number.',
    },
  ],

  children: [
    {
      id: 'height',
      label: 'Height',
      tagline: 'Standing straight against a wall, without shoes — the master measurement for children\u2019s wear.',
      howTo: [
        'Have the child stand against a wall, heels together, no shoes.',
        'Heels, bottom, shoulders and head all touching the wall.',
        'Look straight ahead — no tiptoes!',
        'Mark the top of the head with a pencil laid flat, then measure from the floor to the mark.',
      ],
      why: 'Children\u2019s garments are sized primarily by height — most other numbers follow from it.',
      mistake: 'Letting the child stretch up or lift their heels. Make it a game: "stand like a soldier".',
    },
    {
      id: 'chest',
      label: 'Chest',
      tagline: 'Under the arms, around the fullest part of the chest.',
      howTo: [
        'Child stands relaxed with arms slightly out.',
        'Wrap the tape under the armpits around the fullest part of the chest.',
        'Keep the tape level at the back.',
        'Ask the child to breathe normally — story time helps.',
      ],
      why: 'School uniforms, kaftans, shirts and any chest take-in.',
    },
    {
      id: 'waist',
      label: 'Waist',
      tagline: 'The natural waistline — ask the child to bend sideways; the crease is the waist.',
      howTo: [
        'Ask the child to bend gently to one side — the crease that appears is the natural waist.',
        'Wrap the tape around that point over light clothing.',
        'Keep it snug but comfortable — one finger should slide under.',
        'Round to the nearest centimetre.',
      ],
      why: 'Trousers, skirts and pinafores with adjustable or fixed waists.',
    },
    {
      id: 'hips',
      label: 'Hips',
      tagline: 'Around the fullest part, feet together.',
      howTo: [
        'Child stands with feet together.',
        'Wrap the tape around the fullest part of the hips and bottom.',
        'Keep the tape level and read while the child stands still.',
      ],
      why: 'Shorts, trousers and skirts — and checking growth room at the hips.',
    },
    {
      id: 'sleeve',
      label: 'Sleeve',
      tagline: 'Shoulder bone to wrist bone, arm slightly bent.',
      howTo: [
        'Child holds the arm slightly bent, palm up.',
        'Measure from the bony shoulder point over the elbow to the wrist bone.',
        'Add 1\u2009cm of growing room for school uniforms.',
      ],
      why: 'Uniform shirts and sweaters — sleeves that are right today are too short by next term.',
    },
    {
      id: 'inseam',
      label: 'Inside leg',
      tagline: 'From the crotch to where the trouser hem should fall.',
      howTo: [
        'Measure from the highest point of the inner thigh down to the ankle bone.',
        'Or measure a well-fitting pair of trousers along the inner seam.',
        'Ask for a "growth hem" — we hem with extra fabric tucked inside that can be let down later.',
      ],
      why: 'School trousers and shorts — the growth hem is the single best money-saver in children\u2019s alterations.',
    },
  ],
}

export const CATEGORY_META: Record<
  MeasurementCategory,
  { label: string; blurb: string }
> = {
  men: {
    label: 'For men',
    blurb: 'Shirts, trousers, agbada and blazers — the seven numbers that cover almost every men\u2019s alteration.',
  },
  women: {
    label: 'For women',
    blurb: 'Dresses, blouses, skirts and iro & buba — including the waist-vs-hips difference that trips everyone up.',
  },
  children: {
    label: 'For children',
    blurb: 'Uniforms and growing bodies — plus the growth-hem trick that makes alterations last twice as long.',
  },
}

// ---------------------------------------------------------------------------
// localStorage persistence
// ---------------------------------------------------------------------------

export function loadSavedMeasurements(): SavedMeasurements | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SavedMeasurements
    if (!parsed || !parsed.profile || typeof parsed.values !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

export function saveMeasurementsToStorage(m: SavedMeasurements): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(m))
  } catch {
    // private mode / storage full — silently ignore; the guide still works
  }
}

export function clearSavedMeasurements(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

/** True if at least one meaningful value is stored. */
export function hasValues(m: SavedMeasurements | null): m is SavedMeasurements {
  if (!m) return false
  return Object.values(m.values).some((v) => v && v.trim().length > 0)
}

/**
 * Format saved measurements into a compact snippet the customer can attach
 * to the seamstress note at booking, e.g.:
 *   My measurements (for alterations): chest 102 cm, natural waist 88 cm, ...
 */
export function formatMeasurementsForNote(m: SavedMeasurements): string {
  const defs = MEASUREMENTS[m.profile] ?? []
  const parts: string[] = []
  for (const d of defs) {
    const v = m.values?.[d.id]?.trim()
    if (v) parts.push(`${d.label.toLowerCase()} ${v}${m.unit}`)
  }
  if (!parts.length) return ''
  const date = new Date(m.savedAt)
  const when = !Number.isNaN(date.getTime())
    ? date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : ''
  return `My measurements (${m.profile}, ${when}): ${parts.join(', ')}. `
}
