// VLM QA of phase 52: the private /milestone appreciation page + the quiet
// portal referral card — premium tone, no visual defects.
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

const desk = await read('work/p52-milestone-desktop.png', `This is a screenshot of a PRIVATE "thank-you" page for a laundry brand's most loyal customers (10 completed orders). It should show: a gold "A quiet thank-you" label, a serif heading "Ten orders.", a feedback form card (star rating, two text questions, a gold "Share your thoughts" button), and below it a referral card titled "A quiet way to share the care" with a personal code in a gold-bordered box and a copy button. Answer precisely:
1) Are all those elements present and readable?
2) Does the tone feel premium (navy/gold, serif headings, generous spacing) rather than promotional or "scummy" (no countdowns, no exclamation-heavy banners, no "REFER AND EARN" language)?
3) Is the referral section visually quiet — one card, no loud badges or counters?
4) Anything cramped, clipped, overlapping, misaligned or confusing?`)
console.log('=== MILESTONE DESKTOP ===\n' + desk + '\n')

const mob = await read('work/p52-milestone-mobile.png', `This is a MOBILE (375px) screenshot of the same private thank-you page described above: heading "Ten orders.", star rating, two text questions, gold submit button, referral card with a personal code. Answer precisely:
1) Is everything fully visible with no horizontal overflow?
2) Are the star rating buttons comfortably tappable?
3) Does the referral code box fit the narrow screen (not clipped)?
4) Anything clipped, overlapping or confusing?`)
console.log('=== MILESTONE MOBILE (375) ===\n' + mob + '\n')

const portal = await read('work/p52-portal-desktop.png', `This is a screenshot of a customer portal dashboard for a laundry service. Below the three stat cards (Active / Past / Guarantee) there should be ONE quiet referral card: a gold gift icon, the title "A quiet way to share the care", a line about friends getting 10% off their first order, and the personal code in a gold-bordered pill with a copy icon. Answer precisely:
1) Is that referral card present and does it look like a calm, premium part of the page (not an loud promo banner)?
2) Is it aligned with the rest of the page's grid and card styling?
3) Anything cramped, clipped, overlapping, misaligned or confusing?`)
console.log('=== PORTAL CARD DESKTOP ===\n' + portal + '\n')

const portalM = await read('work/p52-portal-mobile.png', `This is a MOBILE (375px) screenshot of the same customer portal. Answer precisely:
1) Is the quiet referral card ("A quiet way to share the care" + code pill + copy icon) fully visible, wrapping cleanly on the narrow screen?
2) No horizontal overflow or clipped text anywhere?
3) Anything overlapping or confusing?`)
console.log('=== PORTAL CARD MOBILE (375) ===\n' + portalM + '\n')
