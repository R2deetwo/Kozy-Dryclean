// Finger/hand anatomy audit — strict VLM QA for every human image in the
// current Kozy set. Usage: node vlm_finger_audit.mjs <image> <json-out> <context-description>
import ZAI from '/home/z/my-project/node_modules/z-ai-web-dev-sdk/dist/index.js'
import fs from 'fs'

const IMG = process.argv[2]
const OUT = process.argv[3]
const CONTEXT = process.argv[4] || 'a marketing photo for a laundry brand'

const CHECK = `You are an extremely strict anatomical QA reviewer for AI-generated photography. The client has REJECTED previous images because of malformed fingers — this audit exists to catch exactly that. Image context: ${CONTEXT}.

Inspect the image at pixel level and itemize EVERY visible hand. For EACH hand answer:
- WHO it belongs to and WHAT it is doing / holding / resting on
- COUNT OF FINGERS visible (including thumb): state the number
- Are the fingers well-formed, natural, and correctly proportioned? Or are any fused together, melted, extra, missing, too long/short, bent at impossible angles, or merging into clothing/objects?
- Is the thumb opposable and on the correct side?

Then answer:
1. EYES — for every person: are eyes natural (white sclera visible, normal pupils, no black voids, no demonic or asymmetric look)?
2. FACES/TEETH/JEWELRY — any warping, melting, or asymmetry?
3. LIMBS — arms/legs natural lengths and joints? Any limb merging into another person or object?
4. OVERALL — would a demanding art director approve this for print at A3 size?

VERDICT line at the end, exactly one of:
PASS — all hands and fingers anatomically correct, eyes natural
FIX — defects found (name the single worst one and which person/hand it is on)`

async function main() {
  const zai = await ZAI.create()
  const img = fs.readFileSync(IMG)
  const dataUrl = `data:image/png;base64,${img.toString('base64')}`
  const res = await zai.chat.completions.createVision({
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: CHECK },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ],
    thinking: { type: 'disabled' },
  })
  const content = res.choices[0]?.message?.content || 'NO RESPONSE'
  fs.writeFileSync(OUT, JSON.stringify(res, null, 2))
  console.log(`===== ${IMG} =====`)
  console.log(content)
  console.log(content.includes('FIX —') ? '\n>>> RESULT: FIX NEEDED' : '\n>>> RESULT: PASS')
}

main().catch((e) => { console.error(e); process.exit(1) })
