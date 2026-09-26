// VLM QA of phase 60 — dispatch card, CRM health, relationship modal.
// Pure image REVIEW (same harness as phase 59).
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

const PREAMBLE = `You are a strict visual QA reviewer. You are LOOKING AT a screenshot — review it. Do NOT write HTML, CSS or code of any kind. Answer the numbered questions in plain prose only, under 120 words.`

const dispatch = await read('work/p60-dispatch-modal.png', `${PREAMBLE}
This is the order-detail modal of a premium laundry ops console (navy/gold design language). It contains a new "Dispatch" card: ranked rider suggestions with scores out of 100, reason lines under each, and an Assign button per row.
Questions:
1) Is the Dispatch card immediately understandable — WHO is suggested, WHY (the reason lines), and HOW to assign?
2) Are the ranked rows calm and uncramped, with clear hierarchy (rank badge, name, score bar, reasons)?
3) Is anything clipped, overlapping, or misaligned anywhere in the modal?
4) Rate overall polish 1-10 — would a busy operator trust this card at a glance?`)
console.log('=== DISPATCH MODAL ===\n' + dispatch + '\n')

const crm = await read('work/p60-crm.png', `${PREAMBLE}
This is the Customers (CRM) tab of a premium laundry ops console. It has health filter chips (All / VIP / On rhythm / Going quiet / At risk with counts), a Health column with small colored chips, a Last order column, VIP badges next to some names, and Total Spent.
Questions:
1) Are the filter chips readable and calm, not shouting?
2) Is the table still clean with the new columns, or crowded?
3) Are the health chips scannable at a glance (color + label)?
4) Anything clipped or misaligned? Rate overall polish 1-10.`)
console.log('=== CRM HEALTH ===\n' + crm + '\n')

const rel = await read('work/p60-relationship-modal.png', `${PREAMBLE}
This is a customer detail modal in a premium laundry ops console. Below the three stat cards sits a "Relationship" section: a sentence about the customer's ordering rhythm, four small stats (Delivered, Avg order, Their rhythm, Last order), and a "Quietness risk" meter bar.
Questions:
1) Does the Relationship section read as premium and calm?
2) Is the risk meter understandable without a legend?
3) Anything clipped, overlapping or misaligned anywhere? Rate overall polish 1-10.`)
console.log('=== RELATIONSHIP MODAL ===\n' + rel + '\n')

fs.writeFileSync('work/p60-vlm-reviews.txt', [dispatch, crm, rel].join('\n\n---\n\n'))
console.log('saved work/p60-vlm-reviews.txt')
