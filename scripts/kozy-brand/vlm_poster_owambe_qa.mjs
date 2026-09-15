// v9.1 owambe poster QA — ladies' faces/hands + brand rules + layout.
import ZAI from '/home/z/my-project/node_modules/z-ai-web-dev-sdk/dist/index.js'
import fs from 'fs'

const IMG = process.argv[2]
const OUTJSON = '/home/z/my-project/work/kozy-brand/marketing-v9/vlm-poster-owambe.json'

const CHECK = `You are a strict brand QA reviewer for Kozy Care (premium dry cleaning, Lagos). This is an A3 poster featuring a photo of three Nigerians at an owambe party (man in cream agbada centre, two women in gele). The client rejected the previous version because the right-hand woman had BLACK, disturbing eyes and the left-hand woman had ill-formed fingers resting on the man's shoulder. Inspect at pixel level:

1. THE WOMEN'S EYES: zoom your attention to both women's eyes. Natural? White sclera visible? Normal pupils? Any black voids or disturbing eyes?
2. HANDS/FINGERS: any malformed, fused, extra or missing fingers? Is any hand resting on the man's shoulder or touching another person? Describe each visible hand.
3. WORDMARK at top: quote the brand name exactly. Title case "Kozy Care" with K monogram left and gold uppercase subtitle under it (matching the website)? Does ANY decoration or line cross over the wordmark?
4. IMAGE CROP: are all three people fully inside the gold arch frame — heads not cut off, nothing awkwardly cropped?
5. LAYOUT: headline, offer band, QR footer — all fully visible and neatly aligned? Phone on one line? Any clipped or overlapping text?
6. CONFETTI: do the gold confetti dots stay clear of the wordmark and out of the people's faces?
7. VERDICT: PASS or FIX (single worst issue).`

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
