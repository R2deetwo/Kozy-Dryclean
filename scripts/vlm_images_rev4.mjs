// VLM QA scoring for the 4 phase-17 image candidates.
import ZAI from '/home/z/Kozy-Dryclean/node_modules/z-ai-web-dev-sdk/dist/index.js'
import fs from 'fs'

const DIR = '/home/z/my-project/work/image-rev4'

const CHECKS = {
  'handover-v1': `You are a strict art director QA-ing a luxury laundry brand photo. Image shows a rider handing a navy canvas laundry bag to a female customer. Score /10 each and answer precisely:
1. PHOTOREALISM (any AI artifacts?)
2. HANDS: describe every visible hand. Count fingers per hand. Any deformed, fused, or awkward hands? Any unnatural grip?
3. EYE CONTACT: are both people looking at each other naturally? Describe.
4. SETTING: is there any doorway, door frame, or hinge visible? Where exactly are they?
5. PEOPLE COUNT: exactly 2?
6. BAG: is the bag's front panel visible and mostly flat toward camera? Is it plain/unmarked (no logo/text)? Which direction does it face and roughly what fraction of the frame does it occupy, positioned where?
7. BRAND FIT: navy/gold premium palette? 
8. VERDICT: SHIP or FIX (with the single most important fix)`,
  'handover-v2': null, // same prompt, filled at runtime
  'seamstress-v1': `You are a strict art director QA-ing a luxury garment-care brand photo. Image shows a young Nigerian seamstress working at a sewing machine. Score /10 each and answer precisely:
1. PHOTOREALISM (any AI artifacts, waxy skin?)
2. AGE: how old does she look? (target: late 20s, definitely younger than 35)
3. SEWING MACHINE: is a real full-size sewing machine clearly visible? Is she actively sewing/guiding fabric under the needle?
4. HANDS: describe every visible hand, count fingers, note deformities. Realistic sewing posture?
5. WALL: what color is the wall/wallpaper behind her? (target: white/cream, NOT navy/blue)
6. PALETTE: navy/gold brand accents present but wall light?
7. VERDICT: SHIP or FIX (single most important fix)`,
  'seamstress-v2': null,
}

async function main() {
  const zai = await ZAI.create()
  CHECKS['handover-v2'] = CHECKS['handover-v1']
  CHECKS['seamstress-v2'] = CHECKS['seamstress-v1']

  for (const name of Object.keys(CHECKS)) {
    const img = fs.readFileSync(`${DIR}/${name}.png`)
    const dataUrl = `data:image/png;base64,${img.toString('base64')}`
    const res = await zai.chat.completions.createVision({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: CHECKS[name] },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
      thinking: { type: 'disabled' },
    })
    const content = res.choices[0]?.message?.content || 'NO RESPONSE'
    fs.writeFileSync(`${DIR}/vlm-${name}.json`, JSON.stringify(res, null, 2))
    console.log(`\n========== ${name} ==========\n${content}\n`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
