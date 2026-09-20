// VLM QA of the phase-42 smooth-load changes.
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

const heroCheck = `This is a mobile screenshot of the Kozy Care laundry landing page hero. Answer precisely:
1) Is the headline "Uncompromising care. Exceptional convenience." fully visible?
2) Are the two CTA buttons ("Book Pickup Now", "Track My Orders") visible?
3) Is the hero image (pressed shirts) rendered or does it show a blank/broken area?
4) Does the page look complete and professionally styled (navy background, gold accents)?
5) Any blank white areas, overlapping text, or layout breakage?`

const noJsCheck = `This mobile screenshot was taken with JavaScript completely disabled. Answer:
1) Is the hero headline and hero image visible?
2) Does the top navigation bar show logo + Sign in / Sign up buttons?
3) Overall: does this look like a fully rendered landing page or a broken/blank one?`

const skeletonCheck = `This mobile screenshot shows a loading state during navigation to a booking page. Answer:
1) Do you see shimmering/gradient placeholder blocks (skeleton loading UI)?
2) Does it show a top nav placeholder, step chips, and a grid of card placeholders?
3) Does it look like a polished branded loading state (navy/gold theme) rather than a blank screen?`

const desktopCheck = `Desktop screenshot of a laundry service landing page. Answer:
1) Is the hero section complete: headline left, pressed-shirts image right with a floating rating card?
2) Any layout breakage, missing images, or overlapping elements?
3) Rate visual polish 1-10.`

console.log('===== mobile-top.png (normal load) =====')
console.log(await read('/home/z/my-project/work/p42/mobile-top.png', heroCheck))
console.log('\n===== no-js-mobile.png (JS disabled) =====')
console.log(await read('/home/z/my-project/work/p42/no-js-mobile.png', noJsCheck))
console.log('\n===== book-skeleton-throttled.png =====')
console.log(await read('/home/z/my-project/work/p42/book-skeleton-throttled.png', skeletonCheck))
console.log('\n===== desktop-top.png =====')
console.log(await read('/home/z/my-project/work/p42/desktop-top.png', desktopCheck))
