// VLM QA of the phase-46 home-page tightening.
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

const deskFull = `This is a FULL-PAGE desktop screenshot of the Kozy Care laundry home page after a "make it tighter" redesign. Answer precisely:
1) List the sections top to bottom.
2) Does the page feel like a tight conversion page (compact section spacing) rather than a long editorial scroll?
3) Is the "Six services. One pickup." grid showing 6 cards with icons, titles and prices in a clean 3-column layout?
4) Is there a dark navy band near the bottom with a photo background, heading "Care for everything you wear.", gold stat chips and a gold "Book your pickup" button?
5) Are text/background contrasts readable everywhere (especially on that dark photo band)?
6) Any overlap, clipping, broken images, or cramped/unreadable areas?`

const mobFull = `This is a FULL-PAGE mobile (390px) screenshot of the Kozy Care laundry home page after a tightening redesign. Answer precisely:
1) Is the hero readable with both buttons visible?
2) Are the 4 discount offer cards arranged 2-per-row and readable?
3) Are the six service summary cards arranged 2-per-row with icon, title and price readable (no clipped text)?
4) Are the three "how it works" cards fully visible with illustration, number title and body text?
5) Is the guarantee card readable with its boxes?
6) Is the dark photo band with gold chips readable at the bottom before the footer?
7) Any horizontal overflow, clipped text, overlap or broken layout anywhere?`

const bandMob = `This is a mobile (390px) screenshot of a dark navy band on the Kozy Care home page that has a laundry-handover photo as background. Answer:
1) Is the heading "Care for everything you wear." clearly readable over the photo?
2) Are the three gold-outlined stat chips readable?
3) Is the gold "Book your pickup" button visible and readable?
4) Does the photo show through on the right side without making text unreadable?
5) Any layout defects?`

const r1 = await read('work/p46-home-desk-full.png', deskFull)
console.log('=== DESKTOP FULL ===\n' + r1 + '\n')
const r2 = await read('work/p46-home-mob-full.png', mobFull)
console.log('=== MOBILE FULL ===\n' + r2 + '\n')
const r3 = await read('work/p46-band-mob.png', bandMob)
console.log('=== MOBILE BAND ===\n' + r3)
