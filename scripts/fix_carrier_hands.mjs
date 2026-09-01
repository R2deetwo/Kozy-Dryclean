// Phase 18: clean up rider's hands on carrier-v4.
// Goal: rider holds bag with (1) right hand gripping top handle,
// (2) left hand supporting under the bottom edge. REMOVE any extra hand
// lying flat on the front face — front face must be clean empty navy fabric.
import ZAI from '/home/z/Kozy-Dryclean/node_modules/z-ai-web-dev-sdk/dist/index.js'
import fs from 'fs'

const DIR = '/home/z/my-project/work/image-rev5'
const zai = await ZAI.create()

const b64 = fs.readFileSync(`${DIR}/carrier-v4.png`).toString('base64')
const dataUrl = `data:image/png;base64,${b64}`

const edits = [
  {
    name: 'carrier-v4-fix1',
    prompt:
      'Keep this photograph exactly the same — same two people, same poses, same faces, same smiles, same navy garment bag, same background, same lighting — with ONE correction only: ' +
      'remove the man\'s hand that lies flat against the front face of the navy garment bag, and also remove any extra or floating hand near the top of the bag that is not clearly gripping the top handle. ' +
      'The man should hold the garment bag with exactly two hands: one hand gripping the top carry handle, and one hand supporting the bag from underneath the bottom edge. ' +
      'Where the removed hand was, show clean continuous smooth dark-navy canvas fabric with the same soft folds, weave texture and lighting as the surrounding fabric — completely empty, no logo, no text. ' +
      'The woman keeps exactly one hand lightly touching the bottom-right corner of the bag. ' +
      'Photorealistic, natural hands with five fingers each, seamless retouch.',
  },
]

for (const e of edits) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await zai.images.generations.edit({
        prompt: e.prompt,
        images: [{ url: dataUrl }],
        size: '1152x864',
      })
      fs.writeFileSync(`${DIR}/${e.name}.png`, Buffer.from(res.data[0].base64, 'base64'))
      console.log('OK', e.name)
      break
    } catch (err) {
      console.error('FAIL', e.name, 'attempt', attempt, err.message)
      if (attempt === 3) throw err
    }
  }
}
