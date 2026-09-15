// v9.1 bag visual QA — check the neat social box + overall bag layout.
import ZAI from '/home/z/my-project/node_modules/z-ai-web-dev-sdk/dist/index.js'
import fs from 'fs'

const IMG = process.argv[2]
const OUTJSON = process.argv[3] || '/home/z/my-project/work/kozy-brand/marketing-v9/vlm-bag.json'

const CHECK = `You are a strict brand QA reviewer for Kozy Care (premium laundry, Lagos). This is the artwork for a navy nylon laundry bag (450x600mm), rendered flat. The client's #1 request: the SOCIAL MEDIA SECTION must sit in ONE NEAT BOX — QR code + social handles + phone together, tightly aligned, nothing scattered. Answer precisely:

1. WORDMARK: at the top — quote the brand name exactly as written. Is it "Kozy Care" in title case (matching the website), Playfair-style serif, with a K monogram to its LEFT and a small gold uppercase subtitle under it? Is there ANY line or decoration crossing over the wordmark?
2. THE SOCIAL BOX: is there ONE clearly bordered box containing (a) a QR code with a caption, (b) social media rows with icons and handles, and (c) a CALL/WHATSAPP phone row? Is the box neatly aligned inside (rows flush left, consistent spacing)? Or does anything look scattered / misaligned / floating outside the box?
3. QR: is the QR crisp with a white quiet zone, sitting on a white pad, with a K monogram visible in its centre?
4. PHONE: quote the phone number. Is it on ONE unbroken line?
5. LIST any text that looks clipped, overlapping, crowded, or off-centre anywhere on the bag.
6. BALANCE: does the bag read premium and uncluttered? Any area too empty or too crowded?
7. VERDICT: PASS or FIX (single most important fix).`

async function main() {
  const zai = await ZAI.create()
  const img = fs.readFileSync(IMG)
  const dataUrl = `data:image/png;base64,${img.toString('base64')}`
  const res = await zai.chat.completions.createVision({
    messages: [{ role: 'user', content: [
      { type: 'text', text: CHECK },
      { type: 'image_url', image_url: { url: dataUrl } },
    ]}],
    thinking: { type: 'disabled' },
  })
  const content = res.choices[0]?.message?.content || 'NO RESPONSE'
  fs.writeFileSync(OUTJSON, JSON.stringify(res, null, 2))
  console.log(content)
}
main().catch((e) => { console.error(e); process.exit(1) })
