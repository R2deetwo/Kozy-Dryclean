// VLM QA of phase 67 — 3-plan memberships + Couture Care service page (local prod build).
import ZAI from '/home/z/my-project/node_modules/z-ai-web-dev-sdk/dist/index.js'
import fs from 'fs'

async function read(imgPath, check) {
  const zai = await ZAI.create()
  const img = fs.readFileSync(imgPath)
  const dataUrl = `data:image/png;base64,${img.toString('base64')}`
  const res = await zai.chat.completions.createVision({
    messages: [{ role: 'user', content: [
      { type: 'text', text: check },
      { type: 'image_url', image_url: { url: dataUrl } },
    ]}],
    thinking: { type: 'disabled' },
  })
  return res.choices[0]?.message?.content || 'NO RESPONSE'
}

const PREAMBLE = `You are a strict visual QA reviewer looking at screenshots of a premium laundry website (navy/gold brand, serif headings). Answer the numbered questions in plain prose only, under 120 words each. Do NOT write code.`

const membershipsDesktop = await read('work/p67_memberships_desktop.png', `${PREAMBLE}
This page should show, in order: navy hero with laundry-handover photo; "how the plan works" steps; a "Find yourself below" strip with FOUR persona cards (work clothes / family / full home / wardrobe investment); a THREE-plan grid (The Essentials / The Household (Most chosen) / The Whole Home, 30,000 / 50,000 / 80,000 per month) in three columns; a gold-bordered pointer card about designer/couture wear pointing to a "Couture Care" service; a navy value band; the per-item price list; FAQ.
Questions:
1) Is the grid exactly THREE plans, evenly arranged, nothing clipped? Is any fourth "Atelier" plan visible (it should NOT be)?
2) Is the persona card "My wardrobe is the investment" routing to a Couture Care service (NOT a plan)?
3) Is the couture pointer card readable and well placed between the plans and the value band?
4) Anything misaligned or overflowing? Rate polish 1-10.`)
console.log('=== MEMBERSHIPS DESKTOP ===\n' + membershipsDesktop + '\n')

const servicesDesktop = await read('work/p67_services_desktop.png', `${PREAMBLE}
This specialty-care page should show: a navy header ("The craft beyond the wash.") mentioning Couture Care; a pricing pointer strip; then a navy section titled "For the pieces you don't trust to just anyone." — the COUTURE CARE specialist service with a gold "Priced per piece" badge, a 4-step numbered process (Assessed first / Cleaned by hand / Finished by hand / Returned protected), a quote-pricing note box, a "Book a couture pickup" button and a "Call to discuss it first" outline button, with a craftsman photo on the right; then sneaker restoration; then alterations.
Questions:
1) Does the Couture Care section read as a premium specialist SERVICE (not a membership plan)? Is the 4-step process legible?
2) Are the two buttons styled consistently (gold primary, outline secondary)?
3) Does anything overlap the photo or clip? Rate the section's polish 1-10.`)
console.log('=== SERVICES DESKTOP ===\n' + servicesDesktop + '\n')

const mobile = await read('work/p67_services_mobile.png', `${PREAMBLE}
Same specialty page on a 390px phone, full length. The Couture Care section should stack: text and process steps first, the craftsman photo below, buttons full-width-ish.
Questions:
1) Does the Couture Care section stack cleanly — numbered steps readable, photo not distorted, no horizontal overflow?
2) Are the gold and outline buttons tappable-sized and not clipped?
3) Any element overflowing the 390px width anywhere on the page? Rate mobile polish 1-10.`)
console.log('=== SERVICES MOBILE ===\n' + mobile + '\n')

const membershipsMobile = await read('work/p67_memberships_mobile.png', `${PREAMBLE}
Membership page on a 390px phone, full length.
Questions:
1) Do the three plan cards stack single-column with readable prices and perks (no fourth Atelier card)?
2) Does the persona strip and the couture pointer card stack cleanly?
3) Is the top nav one tidy row with no overflow? Rate mobile polish 1-10.`)
console.log('=== MEMBERSHIPS MOBILE ===\n' + membershipsMobile + '\n')

fs.writeFileSync('work/p67-vlm-reviews.txt',
  [membershipsDesktop, servicesDesktop, mobile, membershipsMobile].join('\n\n---\n\n'))
console.log('saved work/p67-vlm-reviews.txt')
