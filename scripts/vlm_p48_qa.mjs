// VLM QA of phase 48: mobile Pricing pill + hero corner cleanup.
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

const navCheck = `This is a 375px-wide mobile screenshot of the top navigation bar of the Kozy Care laundry website. Answer precisely:
1) Describe every element you see left to right, row by row.
2) Is there a "Pricing" pill button? Does it look styled consistently with the "Sign in" / "Sign up" pill buttons (same rounded pill shape)?
3) Does anything look cramped, clipped, overlapping or misaligned?
4) Overall, does the nav look neat and professional?`

const heroCheck = `This is a desktop screenshot of the hero image area of the Kozy Care laundry home page: pressed white shirts on hangers in a rounded card. Answer precisely:
1) Is there any white card floating over the bottom-left corner of the image overlapping the dark navy caption?
2) What does the navy caption in the bottom-left say? Is it fully readable and unobstructed?
3) Is there a small gold pill in the bottom-right? Is it readable?
4) Any leftover empty space, visual artifacts, or awkward gaps around the image edges (especially bottom-left where a floating card used to hang outside the image)?
5) Does the image area look clean and intentional?`

const nav = await read('work/p48-after-nav-375.png', navCheck)
console.log('=== MOBILE NAV (375) ===\n' + nav + '\n')
const hero = await read('work/p48-after-hero-corner.png', heroCheck)
console.log('=== HERO CORNER (desktop) ===\n' + hero + '\n')
