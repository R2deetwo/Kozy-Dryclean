// VLM QA of phase 64 LIVE deploy on kozycare.ng — mobile nav row + memberships hero.
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

const PREAMBLE = `You are a strict visual QA reviewer. You are LOOKING AT a screenshot of the LIVE site kozycare.ng — review it. Do NOT write HTML, CSS or code of any kind. Answer the numbered questions in plain prose only, under 120 words.`

const mobileHome = await read('work/p64_live_mobile_home.png', `${PREAMBLE}
This is the mobile (390px) view of the Kozy Care laundry homepage. The top bar should show: a compact logo, then ONE row of buttons — a navy filled pill reading "Plans", an outline "Sign in" button, and a gold "Sign up" button.
Questions:
1) Do the nav buttons sit in ONE tidy row without wrapping or overlapping?
2) Does the navy "Plans" pill visually match the style family of the Sign in / Sign up buttons?
3) Is anything clipped, overflowing, or cramped in the top bar or hero?
4) Rate the mobile top-bar polish 1-10.`)
console.log('=== MOBILE HOME (390px) ===\n' + mobileHome + '\n')

const memberships = await read('work/p64_live_desktop_memberships.png', `${PREAMBLE}
This is the desktop view of the "Memberships — Plans & Pricing" page of a premium laundry brand (navy/gold design language). It should show a two-column hero: text on the left, and on the right a photo of laundry being handed over in a rounded card, plus membership tier cards (Essentials / Household / Concierge with Naira prices).
Questions:
1) Is the hero photo (person handing over a laundry bag) visible, well-cropped and premium-looking?
2) Are the membership tier cards readable, with clear prices and a highlighted/most-chosen tier?
3) Is anything clipped, overlapping, or misaligned?
4) Rate overall polish 1-10.`)
console.log('=== DESKTOP MEMBERSHIPS ===\n' + memberships + '\n')

fs.writeFileSync('work/p64-vlm-live-reviews.txt', [mobileHome, memberships].join('\n\n---\n\n'))
console.log('saved work/p64-vlm-live-reviews.txt')
