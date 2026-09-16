// Validate the 52-week newsletter library after the Detty December timing fix.
// Run: node scripts/validate_newsletter_library.mts
import {
  NEWSLETTER_LIBRARY,
  NEWSLETTER_BANNERS,
  NEWSLETTER_LIBRARY_TOTAL,
} from '../src/lib/newsletter-content.ts'

let failures = 0
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

// 1. Structure
check('52 entries', NEWSLETTER_LIBRARY.length === 52, `got ${NEWSLETTER_LIBRARY.length}`)
check('total constant matches', NEWSLETTER_LIBRARY_TOTAL === 52)
const weeks = NEWSLETTER_LIBRARY.map((e) => e.week)
check('weeks 1..52 in order', JSON.stringify(weeks) === JSON.stringify(Array.from({ length: 52 }, (_, i) => i + 1)))

// 2. Unique subjects + valid banners
const subjects = NEWSLETTER_LIBRARY.map((e) => e.subject)
check('unique subjects', new Set(subjects).size === 52, `unique=${new Set(subjects).size}`)
const bannerSlugs = new Set(NEWSLETTER_BANNERS.map((b) => b.slug))
check('all banners valid', NEWSLETTER_LIBRARY.every((e) => bannerSlugs.has(e.banner)))

// 3. Every entry has subject + body
check('every entry has subject+body', NEWSLETTER_LIBRARY.every((e) => e.subject && e.bodyText))

// 4. Detty December timing rule (client: starts December 15)
//    a) No entry before week 50 may claim the season has started.
const premature = NEWSLETTER_LIBRARY.filter(
  (e) => e.week < 50 && /officially (open|Detty)|is officially/i.test(`${e.subject} ${e.bodyText}`)
)
check('no "officially Detty December" before week 50', premature.length === 0,
  premature.map((e) => `W${e.week}`).join(', ') || '')

//    b) No countdown math that implies a start before Dec 15.
const oneMonthTill = NEWSLETTER_LIBRARY.filter(
  (e) => e.week < 44 && /one month (till|to) Detty/i.test(`${e.subject} ${e.bodyText}`)
)
check('no "one month till Detty December" claims before November', oneMonthTill.length === 0,
  oneMonthTill.map((e) => `W${e.week}`).join(', ') || '')

//    c) Prep emails state the Dec 15 start date explicitly.
const w45 = NEWSLETTER_LIBRARY.find((e) => e.week === 45)!
check('W45 subject names December 15', /December 15/.test(w45.subject), w45.subject)
check('W45 body names December 15', /December 15/.test(w45.bodyText))

//    d) The "officially open" email sits in week 50 and names Dec 15.
const w50 = NEWSLETTER_LIBRARY.find((e) => e.week === 50)!
check('W50 is the Express-during-Detty email', w50.title === 'Express during Detty December')
check('W50 says officially open + December 15', /officially open/.test(w50.bodyText) && /December 15/.test(w50.bodyText))

//    e) W49 (the week before) no longer claims it started; it looks forward.
const w49 = NEWSLETTER_LIBRARY.find((e) => e.week === 49)!
check('W49 is the thank-you email', w49.title === 'A thank-you from the whole team')
check('W49 looks forward to Dec 15', /opens on .{0,30}December 15/.test(w49.bodyText))

//    f) W38 no longer claims Detty is one month away.
const w38 = NEWSLETTER_LIBRARY.find((e) => e.week === 38)!
check('W38 subject has no month countdown to Detty', !/Detty/i.test(w38.subject), w38.subject)
check('W38 body frames Detty as Dec 15 → new year', /December 15/.test(w38.bodyText))

// 5. Full audit of every remaining Detty mention — print for eyeball review
console.log('\n--- every Detty December mention (for review) ---')
for (const e of NEWSLETTER_LIBRARY) {
  const text = `${e.subject}\n${e.bodyText}`
  if (/Detty/i.test(text)) {
    const lines = text.split('\n').filter((l) => /Detty/i.test(l))
    console.log(`W${e.week} (${e.season}):`)
    for (const l of lines) console.log(`    ${l.trim().slice(0, 110)}`)
  }
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASS' : `${failures} CHECK(S) FAILED`}`)
process.exit(failures === 0 ? 0 : 1)
