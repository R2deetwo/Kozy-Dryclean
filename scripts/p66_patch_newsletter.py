#!/usr/bin/env python3
# Phase 66 — patch newsletter-content.ts timing fixes with exact-match asserts.
# Idempotent: skips pairs already applied; fails loudly on mismatch.
import sys

PATH = "/home/z/my-project/src/lib/newsletter-content.ts"
src = open(PATH, encoding="utf-8").read()

def rep(old, new, label):
    global src
    if old in src:
        if src.count(old) != 1:
            print(f"FAIL {label}: old matches {src.count(old)} times (expected 1)")
            sys.exit(1)
        src = src.replace(old, new)
        print(f"OK   {label}")
    elif new in src:
        print(f"SKIP {label} (already applied)")
    else:
        print(f"FAIL {label}: old text not found")
        sys.exit(1)

# ---- A. weeks 7/8: couples push BEFORE the 14th (week 7), stains AFTER (week 8)
rep(
    r"""    week: 7,
    season: 'Early February',
    category: 'TIP',
    title: 'Lipstick and wine stains',
    subject: 'Spilled wine on date night? Read this first.',
    banner: 'tips-fabric',
    bodyText:
      'Valentine\'s week survival guide, stain edition:\n\n**Lipstick on a collar** — do not rub. Dab gently with a little makeup remover on cotton wool, then leave the rest to a proper clean.\n\n**Wine on a dress** — cold water only, never hot. Hot water cooks the pigment into the fibre. Blot from the edge inward so the stain does not spread.\n\n**Perfume on silk** — stop everything and bring it to us. Silk punishes home experiments.\n\nThe rule under all three: **blot, do not scrub.**\n\nAnd when in doubt — https://kozycare.ng — we handle the rest.',
  },
  {
    week: 8,
    season: 'Mid February',
    category: 'PROMO',
    title: 'Valentine couples push',
    subject: 'Two outfits, one pickup, zero stress',
    banner: 'seasonal-valentine',
    bodyText:
      'Valentine\'s week is our busiest pickup week of the first quarter — couples sending date-night outfits together.\n\nA kind reminder:\n\n**Book your pickup early this week.** The closer to the 14th, the fuller the route gets.\n\nOne pickup takes both outfits. One delivery brings them back pressed, on a day you choose — ready for dinner.\n\nhttps://kozycare.ng\n\n(And if you are single and thriving? Your best shirt deserves the same energy.)',
  },""",
    r"""    week: 7,
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
  },""",
    "A weeks 7/8 swap",
)

# ---- B. week 22 -> airing tip (Democracy Day moves to week 24)
rep(
    r"""    week: 22,
    season: 'Early June',
    category: 'SEASONAL',
    title: 'Democracy Day note',
    subject: 'Democracy Day — small businesses, big hearts',
    banner: 'hero-navy-gold',
    bodyText:
      'Happy Democracy Day!\n\nWe will keep this one short. Kozy Care is a Nigerian business, built and run here — every pickup, every press, every delivery is work done by people in this economy.\n\nOn a day like this, we just want to say thank you. Your patronage is what keeps a small Lagos business growing.\n\nIf there is anything we can do better — reply to this email. A real person reads it.\n\nhttps://kozycare.ng',
  },""",
    r"""    week: 22,
    season: 'Late May',
    category: 'TIP',
    title: 'How to air clothes properly',
    subject: 'Airing clothes — the 10-minute habit',
    banner: 'hero-navy-gold',
    bodyText:
      'Not every worn garment needs washing — but every worn garment needs air.\n\nThe ten-minute habit:\n\n**Hang worn clothes in open air** (balcony, doorway, anywhere with movement) **for 30–60 minutes before returning them to the wardrobe.** Body moisture escapes, odours lift, and the garment earns another wear.\n\nWhy it matters: clothes returned warm and worn into a dark closet is exactly how "that smell" starts.\n\nWool, suits and agbada especially thrive on airing between wears — it is the closest thing to a free refresh.\n\nhttps://kozycare.ng',
  },""",
    "B week 22 -> airing",
)

# ---- C. week 24 -> Democracy Day (week containing June 12)
rep(
    r"""    week: 24,
    season: 'Mid June',
    category: 'TIP',
    title: 'How to air clothes properly',
    subject: 'Airing clothes — the 10-minute habit',
    banner: 'hero-navy-gold',
    bodyText:
      'Not every worn garment needs washing — but every worn garment needs air.\n\nThe ten-minute habit:\n\n**Hang worn clothes in open air** (balcony, doorway, anywhere with movement) **for 30–60 minutes before returning them to the wardrobe.** Body moisture escapes, odours lift, and the garment earns another wear.\n\nWhy it matters: clothes returned warm and worn into a dark closet is exactly how "that smell" starts.\n\nWool, suits and agbada especially thrive on airing between wears — it is the closest thing to a free refresh.\n\nhttps://kozycare.ng',
  },""",
    r"""    week: 24,
    season: 'Democracy Day week',
    category: 'SEASONAL',
    title: 'Democracy Day note',
    subject: 'Democracy Day — small businesses, big hearts',
    banner: 'hero-navy-gold',
    bodyText:
      'Happy Democracy Day!\n\nWe will keep this one short. Kozy Care is a Nigerian business, built and run here — every pickup, every press, every delivery is work done by people in this economy.\n\nOn a day like this, we just want to say thank you. Your patronage is what keeps a small Lagos business growing.\n\nIf there is anything we can do better — reply to this email. A real person reads it.\n\nhttps://kozycare.ng',
  },""",
    "C week 24 -> Democracy Day",
)

# ---- D. week 31: dated Eid greeting -> evergreen festive-wear care
rep(
    r"""    week: 31,
    season: 'Mid August (movable)',
    category: 'SEASONAL',
    title: 'Eid Mubarak',
    subject: 'Eid Mubarak from Kozy Care 🌙',
    banner: 'seasonal-eid',
    bodyText:
      '**Eid Mubarak!**\n\nTo everyone celebrating — may your prayers be accepted, your tables be full, and your kaftans be immaculate.\n\nEid outfits are some of the most beautiful garments we handle all year: the lace, the embroidery, the carefully chosen kaftans and bubus. If yours carried the day and now carries the memories (and the food stains), send it in — we will treat it with the care it has earned.\n\nhttps://kozycare.ng\n\nEid Mubarak once more, from the whole Kozy Care family.',
  },""",
    r"""    week: 31,
    season: 'Mid August',
    category: 'SERVICE',
    title: 'Festive wear — kaftans, bubus & celebration dressing',
    subject: 'Your kaftan deserves better than "just wash it"',
    banner: 'seasonal-eid',
    bodyText:
      'Celebration clothes — kaftans, bubus, embroidered lace, the outfits that greet Sallah, owambe and Friday prayers — are some of the most beautiful garments we handle, and the most mishandled.\n\nOrdinary washing is exactly what they do not want:\n\n- **Handled by fabric, not by machine setting** — delicate treatment that suits the weave and the embroidery\n- **Colour-safe care** — the deep hues that made you buy them stay deep\n- **Careful finishing** — structure and texture preserved, not flattened\n\n(When Sallah and the festive dates arrive, we send a proper greeting too — this is the year-round care that keeps those outfits ready.)\n\nhttps://kozycare.ng',
  },""",
    "D week 31 -> festive wear",
)

# ---- E. week 33: resumption is AROUND THE CORNER in early August
rep(
    r"""      'Resumption week is here — and with it, the annual discovery of how much children grew.""",
    r"""      'Resumption is around the corner — and with it, the annual discovery of how much children grew.""",
    "E week 33 wording",
)

# ---- F. week 37 season label (Sep 7-13 is Mid September)
rep(
    """    week: 37,
    season: 'Late September',""",
    """    week: 37,
    season: 'Mid September',""",
    "F week 37 season",
)

# ---- G. week 39: Independence PREP (before Oct 1), not a day-after greeting
rep(
    r"""    week: 39,
    season: 'Early October',
    category: 'SEASONAL',
    title: 'Independence Day',
    subject: 'Happy Independence Day, Nigeria 🇳🇬',
    banner: 'seasonal-independence',
    bodyText:
      'Happy Independence Day from everyone at Kozy Care!\n\nOctober 1st always brings out the green and white — and this year, if you are stepping out in the national colours, step out properly: the white pressed crisp, the green deep and fresh.\n\nIt is a small thing, but there is a certain feeling in wearing your country\'s colours well.\n\nIf the outfit is not quite there yet, **Express is from 24 hours** — there is still time.\n\nhttps://kozycare.ng\n\nGreen white green. Happy Independence, Nigeria.',
  },""",
    r"""    week: 39,
    season: 'Late September',
    category: 'SEASONAL',
    title: 'Independence Day — green & white, ready early',
    subject: 'Oct 1 is almost here. Green and white, ready? 🇳🇬',
    banner: 'seasonal-independence',
    bodyText:
      'October 1st is days away — and you already know the assignment: step out in the green and white, properly.\n\nThe white pressed crisp, not creamed. The green deep, not dulled. National colours reward preparation — **send the outfit in this week** and it comes back before the flag flies.\n\n**Express is from 24 hours** if you are reading this late. (No judgement — December is coming.)\n\nBook your pickup: https://kozycare.ng\n\nGreen white green. See you on the 1st.',
  },""",
    "G week 39 Independence prep",
)

# ---- H. week 45: drop the "one month from now" imprecision
rep(
    r"""      'Detty December starts on **December 15** — one month from now — and the calendar is already assembling itself. Every weekend from the 15th will want an outfit.""",
    r"""      'Detty December starts on **December 15** — and the calendar is already assembling itself faster than any planner admits. Every weekend from the 15th will want an outfit.""",
    "H week 45 wording",
)

# ---- I. week 48: Christmas PREP (Nov 23-29), greeting moves to week 51
rep(
    r"""    week: 48,
    season: 'Early December',
    category: 'SEASONAL',
    title: 'Merry Christmas',
    subject: 'Merry Christmas from Kozy Care 🎄',
    banner: 'seasonal-christmas',
    bodyText:
      'Merry Christmas from all of us at Kozy Care!\n\nHowever you are spending it — church in your Sunday best, rice at three different houses, or a quiet day with family — we hope your outfit feels as good as the day.\n\nThank you for another year of trusting us with the clothes that matter to you. It is a privilege we do not take lightly.\n\nWe are working through the season (with adjusted hours on public holidays — we will keep you posted) and **Express is standing by** for the event that appeared out of nowhere.\n\nhttps://kozycare.ng\n\nMerry Christmas! 🎄',
  },""",
    r"""    week: 48,
    season: 'Late November',
    category: 'SEASONAL',
    title: 'Christmas prep — the house and the outfits',
    subject: 'Christmas is a month out. Start with the wardrobe.',
    banner: 'seasonal-christmas',
    bodyText:
      'Christmas is a month away — which makes this the quiet week that decides how calm yours feels.\n\nThe early list:\n\n- **The outfits** — church, dinners, family photos: refreshed now, not in the December rush\n- **The house** — duvets, curtains, guest linens: one pickup, a fresh house for visitors\n- **The children** — their Christmas best deserves the same care as yours\n\nEverything sent this week returns before December fills up. When the carols start, you will already be ready.\n\nhttps://kozycare.ng\n\nOne calm week now, a calm Christmas after.',
  },""",
    "I week 48 Christmas prep",
)

# ---- J. week 50: pre-open playbook (Dec 7-13 says "opens on the 15th")
rep(
    r"""    week: 50,
    season: 'Mid December',
    category: 'SERVICE',
    title: 'Express during Detty December',
    subject: 'Detty December: event tonight, outfit ready tomorrow',
    banner: 'service-express',
    bodyText:
      'Detty December is officially open — from **December 15** into the new year, the season where plans change at 4pm and the event is tonight.\n\nThis is what **Express, from 24 hours** was built for:\n\n- Book before noon → collected today → back tomorrow, pressed and ready\n- Perfect for the outfit that "will be fine" and then was not\n- Same premium finishing — Express changes the clock, never the quality\n\nKeep this email saved. The season will make you use it.\n\nhttps://kozycare.ng\n\nParty responsibly. Dress immaculately.',
  },""",
    r"""    week: 50,
    season: 'Early December',
    category: 'SERVICE',
    title: 'The Detty December playbook',
    subject: 'Detty December opens on the 15th. Here is your playbook.',
    banner: 'service-express',
    bodyText:
      'Detty December opens on **December 15** — one week from now. The season where plans change at 4pm and the event is tonight.\n\nSave this email. It is the playbook:\n\n- **Send the known outfits now** — everything December will ask of your wardrobe, one pickup, before the season starts\n- **Book before noon on the day** → collected today → back tomorrow, pressed and ready\n- **Express changes the clock, never the quality** — same premium finishing at speed\n\nFrom the 15th, the calendar moves faster than you do. The people who enjoy Detty December most are never the ones ironing at 6pm.\n\nhttps://kozycare.ng\n\nParty responsibly. Dress immaculately.',
  },""",
    "J week 50 playbook",
)

# ---- K. week 51: the Christmas greeting + Detty OPEN (week of Dec 15)
rep(
    r"""    week: 51,
    season: 'Late December',
    category: 'SEASONAL',
    title: 'New Year\'s Eve outfits',
    subject: 'Cross into the new year looking like the new year',
    banner: 'seasonal-newyear',
    bodyText:
      'One more outfit before the year ends — the one that carries you across midnight.\n\nThe NYE outfit has a job: photographs, fireworks, hugs, the first hour of a brand-new year. It deserves to start at its best.\n\n**Express is running through the week** — send it now, wear it into the new year.\n\nhttps://kozycare.ng\n\nSee you on the other side. Happy New Year from Kozy Care! ✨',
  },""",
    r"""    week: 51,
    season: 'Mid December',
    category: 'SEASONAL',
    title: 'Merry Christmas — Detty December is open',
    subject: 'Merry Christmas from Kozy Care 🎄',
    banner: 'seasonal-christmas',
    bodyText:
      'Merry Christmas from all of us at Kozy Care — and yes: Detty December is officially open.\n\nHowever you are spending the day — church in your Sunday best, rice at three different houses, or a quiet day with family — we hope your outfit feels as good as the day.\n\nThank you for another year of trusting us with the clothes that matter to you. It is a privilege we do not take lightly.\n\nWe are working through the season (adjusted hours on public holidays — watch your confirmations) and **Express is standing by** for the event that appeared out of nowhere.\n\nhttps://kozycare.ng\n\nMerry Christmas! 🎄',
  },""",
    "K week 51 Christmas+Detty open",
)

# ---- L. week 52: NYE + holiday hours + January prep merged
rep(
    r"""    week: 52,
    season: 'Late December',
    category: 'SEASONAL',
    title: 'Holiday hours + January prep',
    subject: 'Holiday hours — and one smart move before January',
    banner: 'seasonal-christmas',
    bodyText:
      'Two things before the year ends:\n\n**1. Holiday hours.** Collections pause on the public holidays and resume between them — book around the quiet days, and watch your confirmation for exact slots. Express keeps running on working days.\n\n**2. The smart January move.** The first week of January is our second-busiest week of the year (all of December\'s outfits arrive at once). Send yours in **this week** and January-you will not queue behind the rush.\n\nhttps://kozycare.ng\n\nThank you for this year. Next year, more of the same care.',
  },""",
    r"""    week: 52,
    season: 'Late December',
    category: 'SEASONAL',
    title: 'New Year\'s Eve outfits + the January smart move',
    subject: 'Cross into the new year looking like the new year',
    banner: 'seasonal-newyear',
    bodyText:
      'Two things before the year ends:\n\n**1. The NYE outfit.** The one that carries you across midnight — photographs, fireworks, hugs, the first hour of a brand-new year. It deserves to start at its best. **Express is running all week** — send it now, wear it into the new year.\n\n**2. Holiday hours.** Collections pause on the public holidays and resume between them — book around the quiet days, and watch your confirmation for exact slots.\n\nAnd the smart January move: the first week of January is our second-busiest week of the year (all of December\'s outfits arrive at once). Send yours in **this week** and January-you will not queue behind the rush.\n\nhttps://kozycare.ng\n\nSee you on the other side. Happy New Year from Kozy Care! ✨',
  },""",
    "L week 52 NYE+hours+Jan",
)

# ---- M. calendar-sync helpers
rep(
    """export function getNewsletterEntry(index: number): NewsletterEntry {
  return NEWSLETTER_LIBRARY[((index % NEWSLETTER_LIBRARY.length) + NEWSLETTER_LIBRARY.length) % NEWSLETTER_LIBRARY.length]
}

export const NEWSLETTER_LIBRARY_TOTAL = NEWSLETTER_LIBRARY.length""",
    """export function getNewsletterEntry(index: number): NewsletterEntry {
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
  const day = d.getUTCDay() || 7
  const thursday = new Date(d.getTime() + (4 - day) * 86_400_000)
  const jan1 = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((thursday.getTime() - jan1.getTime()) / 86_400_000 + 1) / 7)
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
}""",
    "M calendar helpers",
)

open(PATH, "w", encoding="utf-8").write(src)
print("\nWROTE", PATH)
