// QA the hybrid candidates: glyph fidelity + print realism
import ZAI from '/home/z/Kozy-Dryclean/node_modules/z-ai-web-dev-sdk/dist/index.js'
import fs from 'fs'

const DIR = '/home/z/my-project/work/image-rev5'
const files = process.argv.slice(2)
const zai = await ZAI.create()

// reference brand K for glyph comparison
const kref = fs.readFileSync(`${DIR}/k-ref.png`).toString('base64')

for (const f of files) {
  const b64 = fs.readFileSync(`${DIR}/${f}`).toString('base64')
  const res = await zai.chat.completions.createVision({
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: `Image 1 is the REFERENCE brand mark: a serif capital K whose top-right stroke sweeps down in a long curve, with a small dot ornament at the lower-left. Image 2 is a photograph of a navy garment bag with a gold K monogram printed on it. Compare the monogram in image 2 against the reference in image 1 and answer:

GLYPH_FIDELITY (0-10): how exactly does the monogram match the reference letterform (stem, serifs, top-right sweeping curve, and especially the small dot ornament at lower-left)?
DOT_PRESENT: yes/no — is the small dot ornament visible?
FLOURISH_PRESENT: yes/no — is the long sweeping top-right curve visible?
PRINT_REALISM (0-10): does the gold K look physically printed into the woven navy fabric (matte pigment, weave visible through ink, soft edges) vs a digital sticker overlay?
GLOW: does it glow/float unnaturally? yes/no
SCENE_INTACT: are the two people, hands, faces and background unchanged and artifact-free? yes/no + notes
VERDICT: SHIP or FIX + one-line reason` },
        { type: 'image_url', image_url: { url: `data:image/png;base64,${kref}` } },
        { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } }
      ]
    }],
    thinking: { type: 'disabled' }
  })
  const out = res.choices[0]?.message?.content || 'NO RESPONSE'
  fs.writeFileSync(`${DIR}/qa-${f.replace('.png', '')}.txt`, out)
  console.log(`\n===== ${f} =====\n${out}`)
}
