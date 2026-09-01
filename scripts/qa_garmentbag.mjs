// VLM judge for garment-carrier candidates + panel geometry extraction
import ZAI from '/home/z/Kozy-Dryclean/node_modules/z-ai-web-dev-sdk/dist/index.js'
import fs from 'fs'

const DIR = '/home/z/my-project/work/image-rev5'
const files = ['carrier-v1.png', 'carrier-v2.png']
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
bag_visible_front_panel (how flat, large, unobstructed the front panel is): N
panel_blank (10 = completely blank no logo/text): N
palette_navy_gold: N
overall: N

DETAILS:
bag_type: what bag exactly (shape, fold, handle, zipper)
panel_bounding_box: give approximate pixel coordinates [left, top, right, bottom] of the flat front panel of the bag (the large navy fabric face), assuming image width 1152 and height 864
panel_tilt_degrees: approximate rotation of the panel (positive = clockwise)
panel_texture: describe folds/creases on the panel
hands: describe both people's hands and any artifacts
problems: list any visible AI artifacts, extra people, text, logos, or issues
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
