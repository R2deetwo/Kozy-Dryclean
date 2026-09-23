// VLM QA of phase 51: reworked condition-photo step (30-photo staged uploads).
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

const check = `This is a screenshot of the condition-photo step of a laundry booking wizard ("Activate your Return-as-Received Guarantee"). Answer precisely:
1) Is there an upload button ("Take or upload photos") and a counter reading "8/30 photos - optional"?
2) Is there a short "Getting good photos" guidance panel with bullet points? Does it read cleanly (not overlapping anything)?
3) Is there a grid of 8 small square photo tiles with remove (x) buttons?
4) Does everything look visually consistent with a premium navy/gold brand? Anything cramped, clipped, overlapping, misaligned or confusing?
5) Is the terms checkbox and any guarantee explanation visible and readable?`

const desk = await read('work/p51-photostep-desktop.png', check)
console.log('=== DESKTOP PHOTO STEP ===\n' + desk + '\n')

const mcheck = `This is a MOBILE (375px wide) screenshot of the condition-photo step of a laundry booking wizard. Answer precisely:
1) Is the "Take or upload photos" button fully visible and tappable-sized?
2) Is the "8/30 photos" counter visible?
3) Is the "Getting good photos" guidance readable, with bullets wrapping cleanly (no horizontal overflow, no cut-off text)?
4) Are the photo tiles laid out in a neat grid?
5) Anything clipped, overlapping or overflowing the screen edges?`
const mob = await read('work/p51-photostep-mobile.png', mcheck)
console.log('=== MOBILE PHOTO STEP (375) ===\n' + mob + '\n')
