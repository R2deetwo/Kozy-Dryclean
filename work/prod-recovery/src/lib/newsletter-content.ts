// =============================================================================
// Newsletter content library — 52 weeks of ready-to-send material (phase 40)
// =============================================================================
// A full year of newsletter content for the Kozy Care marketing engine,
// written for a Lagos audience and sequenced to the Nigerian year:
// harmattan whites, Valentine, Easter, rainy season, Children's Day,
// back-to-school, Independence, the Oct–Dec wedding/Owambe circuit and
// Detty December.
//
// TIMING RULES (phase 66, per the owner):
//   - SEASONAL EMAILS LAND BEFORE THEIR EVENT, never after: Independence
//     prep sits in week 39 (late September), the Valentine pushes in weeks
//     6–7, Christmas prep in week 48, the Detty December playbook in week
//     50 — each says what is COMING, never what already passed.
//   - DETTY DECEMBER STARTS ON DECEMBER 15 and runs into the new year —
//     prep emails must say the date explicitly; nothing before the week of
//     the 15th may claim the season has OPENED (only week 51 onwards may).
//   - CALENDAR SYNC: the automation engine picks the entry matching the
//     send slot's ISO calendar week (getNewsletterEntryForDate) — content
//     follows the calendar, so a seasonal email can never drift onto an
//     off-season date.
//
// The engine (Marketing tab → "Your newsletter engine") turns these into
// draft campaigns on the owner's cadence — the owner previews, edits if
// they like, and approves each send. Nothing goes out without approval.
//
// Writing rules encoded here:
//   - plain text in the phase-37 composer format (blank line = paragraph,
//     **bold**, pasted links become buttons)
//   - no invented testimonials, customer names or statistics — stories are
//     "how we work" narratives, never fabricated social proof
//   - only standing offers are referenced (10% off your first clean,
//     HOTEL15 for hotels & corporate) — anything stronger is phrased as a
//     pointer for the owner to create a coupon in Marketing → Coupons
//   - subject lines are short and human, like a message from a person
// =============================================================================

export type NewsletterCategory = 'TIP' | 'PROMO' | 'SERVICE' | 'STORY' | 'SEASONAL'

export interface NewsletterEntry {
  /** 1-52 — position in the year (weeks 1-4 ≈ January, etc.) */
  week: number
  /** Rough seasonal anchor, e.g. 'Early January' */
  season: string
  category: NewsletterCategory
  /** Internal label — becomes the campaign name */
  title: string
  /** The email subject line customers see */
  subject: string
  /** Banner image slug (file: /marketing/banners/banner-<slug>.jpg) */
  banner: string
  /** The message body in plain-text composer format */
  bodyText: string
}

export const NEWSLETTER_BANNERS: { slug: string; label: string }[] = [
  { slug: 'hero-navy-gold', label: 'Kozy classic — navy & gold silk' },
  { slug: 'promo-gold', label: 'Promo — gold confetti' },
  { slug: 'tips-fabric', label: 'Tips — crisp white fabric' },
  { slug: 'service-express', label: 'Express — gold speed lines' },
  { slug: 'service-pickup', label: 'Pickup — hanging garments' },
  { slug: 'corporate-navy', label: 'Corporate — shirts & suits' },
  { slug: 'seasonal-newyear', label: 'New Year — gold fireworks' },
  { slug: 'seasonal-valentine', label: 'Valentine — red & gold ribbon' },
  { slug: 'seasonal-easter', label: 'Easter — cream & gold festive' },
  { slug: 'seasonal-eid', label: 'Eid — green & gold lanterns' },
  { slug: 'seasonal-independence', label: 'Independence — green & white' },
  { slug: 'seasonal-christmas', label: 'Christmas — gold & red ornaments' },
  { slug: 'seasonal-owambe', label: 'Owambe — gold aso-oke lace' },
]

export const NEWSLETTER_LIBRARY: NewsletterEntry[] = [
  // ------------------------------------------------------------------ JANUARY
  {
    week: 1,
    season: 'Early January',
    category: 'SEASONAL',
    title: 'New Year — fresh wardrobe start',
    subject: 'New year. Fresh clothes. Clean start. 🎉',
    banner: 'seasonal-newyear',
    bodyText:
      'As the year turns: a fresh one deserves a fresh wardrobe. The December parties are over (or very nearly) — and somewhere in there is a favourite outfit that saw one party too many.\n\nBring it in this week and we will return it looking like January just gave it a new life.\n\n**Free pickup and delivery** — you do not even have to leave the house.\n\nhttps://kozycare.ng\n\nTo a spotless year ahead!',
  },
  {
    week: 2,
    season: 'Early January',
    category: 'TIP',
    title: 'Harmattan dust vs white fabrics',
    subject: 'Harmattan is winning. Your whites can still win.',
    banner: 'tips-fabric',
    bodyText:
      'Harmattan dust is in the air — and it settles on everything, especially white agbada, white shirts and white bedsheets.\n\nThree small habits that help:\n\n1. **Hang whites away from open windows** — dust loves a direct breeze.\n2. **Air them in the evening**, not midday, when the dust is heaviest.\n3. **Wash, do not brush** — brushing dry dust into fabric pushes it deeper into the weave.\n\nWhen home care is not enough, that is our department. We lift harmattan grey out of whites without yellowing them.\n\nBook a pickup: https://kozycare.ng',
  },
  {
    week: 3,
    season: 'Mid January',
    category: 'PROMO',
    title: 'First clean of the year — 10% off',
    subject: '10% off your first clean of the year',
    banner: 'promo-gold',
    bodyText:
      'Still have not sent anything in this year?\n\nHere is a little push: **10% off your first premium clean** — the same offer we give first-time customers, working for your first order of the year.\n\nAgbada, suits, shirts, everyday clothes — collected at your door, cleaned properly, and returned on a day you choose.\n\nTap here to book in under two minutes: https://kozycare.ng\n\nThe offer applies automatically to your first order — nothing to type.',
  },
  {
    week: 4,
    season: 'Mid January',
    category: 'SERVICE',
    title: 'Express — 24 hour turnaround',
    subject: 'Need it tomorrow? Express has you.',
    banner: 'service-express',
    bodyText:
      'Some weeks do not give you three days\' notice.\n\nThat is why Kozy Care has **Express — from 24 hours**. The shirt you need for tomorrow\'s meeting. The outfit for the event that moved forward. We collect today, you have it back tomorrow, pressed and ready.\n\nHow it works:\n\n- Book before noon for same-day collection\n- Choose Express when booking\n- We handle the rest — you just wear it\n\nhttps://kozycare.ng\n\nNext time the calendar surprises you, remember this email.',
  },
  {
    week: 5,
    season: 'Late January',
    category: 'STORY',
    title: 'A day on the pickup route',
    subject: 'What your driver actually does all morning',
    banner: 'service-pickup',
    bodyText:
      'Ever wondered what happens after you tap "Book pickup"?\n\nYour driver\'s morning starts at 7am with a route built around YOUR address and time window — Lekki to Ogombo to Chevron, timed against traffic, not against the clock.\n\nEvery garment is scanned in at collection, so nothing is ever "the bag on the third shelf". It travels in sealed covers. It is inspected, tagged, and matched back to you before it ever returns.\n\nAll of that, and you never left your house.\n\nThat is the whole idea: https://kozycare.ng',
  },
  // ----------------------------------------------------------------- FEBRUARY
  {
    week: 6,
    season: 'Early February',
    category: 'SEASONAL',
    title: 'Valentine outfits ready',
    subject: 'Date night is coming. Your outfit should behave.',
    banner: 'seasonal-valentine',
    bodyText:
      'Valentine\'s week is almost here — and somewhere a dinner table is being booked right now.\n\nDo not let the outfit be the last thing you think about. That dress, that shirt, that outfit that makes you feel your best — bring it in early and we will have it pressed, fresh and ready before the 14th.\n\n**Express is available** if you are reading this late. (No judgement.)\n\nBook your pickup: https://kozycare.ng\n\nWhatever you are wearing, have a lovely Valentine\'s.',
  },
  {
    week: 7,
    season: 'Valentine week',
    category: 'PROMO',
    title: 'Valentine couples push',
    subject: 'Two outfits, one pickup, zero stress',
    banner: 'seasonal-valentine',
    bodyText:
      'Valentine\'s week is here — and it is our busiest pickup week of the first quarter. Couples sending date-night outfits together, all at once.\n\nA kind reminder:\n\n**Book your pickup early this week.** The closer to the 14th, the fuller the route gets.\n\nOne pickup takes both outfits. One delivery brings them back pressed, on a day you choose — ready for dinner.\n\nhttps://kozycare.ng\n\n(And if you are single and thriving? Your best shirt deserves the same energy.)',
  },
  {
    week: 8,
    season: 'Mid February',
    category: 'TIP',
    title: 'Lipstick and wine stains',
    subject: 'So the date went well. The outfit kept the receipts.',
    banner: 'tips-fabric',
    bodyText:
      'The morning-after guide, stain edition:\n\n**Lipstick on a collar** — do not rub. Dab gently with a little makeup remover on cotton wool, then leave the rest to a proper clean.\n\n**Wine on a dress** — cold water only, never hot. Hot water cooks the pigment into the fibre. Blot from the edge inward so the stain does not spread.\n\n**Perfume on silk** — stop everything and bring it to us. Silk punishes home experiments.\n\nThe rule under all three: **blot, do not scrub.**\n\nAnd when in doubt — https://kozycare.ng — we handle the rest.',
  },
  {
    week: 9,
    season: 'Late February',
    category: 'STORY',
    title: 'What "premium drycleaning" means',
    subject: 'Washed vs drycleaned — the honest difference',
    banner: 'hero-navy-gold',
    bodyText:
      'People ask us this a lot, so here is the honest answer.\n\n**Washing** uses water and detergent. Great for cotton shirts and everyday clothes.\n\n**Drycleaning** uses specialised solvents instead of water — the reason your agbada keeps its shape, your suit keeps its structure, and that aso-oke keeps its colours and texture. Water is what shrinks, fades and dulls them.\n\nWe choose the process per garment — fabric, colour, lining, trim — not per price list.\n\nThat is the whole difference. Your clothes notice, even when you cannot name it.\n\nhttps://kozycare.ng',
  },
  // ------------------------------------------------------------------- MARCH
  {
    week: 10,
    season: 'Early March',
    category: 'TIP',
    title: 'Rainy season wardrobe prep',
    subject: 'The rains are coming. Is your wardrobe ready?',
    banner: 'hero-navy-gold',
    bodyText:
      'March is when Lagos starts changing its mind about the weather.\n\nBefore the rains settle in, do a fifteen-minute wardrobe check:\n\n- **Air everything once** — the last harmattan dust should not sleep in your closet till October\n- **Send the heavy pieces now** — agbada, suits, coats cleaned BEFORE storage, not after\n- **Check for damp corners** — a musty smell in a wardrobe is an early warning\n\nClean clothes store better. Dirty clothes invite the moths and the mildew.\n\nBook a pre-rainy-season pickup: https://kozycare.ng',
  },
  {
    week: 11,
    season: 'Early March',
    category: 'SERVICE',
    title: 'Hotels & corporate garment program',
    subject: 'For hotels & offices — laundry that scales with you',
    banner: 'corporate-navy',
    bodyText:
      'A quick note for our business readers.\n\nKozy Care works with hotels, guest houses and offices across Lagos on a simple model:\n\n- **Scheduled collections** — same days every week, you plan around them\n- **Volume-friendly processing** — linens, uniforms, staff wear, guest garments\n- **One monthly invoice** — no per-item accounting on your side\n\nIf your current arrangement is "somebody manages it somehow", we are the cleaner, tidier answer.\n\n**Hotels & corporate clients get standing rates — 15% off plus 5% online, with code HOTEL15.**\n\nTalk to us: https://kozycare.ng',
  },
  {
    week: 12,
    season: 'Mid March',
    category: 'TIP',
    title: 'Perfume and fabric',
    subject: 'Why your favourite perfume fades your clothes',
    banner: 'tips-fabric',
    bodyText:
      'A quiet wardrobe truth: the perfume you spray on yourself lands on your clothes too — and over months, sprays build up a film that dulls fabric and attracts dust.\n\nTwo easy habits:\n\n1. **Spray before you dress** — let the mist settle on skin, not on silk and chiffon\n2. **Air worn clothes before re-hanging** — do not return fragrant, worn clothes straight into a closed closet\n\nEvery Kozy clean finishes with proper fabric care, so build-up comes out with us.\n\nhttps://kozycare.ng',
  },
  {
    week: 13,
    season: 'Late March',
    category: 'PROMO',
    title: 'HOTEL15 reminder for businesses',
    subject: 'HOTEL15 — the code for hotels & offices',
    banner: 'corporate-navy',
    bodyText:
      'Quick reminder for businesses on this list:\n\n**Code HOTEL15 gets hotels & corporate clients 15% off plus 5% online.**\n\nUniforms, linens, guest laundry, management attire — collected on schedule, processed properly, invoiced monthly.\n\nIf you run a hotel, guest house, restaurant or office in Lagos and your laundry situation is held together by "the guy who comes on Tuesdays" — this is your upgrade path.\n\nTry one week with us: https://kozycare.ng\n\nThe code works on every order, so there is no rush. But your Tuesdays guy will not improve with time.',
  },
  // ------------------------------------------------------------------- APRIL
  {
    week: 14,
    season: 'Early April',
    category: 'SEASONAL',
    title: 'Easter Sunday best',
    subject: 'Easter Sunday is coming — send the outfit early',
    banner: 'seasonal-easter',
    bodyText:
      'Easter is around the corner, and you already know how this goes: everyone sends their Sunday best in the same three days.\n\nBeat the rush — **book your pickup this week** and your outfit will be cleaned, pressed and back with you days before Sunday.\n\nWhether it is the agbada, the lace, the kaftan or the children\'s outfits — one pickup covers the whole family.\n\nhttps://kozycare.ng\n\nHappy Easter from the Kozy Care family to yours.',
  },
  {
    week: 15,
    season: 'Mid April',
    category: 'TIP',
    title: 'Mud splash on whites',
    subject: 'First rains, first mud splash. Here is what to do.',
    banner: 'tips-fabric',
    bodyText:
      'The first rains of the year have a tradition: finding the whitest thing you own.\n\nIf mud splashes your whites:\n\n1. **Let it dry completely first.** Wet mud smears; dry mud crumbles off.\n2. Brush off what you can, then **rinse with cold water from the inside out** — pushing the dirt back the way it came.\n3. Do not attack it with hot water — it sets the colour of the mud into the fibre.\n\nFor bright whites after a muddy season, a professional whitening process beats home bleach (which yellows over time).\n\nhttps://kozycare.ng',
  },
  {
    week: 16,
    season: 'Mid April',
    category: 'SERVICE',
    title: 'Gele and aso-oke care',
    subject: 'Your gele deserves better than a drawer',
    banner: 'seasonal-owambe',
    bodyText:
      'Traditional fabrics are an investment — and they punish rough handling.\n\nAt Kozy Care, gele, aso-oke, lace and embroidered fabrics get a gentler lane:\n\n- **Handled by process, not by machine** — delicate treatment suited to the weave\n- **Colour-safe care** — the deep hues that make aso-oke beautiful stay deep\n- **Careful finishing** — structure and texture preserved, not flattened\n\nThe wrapper you tie with pride should come back with the same pride intact.\n\nSend yours with the next pickup: https://kozycare.ng',
  },
  {
    week: 17,
    season: 'Late April',
    category: 'STORY',
    title: 'The 5-step garment journey',
    subject: 'The journey of one shirt (it is more than you think)',
    banner: 'service-pickup',
    bodyText:
      'Follow one shirt through Kozy Care:\n\n**1. Collection** — scanned at your door, so it is never "the bag on the shelf".\n\n**2. Inspection** — collar, cuffs, buttons, stains; we note what we see before anything touches it.\n\n**3. The right process** — chosen for its fabric, colour and construction.\n\n**4. Finishing** — pressed with attention to how it will actually be worn.\n\n**5. Return** — sealed, scanned, and delivered on the day you picked.\n\nFive steps, every garment, every time. That is the quiet difference people keep coming back for.\n\nhttps://kozycare.ng',
  },
  // --------------------------------------------------------------------- MAY
  {
    week: 18,
    season: 'Early May',
    category: 'SEASONAL',
    title: 'Workers\' Day — work wardrobe refresh',
    subject: 'Workers\' Day — your work clothes work hard too',
    banner: 'corporate-navy',
    bodyText:
      'Happy Workers\' Day from Kozy Care!\n\nYour work clothes put in more hours than almost anything else you own. Monday to Friday, dry season to rainy season, they show up.\n\nThis month, let them get the professional treatment back: shirts pressed crisp, suits refreshed, weekly pickup on your schedule.\n\n**A weekly shirt plan is the quiet upgrade** — five fresh shirts every Monday, without you thinking about laundry once.\n\nhttps://kozycare.ng\n\nHere is to the work you do — and the clothes that do it with you.',
  },
  {
    week: 19,
    season: 'Mid May',
    category: 'TIP',
    title: 'Sweat and humid season',
    subject: 'Humidity season: the underarm situation',
    banner: 'tips-fabric',
    bodyText:
      'Let us talk about something every Lagos wardrobe knows: the humid-season underarm situation.\n\nSweat mixed with antiperspirant is what yellows shirts — not sweat alone. The build-up needs a proper stain-lifting process, not more detergent (which mostly re-deposits it).\n\nThree habits that genuinely help:\n\n- **Air shirts before the basket** — do not let sweat dry inside a pile\n- **Rotate, do not re-wear** — the same shirt two days running doubles the build-up\n- **Send them in before the yellow sets** — fresh stains lift; old ones settle\n\nWe restore whites for a living: https://kozycare.ng',
  },
  {
    week: 20,
    season: 'Late May',
    category: 'SEASONAL',
    title: 'Children\'s Day — uniforms',
    subject: 'Children\'s Day — small clothes, proper care',
    banner: 'hero-navy-gold',
    bodyText:
      'Children\'s Day is coming up — and if there is one thing parents know, it is that children\'s clothes work harder than anything in the house.\n\nUniforms, church clothes, party outfits — grass stains, palm oil, biro ink, the unexplainable. We clean children\'s wear with the same fabric-first care as everything else, because their favourite outfit matters as much as your best one.\n\n**A term of fresh uniforms is easier than you think** — send them in batches with your regular pickup.\n\nhttps://kozycare.ng\n\nHappy Children\'s Day to the small people who ruin clothes beautifully!',
  },
  {
    week: 21,
    season: 'Late May',
    category: 'PROMO',
    title: 'Mid-year offer push',
    subject: 'Half the year gone — how is the wardrobe doing?',
    banner: 'promo-gold',
    bodyText:
      'The year is nearly half done. Quick question: when did you last send in something that is not a weekly shirt?\n\nThe mid-year wardrobe audit:\n\n- One suit that deserves a proper refresh\n- One traditional outfit waiting for "an occasion"\n- Bedsheets and duvets that have quietly gone grey\n\n**Send all three in one pickup this week.** You will be surprised what a mid-year reset does for the whole house.\n\nhttps://kozycare.ng',
  },
  // -------------------------------------------------------------------- JUNE
  {
    week: 22,
    season: 'Late May',
    category: 'TIP',
    title: 'How to air clothes properly',
    subject: 'Airing clothes — the 10-minute habit',
    banner: 'hero-navy-gold',
    bodyText:
      'Not every worn garment needs washing — but every worn garment needs air.\n\nThe ten-minute habit:\n\n**Hang worn clothes in open air** (balcony, doorway, anywhere with movement) **for 30–60 minutes before returning them to the wardrobe.** Body moisture escapes, odours lift, and the garment earns another wear.\n\nWhy it matters: clothes returned warm and worn into a dark closet is exactly how "that smell" starts.\n\nWool, suits and agbada especially thrive on airing between wears — it is the closest thing to a free refresh.\n\nhttps://kozycare.ng',
  },
  {
    week: 23,
    season: 'Mid June',
    category: 'TIP',
    title: 'Mold and mildew prevention',
    subject: 'That musty smell — stop it before it starts',
    banner: 'tips-fabric',
    bodyText:
      'Rainy season mould is sneaky: it does not announce itself until the smell is already in your clothes.\n\nPrevention beats removal, every time:\n\n1. **Never store anything slightly damp.** Dry completely, always.\n2. **Leave breathing space** in the wardrobe — clothes jammed together trap moisture.\n3. **Air the wardrobe weekly** — open it wide for an hour in dry weather.\n4. **Camphor or cedar blocks**, placed properly, protect what matters.\n\nIf the mustiness has already moved in, we deodorise and freshen as part of a proper clean — mould spores need professional handling.\n\nhttps://kozycare.ng',
  },
  {
    week: 24,
    season: 'Democracy Day week',
    category: 'SEASONAL',
    title: 'Democracy Day note',
    subject: 'Democracy Day — small businesses, big hearts',
    banner: 'hero-navy-gold',
    bodyText:
      'Happy Democracy Day!\n\nWe will keep this one short. Kozy Care is a Nigerian business, built and run here — every pickup, every press, every delivery is work done by people in this economy.\n\nOn a day like this, we just want to say thank you. Your patronage is what keeps a small Lagos business growing.\n\nIf there is anything we can do better — reply to this email. A real person reads it.\n\nhttps://kozycare.ng',
  },
  {
    week: 25,
    season: 'Late June',
    category: 'SERVICE',
    title: 'Travel-ready pressing',
    subject: 'Travelling? Pack clothes that arrive ready',
    banner: 'service-express',
    bodyText:
      'Nothing kills a trip\'s first evening like a suitcase full of creased clothes.\n\nBefore your next travel:\n\n- **Send travel outfits in for pressing** — we finish them for folding, not for hanging\n- **Express from 24 hours** if the flight came up suddenly\n- **Duvets and home linens** can go in the same pickup — come back to a fresh house\n\nBusiness trip, family visit, holiday — the version of you that steps off the plane should look like you planned it.\n\nBook before you pack: https://kozycare.ng',
  },
  // --------------------------------------------------------------------- JULY
  {
    week: 26,
    season: 'Early July',
    category: 'TIP',
    title: 'Mid-year wardrobe audit',
    subject: '5 questions for your wardrobe this weekend',
    banner: 'hero-navy-gold',
    bodyText:
      'The year has turned past its halfway mark — a good weekend for a fifteen-minute wardrobe audit.\n\nFive honest questions:\n\n1. Which clothes have I not worn **since January** — and why?\n2. Which favourites are quietly losing their shape or colour?\n3. Is anything waiting for "an occasion" that already passed?\n4. What smells slightly musty when the wardrobe opens?\n5. What would I actually miss if it disappeared?\n\nEverything that deserves a second chance goes into one pickup. The rest can finally move on.\n\nhttps://kozycare.ng',
  },
  {
    week: 27,
    season: 'Early July',
    category: 'SERVICE',
    title: 'Suit care — what we do differently',
    subject: 'Your suit deserves more than "wash am well well"',
    banner: 'corporate-navy',
    bodyText:
      'A good suit is structure: canvas, wool, shaping, a shoulder that was built on purpose.\n\nWater and rough handling are exactly what unpick all of that. That is why suits get:\n\n- **Drycleaning, not washing** — solvent care that lifts oil and dirt without swelling the fibres\n- **Pressed on form**, not flattened — the shape that made you buy it comes back\n- **A rest between wears** — wool recovers; give each suit 48 hours off\n\nOne refresh can add years to a suit you already love.\n\nSend it with the next pickup: https://kozycare.ng',
  },
  {
    week: 28,
    season: 'Mid July',
    category: 'PROMO',
    title: 'July offer push',
    subject: 'The July refresh — your wardrobe will thank you',
    banner: 'promo-gold',
    bodyText:
      'July is the quiet middle of the year — which makes it the perfect time to handle the things you have been postponing since March.\n\nOur suggestion for this week:\n\n- **The suit** that has "one more wear" left in it before it needs proper care\n- **The duvet** — you cannot remember when it was last cleaned, can you?\n- **The children\'s wardrobe** — deep-cleaned before the new term sneaks up\n\nAll in one free pickup.\n\nhttps://kozycare.ng',
  },
  {
    week: 29,
    season: 'Late July',
    category: 'STORY',
    title: 'Why we check every pocket',
    subject: 'The biro, the ₦500, and other pocket stories',
    banner: 'service-pickup',
    bodyText:
      'Before any garment is processed at Kozy Care, it goes through a pocket check — every pocket, every time.\n\nIt is one of those small habits nobody notices until it saves something that matters: the biro that would have exploded across a white shirt. The cash. The earpiece. The ring left in a jacket pocket after an event.\n\nEverything found is logged, bagged, and returned with your delivery — not "somewhere at the shop".\n\nIt is not the most glamorous part of the work. It is just the difference between a laundry and a garment care service.\n\nhttps://kozycare.ng',
  },
  // ------------------------------------------------------------------- AUGUST
  {
    week: 30,
    season: 'Early August',
    category: 'SEASONAL',
    title: 'Back to school',
    subject: 'Back to school — uniforms, ready before resumption',
    banner: 'service-pickup',
    bodyText:
      'The holidays are ending, and the September rush is already queueing.\n\nSmart parents beat it: **send the uniforms in now**, before every other household in Lagos remembers at the same time.\n\n- School uniforms, house wear, sports kit — deep-cleaned and pressed\n- Name-tape friendly: we handle them per child, not per bag\n- Cardigans and white pieces get the whitening treatment\n\nEverything comes back ready for the first assembly of the term.\n\nBook your pickup: https://kozycare.ng\n\nHere is to a great school year!',
  },
  {
    week: 31,
    season: 'Mid August',
    category: 'SERVICE',
    title: 'Festive wear — kaftans, bubus & celebration dressing',
    subject: 'Your kaftan deserves better than "just wash it"',
    banner: 'seasonal-eid',
    bodyText:
      'Celebration clothes — kaftans, bubus, embroidered lace, the outfits that greet Sallah, owambe and Friday prayers — are some of the most beautiful garments we handle, and the most mishandled.\n\nOrdinary washing is exactly what they do not want:\n\n- **Handled by fabric, not by machine setting** — delicate treatment that suits the weave and the embroidery\n- **Colour-safe care** — the deep hues that made you buy them stay deep\n- **Careful finishing** — structure and texture preserved, not flattened\n\n(When Sallah and the festive dates arrive, we send a proper greeting too — this is the year-round care that keeps those outfits ready.)\n\nhttps://kozycare.ng',
  },
  {
    week: 32,
    season: 'Mid August',
    category: 'TIP',
    title: 'Ink and marker stains',
    subject: 'Biro on the white shirt. Yes, that biro.',
    banner: 'tips-fabric',
    bodyText:
      'School season means biro season — and biro has a homing instinct for white fabric.\n\nIf ink lands on a shirt:\n\n1. **Act fast, but gently** — blot, never scrub\n2. **Do not use hot water** — heat sets ink permanently\n3. **Do not drown it in detergent** — it spreads the ink into a bigger, paler stain\n4. Stop there and send it in — ink removal is chemistry, not force\n\nThe pens always win the first round. We usually win the rematch.\n\nhttps://kozycare.ng',
  },
  {
    week: 33,
    season: 'Late August',
    category: 'PROMO',
    title: 'Back-to-school promo',
    subject: 'School uniforms sorted — one pickup, whole term',
    banner: 'promo-gold',
    bodyText:
      'Resumption is around the corner — and with it, the annual discovery of how much children grew.\n\nAs you shop for the new set, let us handle the old set:\n\n- Uniforms and cardigans collected with **free pickup and delivery**\n- Whites properly whitened, not just washed\n- Repeat pickups through the term on your schedule\n\nA clean start to the school year costs less energy than you think.\n\nhttps://kozycare.ng\n\nGood luck to all the parents this week. You have earned the calm.',
  },
  {
    week: 34,
    season: 'Late August',
    category: 'STORY',
    title: 'Fabric knowledge — why labels matter',
    subject: 'The label knows. Read it with us.',
    banner: 'tips-fabric',
    bodyText:
      'Every garment carries a tiny instruction manual — the care label. Most people have never read one.\n\nWhat those symbols actually say:\n\n- **The tub with a number** — the maximum water temperature\n- **The crossed-out circle** — "do not dryclean" (yes, some fabrics say exactly that)\n- **The iron with dots** — heat setting, one dot low, three dots high\n- **The triangle** — bleaching: allowed, or absolutely never\n\nAt Kozy Care, the label is where every garment decision starts — fabric, colour, construction, then process. When the label says "dry clean only", it is not a suggestion.\n\nhttps://kozycare.ng',
  },
  // ----------------------------------------------------------------- SEPTEMBER
  {
    week: 35,
    season: 'Early September',
    category: 'TIP',
    title: 'Rainy season laundry timing',
    subject: 'It is raining. Should you still do laundry?',
    banner: 'hero-navy-gold',
    bodyText:
      'Rainy season turns home laundry into a gamble: wash in the morning, rain by afternoon, clothes on the line for two days.\n\nThat damp-then-dry-then-damp cycle is what leaves clothes smelling "almost fresh but not quite" — mildew sets in quietly.\n\nOur finishing is done indoors, professionally dried, every day of the week, rain or harmattan. Your clothes come back dry, pressed and properly aired — never "weather permitting".\n\nLet the sky do what it likes: https://kozycare.ng',
  },
  {
    week: 36,
    season: 'Mid September',
    category: 'SERVICE',
    title: 'September corporate reset',
    subject: 'Offices — the September reset for staff wardrobes',
    banner: 'corporate-navy',
    bodyText:
      'September is when offices get serious again — budgets reviewed, teams re-focused.\n\nIt is also a sensible moment to reset the wardrobe behind the work:\n\n- **Staff uniforms and branded wear** — collected weekly, processed properly, returned on schedule\n- **Management attire** — suits and shirts with the premium treatment\n- **One monthly invoice** for everything\n\nBusinesses get standing rates with **code HOTEL15** — 15% off plus 5% online.\n\nSet up a weekly collection: https://kozycare.ng',
  },
  {
    week: 37,
    season: 'Mid September',
    category: 'SEASONAL',
    title: 'Wedding season is coming',
    subject: 'Wedding season is coming. You are on the list.',
    banner: 'seasonal-owambe',
    bodyText:
      'October is nearly here — and in Lagos, that means one thing: the wedding and owambe circuit begins.\n\nIf your calendar looks like "aso-ebi on the 12th, wedding on the 19th, something on the 26th", your wardrobe is about to enter its busiest quarter of the year.\n\nStart the season right: send in the agbada, the lace, the gele — refreshed before the first invitation, not after the third.\n\n**Express from 24 hours** when the event sneaks up on you.\n\nhttps://kozycare.ng\n\nSee you on the circuit.',
  },
  {
    week: 38,
    season: 'Late September',
    category: 'PROMO',
    title: 'September promo push',
    subject: 'The end-of-year circuit starts in October. Start now.',
    banner: 'promo-gold',
    bodyText:
      'We are being honest with you: October through December is our busiest season. The weddings and owambes start rolling in October, the end-of-year events follow — and it all builds to Detty December, which runs from **December 15** into the new year.\n\nThe people who enjoy that season most are the ones who prepared their wardrobe in late September.\n\n**This week is that week.** One pickup: the suit, the dresses, the traditional wear — all refreshed and waiting in your wardrobe before the invitations even start.\n\nhttps://kozycare.ng\n\nFuture you says thank you.',
  },
  // ------------------------------------------------------------------- OCTOBER
  {
    week: 39,
    season: 'Late September',
    category: 'SEASONAL',
    title: 'Independence Day — green & white, ready early',
    subject: 'Oct 1 is almost here. Green and white, ready? 🇳🇬',
    banner: 'seasonal-independence',
    bodyText:
      'October 1st is days away — and you already know the assignment: step out in the green and white, properly.\n\nThe white pressed crisp, not creamed. The green deep, not dulled. National colours reward preparation — **send the outfit in this week** and it comes back before the flag flies.\n\n**Express is from 24 hours** if you are reading this late. (No judgement — December is coming.)\n\nBook your pickup: https://kozycare.ng\n\nGreen white green. See you on the 1st.',
  },
  {
    week: 40,
    season: 'Early October',
    category: 'SERVICE',
    title: 'Agbada care for owambe season',
    subject: 'The agbada rule: three events, one refresh',
    banner: 'seasonal-owambe',
    bodyText:
      'Owambe season is in full swing — and the agbada has a rhythm of its own.\n\nOur rule of thumb: **after three events, a refresh.** The embroidery collects food aromas, the voluminous fabric collects dust from dancing, and the whiteness quietly slips a shade or two.\n\nWhat a refresh gives it back:\n\n- The **bright white** that photographs so well\n- The **fullness and fall** of the fabric\n- A proper **clean scent** for the next event\n\nBring it in between events — we will have it back before the next invitation.\n\nhttps://kozycare.ng',
  },
  {
    week: 41,
    season: 'Mid October',
    category: 'TIP',
    title: 'Owambe stains — palm oil and egusi',
    subject: 'Palm oil found your white. Again.',
    banner: 'tips-fabric',
    bodyText:
      'No stain says "owambe season" like palm oil — usually egusi-flavoured, usually on white lace.\n\nWhat to do in the moment:\n\n1. **Scrape gently** with a spoon edge — remove what sits on top\n2. **Blot with kitchen paper** from behind the fabric, pushing oil out, not in\n3. **No hot water, no sun** — heat sets the orange into the fibre permanently\n4. **Bring it to us quickly** — oil stains age; a week-old palm oil stain is a different job entirely\n\nParty stains are literally our specialty.\n\nhttps://kozycare.ng',
  },
  {
    week: 42,
    season: 'Mid October',
    category: 'STORY',
    title: 'The gele that came back perfect',
    subject: 'How we handle the gele (with respect)',
    banner: 'seasonal-owambe',
    bodyText:
      'The gele is the crown of the owambe outfit — stiff where it should be, textured exactly as woven, colours that carry the whole ensemble.\n\nIt is also one of the most mishandled garments we see: crushed into bags, flattened under iron pressure meant for cotton, colours bleeding from one careless wash.\n\nOurs get the respect route:\n\n- **Hand-finished, never machine-flattened**\n- **Colour care that protects the interwoven pattern**\n- **Shape preserved** — the structure that makes tying possible\n\nBring the gele with the next outfit. It comes back ready to tie, not ready to retire.\n\nhttps://kozycare.ng',
  },
  {
    week: 43,
    season: 'Late October',
    category: 'PROMO',
    title: 'October promo push',
    subject: 'Three events left this season. Be ready for all of them.',
    banner: 'promo-gold',
    bodyText:
      'The wedding circuit has about six weeks left — and your calendar knows exactly how many aso-ebi are still waiting.\n\nInstead of the last-minute panic cycle (event on Saturday, panic on Wednesday), do one smart thing this week:\n\n**Send in every event-ready outfit at once.** They come back refreshed, pressed and hanging in your wardrobe — and every future invitation becomes a relaxed one.\n\nAdd Express any week the event moves closer faster than expected.\n\nhttps://kozycare.ng\n\nFinish the season strong.',
  },
  // ------------------------------------------------------------------ NOVEMBER
  {
    week: 44,
    season: 'Early November',
    category: 'SERVICE',
    title: 'Gele, aso-oke & the wedding circuit',
    subject: 'Aso-ebi week? Send everything together.',
    banner: 'seasonal-owambe',
    bodyText:
      'November is peak aso-ebi season — the month of "the wedding is on Saturday".\n\nOne habit that saves the whole weekend:\n\n**Send the full outfit together — lace gown or agbada, gele, cap, wrapper — in one pickup, early in the week.**\n\nEverything is processed for its fabric and returned as one outfit, pressed and event-ready. No Saturday-morning search for "the piece that went somewhere".\n\nExpress is standing by for the truly last-minute.\n\nhttps://kozycare.ng\n\nOne outfit, one pickup, zero Saturday stress.',
  },
  {
    week: 45,
    season: 'Mid November',
    category: 'TIP',
    title: 'Detty December wardrobe prep',
    subject: 'Detty December starts December 15. One month to prepare.',
    banner: 'promo-gold',
    bodyText:
      'Detty December starts on **December 15** — and the calendar is already assembling itself faster than any planner admits. Every weekend from the 15th will want an outfit.\n\nThe calm way to prepare:\n\n1. **List the outfits** you know Detty December will demand — parties, events, church, outings\n2. **Send them all now** — one pickup, everything refreshed before the season starts\n3. **Save Express for the season itself** — from the 15th, the calendar moves faster than you do\n\nThe people who enjoy Detty December most are never the ones ironing on Friday evening.\n\nhttps://kozycare.ng',
  },
  {
    week: 46,
    season: 'Mid November',
    category: 'SERVICE',
    title: 'Year-end hotel & corporate push',
    subject: 'Hotels — December is coming for your linens',
    banner: 'corporate-navy',
    bodyText:
      'A note for our hotel and corporate partners, with respect: **December is coming.**\n\nGuest counts double. Events multiply. Laundry volume grows exactly when your in-house capacity is most stretched.\n\nThe hotels that sail through December are the ones that arranged backup in November:\n\n- **Extra scheduled collections** for linens and guest garments\n- **Reliable turnaround** so housekeeping never waits\n- **Standing rates with HOTEL15** — 15% off plus 5% online\n\nOne conversation this week saves December.\n\nhttps://kozycare.ng',
  },
  {
    week: 47,
    season: 'Late November',
    category: 'PROMO',
    title: 'End-of-year offer',
    subject: 'The last quiet week of the year — use it',
    banner: 'promo-gold',
    bodyText:
      'This is the last calm week before December takes over the calendar — a small window to handle the things December will not wait for.\n\nOur suggestion for the window:\n\n- **The duvet and curtains** — fresh house for the festive season\n- **December outfits** — refreshed early, hanging and ready\n- **Everything you will want to photograph** — family, guests, the lot\n\nOne pickup, everything handled. December starts clean.\n\nhttps://kozycare.ng',
  },
  // ----------------------------------------------------------------- DECEMBER
  {
    week: 48,
    season: 'Late November',
    category: 'SEASONAL',
    title: 'Christmas prep — the house and the outfits',
    subject: 'Christmas is a month out. Start with the wardrobe.',
    banner: 'seasonal-christmas',
    bodyText:
      'Christmas is a month away — which makes this the quiet week that decides how calm yours feels.\n\nThe early list:\n\n- **The outfits** — church, dinners, family photos: refreshed now, not in the December rush\n- **The house** — duvets, curtains, guest linens: one pickup, a fresh house for visitors\n- **The children** — their Christmas best deserves the same care as yours\n\nEverything sent this week returns before December fills up. When the carols start, you will already be ready.\n\nhttps://kozycare.ng\n\nOne calm week now, a calm Christmas after.',
  },
  {
    week: 49,
    season: 'Early December',
    category: 'STORY',
    title: 'A thank-you from the whole team',
    subject: 'A short thank-you (from actual humans)',
    banner: 'seasonal-christmas',
    bodyText:
      'Before the year closes, a short note from the people behind your pickups.\n\nEvery garment that comes through our doors is handled by someone who takes it personally — the driver who guards your bag, the inspector who finds the stain you forgot, the presser who makes the collar sit right.\n\nThis year, you trusted us with weddings, first days at work, church Sundays, school terms and the quiet weekly shirts that hold everything together.\n\nThank you. And when Detty December opens on **December 15**, we will be right in it with you — same care, same free pickup.\n\nhttps://kozycare.ng\n\n— The Kozy Care team',
  },
  {
    week: 50,
    season: 'Early December',
    category: 'SERVICE',
    title: 'The Detty December playbook',
    subject: 'Detty December opens on the 15th. Here is your playbook.',
    banner: 'service-express',
    bodyText:
      'Detty December opens on **December 15** — one week from now. The season where plans change at 4pm and the event is tonight.\n\nSave this email. It is the playbook:\n\n- **Send the known outfits now** — everything December will ask of your wardrobe, one pickup, before the season starts\n- **Book before noon on the day** → collected today → back tomorrow, pressed and ready\n- **Express changes the clock, never the quality** — same premium finishing at speed\n\nFrom the 15th, the calendar moves faster than you do. The people who enjoy Detty December most are never the ones ironing at 6pm.\n\nhttps://kozycare.ng\n\nParty responsibly. Dress immaculately.',
  },
  {
    week: 51,
    season: 'Mid December',
    category: 'SEASONAL',
    title: 'Merry Christmas — Detty December is open',
    subject: 'Merry Christmas from Kozy Care 🎄',
    banner: 'seasonal-christmas',
    bodyText:
      'Merry Christmas from all of us at Kozy Care — and yes: Detty December is officially open.\n\nHowever you are spending the day — church in your Sunday best, rice at three different houses, or a quiet day with family — we hope your outfit feels as good as the day.\n\nThank you for another year of trusting us with the clothes that matter to you. It is a privilege we do not take lightly.\n\nWe are working through the season (adjusted hours on public holidays — watch your confirmations) and **Express is standing by** for the event that appeared out of nowhere.\n\nhttps://kozycare.ng\n\nMerry Christmas! 🎄',
  },
  {
    week: 52,
    season: 'Late December',
    category: 'SEASONAL',
    title: 'New Year\'s Eve outfits + the January smart move',
    subject: 'Cross into the new year looking like the new year',
    banner: 'seasonal-newyear',
    bodyText:
      'Two things before the year ends:\n\n**1. The NYE outfit.** The one that carries you across midnight — photographs, fireworks, hugs, the first hour of a brand-new year. It deserves to start at its best. **Express is running all week** — send it now, wear it into the new year.\n\n**2. Holiday hours.** Collections pause on the public holidays and resume between them — book around the quiet days, and watch your confirmation for exact slots.\n\nAnd the smart January move: the first week of January is our second-busiest week of the year (all of December\'s outfits arrive at once). Send yours in **this week** and January-you will not queue behind the rush.\n\nhttps://kozycare.ng\n\nSee you on the other side. Happy New Year from Kozy Care! ✨',
  },
]

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------
export function getNewsletterEntry(index: number): NewsletterEntry {
  return NEWSLETTER_LIBRARY[((index % NEWSLETTER_LIBRARY.length) + NEWSLETTER_LIBRARY.length) % NEWSLETTER_LIBRARY.length]
}

export const NEWSLETTER_LIBRARY_TOTAL = NEWSLETTER_LIBRARY.length

// -----------------------------------------------------------------------------
// Calendar sync (phase 66)
// -----------------------------------------------------------------------------
const LAGOS_OFFSET_MIN = 60

/** ISO-8601 week number (1-53) of a date, computed in Africa/Lagos wall clock. */
export function isoWeekLagos(date: Date): number {
  const d = new Date(date.getTime() + LAGOS_OFFSET_MIN * 60_000)
  // ISO rule: the Thursday of the current week decides the week's year.
  // Normalize to midnight so the time-of-day never leaks into the day count
  // (a 09:00 slot on Jan 4 must read week 1, not week 2).
  const day = d.getUTCDay() || 7
  const thursday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + (4 - day)))
  const jan1 = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1))
  const week = Math.floor((thursday.getTime() - jan1.getTime()) / 86_400_000 / 7) + 1
  return Math.min(53, Math.max(1, week))
}

/** The library entry whose week matches the calendar week of a send slot.
 *  Falls back to the nearest earlier week (a 53-week year reads week 52) so
 *  the content is always seasonally honest for the send date. */
export function getNewsletterEntryForDate(slot: Date): NewsletterEntry {
  const week = isoWeekLagos(slot)
  let best = NEWSLETTER_LIBRARY[0]
  for (const entry of NEWSLETTER_LIBRARY) {
    if (entry.week <= week) best = entry
    else break
  }
  return best
}

