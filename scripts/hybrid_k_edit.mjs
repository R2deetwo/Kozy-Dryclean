// Phase 18 v5 (hybrid): use the v4 composited K as a position/shape guide,
// then ask the edit model to re-render it as genuinely screen-printed ink
// integrated into the fabric weave — keeping the exact letterform.
import ZAI from '/home/z/Kozy-Dryclean/node_modules/z-ai-web-dev-sdk/dist/index.js'
import fs from 'fs'

const DIR = '/home/z/my-project/work/image-rev5'
const zai = await ZAI.create()

const b64 = fs.readFileSync(`${DIR}/carrier-k-printed4.png`).toString('base64')
const dataUrl = `data:image/png;base64,${b64}`

const prompt =
  'Keep this photograph exactly the same — same two people, same poses, same faces, same navy garment bag, same background, same lighting, same composition — with ONE enhancement only: ' +
  'the gold serif letter K monogram on the front of the navy garment bag currently looks like a flat digital sticker. Re-render it so it looks like a REAL screen-printed logo done at the bag factory: ' +
  'matte antique-gold ink absorbed into the woven navy fabric, the fabric\'s fine weave texture clearly showing through the ink, ' +
  'slightly uneven ink density, soft edges where ink meets the threads, subtle darker ink pooling at the stencil edges, no gloss, no shine, no metallic effect. ' +
  'CRITICAL: keep the exact same letterform — the same serif K shape with its distinctive curved top-right stroke and small dot ornament, same size, same position, same angle on the bag. ' +
  'Do not add any other text or logos. Photorealistic, seamless, premium garment-bag branding.'

for (let attempt = 1; attempt <= 3; attempt++) {
  try {
    const res = await zai.images.generations.edit({
      prompt,
      images: [{ url: dataUrl }],
      size: '1152x864',
    })
    fs.writeFileSync(`${DIR}/carrier-k-hybrid1.png`, Buffer.from(res.data[0].base64, 'base64'))
    console.log('OK carrier-k-hybrid1')
    break
  } catch (e) {
    console.error('FAIL attempt', attempt, e.message)
    if (attempt === 3) throw e
  }
}
