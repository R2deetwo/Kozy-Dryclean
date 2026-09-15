// v9.1 QA — the new owambe party asset: strict check on the two client-flagged
// defects (black/disturbing eyes; ill-formed fingers on the man's shoulder).
import ZAI from '/home/z/my-project/node_modules/z-ai-web-dev-sdk/dist/index.js'
import fs from 'fs'

const IMG = process.argv[2] || '/home/z/my-project/work/kozy-brand/marketing-v9/images/asset-owambe-party.png'
const OUT = process.argv[3] || '/home/z/my-project/work/kozy-brand/marketing-v9/images/vlm-owambe.json'

const CHECK = `You are an extremely strict photography QA reviewer. This is an AI-generated marketing photo of three Nigerians at an owambe party (a man in a cream agbada in the middle, two women in party gowns and gele headwraps). The previous version had two defects that MUST NOT be present now. Inspect the image at pixel level and answer each question honestly:

1. EYES — Look closely at EVERY person's eyes, especially the woman on the RIGHT side. Are all eyes natural and normal? Is the white of the eye (sclera) clearly visible and white (not black voids, not dark holes, not glazed-over black)? Are pupils normal-sized? Any unsettling, demonic, asymmetric or disturbing eyes? Describe each person's eyes.
2. HANDS — Look closely at every visible hand and finger, especially near the man's shoulders. Is any hand resting ON the man's shoulder or touching another person? Count problems: are there malformed, fused, extra, or missing fingers? Are hands anatomically correct with five well-formed fingers? Describe what each visible hand is doing.
3. FACES — any other facial distortions (warped mouths, melted jewelry, asymmetry)?
4. CULTURE — do the outfits read as authentic Nigerian owambe (agbada + fila cap on the man; gele headwraps + lace/aso-oke gowns on the women)?
5. OVERALL — is the image dignified and premium enough for a luxury laundry brand's A3 poster?

VERDICT line at the end, exactly one of:
PASS — no eye or hand defects
FIX — defects found (name the single worst one)`

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
  console.log(content)
  console.log(content.includes('FIX —') ? '\n>>> RESULT: FIX NEEDED' : '\n>>> RESULT: PASS')
}

main().catch((e) => { console.error(e); process.exit(1) })
