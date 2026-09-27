// VLM QA of phase 66 — memberships page (4-plan ladder + personas) local prod build.
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

const PREAMBLE = `You are a strict visual QA reviewer looking at a screenshot of a laundry-membership page (navy/gold brand). Answer the numbered questions in plain prose only, under 120 words. Do NOT write code.`

const desktop = await read('work/p66_memberships_desktop_full.png', `${PREAMBLE}
This page should show, in order: a navy hero with a laundry-handover photo; a "how the plan works" 3-step row; a "Find yourself below" strip with FOUR persona cards (work clothes / family / full home / wardrobe investment); then a FOUR-plan grid (The Essentials / The Household (marked Most chosen) / The Whole Home / The Atelier) with Naira prices 30,000 / 50,000 / 80,000 / 100,000 per month; then a value band; then a long per-item price list.
Questions:
1) Are all four plans visible, readable and evenly arranged — nothing clipped or crowded?
2) Is the language plain and understandable for a regular person (no jargon like "concierge" or "à-la-carte")?
3) Do the persona cards read clearly and point at plans?
4) Anything misaligned or overflowing? Rate polish 1-10.`)
console.log('=== DESKTOP FULL ===\n' + desktop + '\n')

const mobile = await read('work/p66_memberships_mobile_full.png', `${PREAMBLE}
This is the same page on a 390px phone, full length.
Questions:
1) Do the persona cards stack cleanly (one or two per row, no clipping)?
2) Do the four plan cards stack single-column with readable prices and perk lists — nothing squashed?
3) Is the top nav a single tidy row? Any horizontal overflow anywhere?
4) Rate the mobile experience 1-10.`)
console.log('=== MOBILE FULL ===\n' + mobile + '\n')

fs.writeFileSync('work/p66-vlm-reviews.txt', [desktop, mobile].join('\n\n---\n\n'))
console.log('saved work/p66-vlm-reviews.txt')
