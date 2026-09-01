// Phase 17 image regeneration:
//  1. laundry-handover v2 — rider hands navy canvas laundry bag to customer.
//     Brief (owner feedback): no doorway (door had hinges on both sides),
//     natural relaxed hands, natural friendly eye contact, plain bag
//     (exact brand K composited afterwards with PIL for pixel accuracy).
//  2. seamstress v2 — YOUNGER seamstress (late 20s) WORKING at a sewing
//     machine, white/cream wallpaper (not navy/blue), brand palette accents.
// Both photorealistic premium (site style), 1152x864.
import ZAI from '/home/z/Kozy-Dryclean/node_modules/z-ai-web-dev-sdk/dist/index.js'
import fs from 'fs'

const OUT = '/home/z/my-project/work/image-rev4'

const HANDOVER_PROMPT = `Photorealistic premium lifestyle photograph for a luxury Lagos laundry brand, warm afternoon daylight. Scene: a friendly young Nigerian delivery rider in a smart deep-navy uniform polo shirt with subtle gold piping hands a full navy-blue canvas drawstring laundry bag to a happy young Nigerian woman customer, outdoors on the bright sunlit front veranda terrace of her modern apartment, potted plants and a cream-painted wall with warm gold trim behind them. The handover moment: the rider supports the bag from underneath with both hands, offering it out towards her; the customer has just received it, cradling the bag comfortably in both arms against her side, its wide flat front panel facing the camera mostly straight-on. The plain unmarked navy canvas bag is soft structured, like a quality duffel laundry bag. Both people stand relaxed and natural, shoulders easy, smiling warmly and looking at each other with genuine friendly eye contact, like old neighbours. Exactly two people, full bodies visible waist-up. Natural well-formed hands with five fingers each, relaxed grip, no awkward twisting. No doorway, no door frame, no hinges. Styling: luxury brand campaign photography, soft golden-hour light, shallow depth of field, rich navy and warm gold color palette, crisp fabric textures, authentic Nigerian faces, cheerful premium mood.`

const SEAMSTRESS_PROMPT = `Photorealistic premium photograph for a luxury Lagos garment-care brand. A skilled young Nigerian seamstress in her late twenties, warm confident smile, wearing a smart deep-navy apron over a crisp cream blouse, a soft gold measuring tape draped around her neck, seated at her sewing machine WORKING: guiding navy fabric under the needle with both hands, one hand steering the fabric edge, the other supporting the roll, her eyes focused down on the stitching line. A classic full-size sewing machine in matte navy with gold details sits on a light wooden worktable, with a small pair of dressmaker shears, colorful thread spools and pins in a pincushion neatly arranged beside it. Background: bright airy tailoring studio with PLAIN WHITE wallpaper with a very subtle faint cream damask texture, softly lit by natural daylight from a large window, one brass wall sconce, a wooden rail of hanging garments softly out of focus behind her. Exactly one person. Natural well-formed hands with five fingers each in a realistic sewing posture. Warm gold and navy brand accents against the fresh white room. Luxury brand campaign photography, shallow depth of field, crisp fabric texture, authentic Nigerian features, bright clean and premium.`

async function gen(zai, prompt, name) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await zai.images.generations.create({
        prompt,
        size: '1152x864',
      })
      const base64 = response.data[0].base64
      const file = `${OUT}/${name}.png`
      fs.writeFileSync(file, Buffer.from(base64, 'base64'))
      console.log(`saved ${file}`)
      return file
    } catch (e) {
      console.error(`${name} attempt ${attempt} failed: ${e?.message?.slice(0, 200)}`)
      if (attempt === 3) throw e
      await new Promise((r) => setTimeout(r, 3000))
    }
  }
}

async function main() {
  const zai = await ZAI.create()
  await gen(zai, HANDOVER_PROMPT, 'handover-v1')
  await gen(zai, HANDOVER_PROMPT, 'handover-v2')
  await gen(zai, SEAMSTRESS_PROMPT, 'seamstress-v1')
  await gen(zai, SEAMSTRESS_PROMPT, 'seamstress-v2')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
