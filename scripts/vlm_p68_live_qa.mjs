// VLM QA of phase 68 LIVE deploy — the "From, per kilogram" navy B2B card.
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

const card = await read('work/p68-perkg-card.png', `${PREAMBLE}
This is the navy "weight-based corporate program" pricing card of a premium laundry brand (navy background, gold accents). It should read: a small uppercase gold label "FROM, PER KILOGRAM", a large serif price "₦800", a gold divider, and a small line about the minimum charge (₦8,000, 10kg minimum billable weight).
Questions:
1) Does the label area read clearly as "From, per kilogram" — i.e. is the price presented as a starting rate, not a flat fixed rate?
2) Is the ₦800 price prominent, correctly formatted, and legible against the navy background?
3) Is the minimum-charge line readable and not clipped?
4) Rate the card's polish 1-10.`)
console.log('=== PER-KG CARD (desktop) ===\n' + card + '\n')

fs.writeFileSync('work/p68-vlm-review.txt', card)
console.log('saved work/p68-vlm-review.txt')
