// VLM QA of phase 57 — the Kanban pacing colours. Pure image REVIEW.
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

const PREAMBLE = `You are a strict visual QA reviewer. You are LOOKING AT a screenshot — review it. Do NOT write HTML, CSS or code of any kind. Answer the numbered questions in plain prose only.`

const board = await read('work/p57-board.png', `${PREAMBLE}
This is the Orders Kanban board of a premium Lagos laundry ops console (navy/linen/gold). A new "pacing" colour system was added so staff can see at a glance which orders are on track (calm sage dot), due soon (soft amber left edge on the card), and overdue (soft rose left edge + very faint rose tint on the card). The brief: NOT too intense.
Questions:
1) Can you visually distinguish three urgency levels on the cards? Describe what you see on the most urgent-looking card vs a calm one.
2) Is the colour treatment CALM and professional, or loud/alarming? Would it be stressful to look at all day?
3) Is each card still readable (order number, customer, price, badges)?
4) In the header, do you see the "N due soon" / "N overdue" chips and the small legend with three coloured dots?
5) Any clipping, overlap, or visual bugs? Rate overall polish 1-10.`)
console.log('=== DESKTOP BOARD ===\n' + board + '\n')

const mobile = await read('work/p57-board-mobile.png', `${PREAMBLE}
This is the same Orders Kanban board at mobile width (390px).
Questions:
1) Are the pacing lines (dot + "Due…" text) readable on the cards?
2) Anything clipped, overlapping or squashed?
3) Rate usability 1-10.`)
console.log('=== MOBILE BOARD ===\n' + mobile + '\n')
