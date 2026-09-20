// VLM QA follow-ups: services page halves + how-it-works proof shot.
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

const hiwCheck = `Screenshot of the "Three steps" (How It Works) section on the Kozy Care home page after scrolling to it. Answer:
1) Are three step cards with icons and text fully visible?
2) Any blank or broken areas?`

const topCheck = `Top half of the Kozy Care /services page. Answer precisely:
1) Is there a navy header titled "Everything Kozy Care does — and what it costs." with Book/Call buttons?
2) Is there a pricing area with Men / Women / Corporate tabs and per-item price cards with naira prices?
3) Any blank areas, broken images, overlap, or layout breakage?`

const bottomCheck = `Bottom half of the Kozy Care /services page. Answer precisely:
1) Are there sections about the atelier (workspace), sneaker restoration, and alterations (tailor)?
2) Is there a "Ready when you are." call-to-action followed by a footer with quick links?
3) Any blank areas, broken images, overlap, or layout breakage?`

const runs = [
  ['/home/z/my-project/work/p45-howitworks.png', hiwCheck, 'HOW IT WORKS (after scroll)'],
  ['/home/z/my-project/work/p45-services-top.png', topCheck, 'SERVICES TOP HALF'],
  ['/home/z/my-project/work/p45-services-bottom.png', bottomCheck, 'SERVICES BOTTOM HALF'],
]

for (const [img, check, label] of runs) {
  console.log(`\n===== ${label} =====`)
  try {
    console.log(await read(img, check))
  } catch (e) {
    console.log('VLM ERROR:', e.message)
  }
}
