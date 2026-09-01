// Phase 18 v5b: multiple hybrid candidates with the brand-dot emphasized.
import ZAI from '/home/z/Kozy-Dryclean/node_modules/z-ai-web-dev-sdk/dist/index.js'
import fs from 'fs'

const DIR = '/home/z/my-project/work/image-rev5'
const zai = await ZAI.create()

const b64 = fs.readFileSync(`${DIR}/carrier-k-printed4.png`).toString('base64')
const dataUrl = `data:image/png;base64,${b64}`

const shared =
  'Keep this photograph exactly the same — same two people, same poses, same faces, same navy garment bag, same background, same lighting — with ONE enhancement only: ' +
  're-render the gold letter K monogram on the front of the navy garment bag so it looks genuinely SCREEN-PRINTED at the factory: matte antique-gold pigment ink absorbed into the woven fabric, ' +
  'the fabric\'s fine weave texture faintly visible through the ink, slightly uneven ink density, soft edges where the ink meets the threads, no gloss, no metallic shine, no glow. '

const glyphCritical =
  'CRITICAL — preserve the EXACT letterform, size, position and angle: a high-contrast serif capital K whose top-right diagonal stroke sweeps down in a long elegant curve, ' +
  'TOGETHER WITH the small gold dot (period) ornament that sits just to the lower-left of the K stem — the dot is part of the brand mark and MUST remain visible. '

const variants = [
  { name: 'carrier-k-hybrid2', extra: 'Subtle, understated premium branding: muted matte ink like a luxury hotel suit carrier.' },
  { name: 'carrier-k-hybrid3', extra: 'Slightly worn vintage print: the ink has very slight fading in places, believable fabric absorption.' },
  { name: 'carrier-k-hybrid4', extra: 'Clean crisp factory print: even matte ink coverage, weave visible through ink, perfectly believable product photography.' },
]

for (const v of variants) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await zai.images.generations.edit({
        prompt: shared + glyphCritical + v.extra,
        images: [{ url: dataUrl }],
        size: '1152x864',
      })
      fs.writeFileSync(`${DIR}/${v.name}.png`, Buffer.from(res.data[0].base64, 'base64'))
      console.log('OK', v.name)
      break
    } catch (e) {
      console.error('FAIL', v.name, 'attempt', attempt, e.message)
      if (attempt === 3) throw e
    }
  }
}
