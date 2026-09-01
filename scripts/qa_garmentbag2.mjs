// VLM judge for garment-carrier candidates round 2
import ZAI from '/home/z/Kozy-Dryclean/node_modules/z-ai-web-dev-sdk/dist/index.js'
import fs from 'fs'

const DIR = '/home/z/my-project/work/image-rev5'
const files = process.argv.slice(2)
const zai = await ZAI.create()

for (const f of files) {
  const b64 = fs.readFileSync(`${DIR}/${f}`).toString('base64')
  const res = await zai.chat.completions.createVision({
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: `You are a strict photography QA judge for a premium laundry brand. Analyze this image of a rider handing a navy bi-fold suit carrier (garment bag) to a customer. Answer in this exact format:

SCORES (0-10 each):
photorealism: N
people_natural (hands, fingers, eye contact): N
panel_visible (how flat, large, unobstructed the EMPTY front face of the bag is): N
panel_blank (10 = completely blank, no logo/text/zipper on front face): N
palette_navy_gold: N
overall: N

DETAILS:
bag_type: what bag exactly (shape, orientation, fold, handle, zipper position)
panel_bounding_box: approximate pixel coordinates [left, top, right, bottom] of the flat EMPTY front face of the bag (the large navy fabric expanse), image is 1152 wide x 864 tall
panel_tilt_degrees: approximate rotation of the front face (positive = clockwise)
panel_texture: describe folds/creases/weave on the front face and how evenly it is lit
hands: describe both people's hands and any artifacts
problems: list any visible AI artifacts, extra people, text, logos, zippers crossing the front, or issues
verdict: SHIP or FAIL` },
        { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } }
      ]
    }],
    thinking: { type: 'disabled' }
  })
  const out = res.choices[0]?.message?.content || 'NO RESPONSE'
  fs.writeFileSync(`${DIR}/qa-${f.replace('.png', '')}.txt`, out)
  console.log(`\n===== ${f} =====\n${out}`)
}
