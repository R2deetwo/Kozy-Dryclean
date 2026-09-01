// Edit the marketing flyer model into the website's female-customer image
// (same woman + KOZY CARE garment bag => consistent characters across
//  marketing material and website, per client instruction)
import ZAI from '/home/z/Kozy-Dryclean/node_modules/z-ai-web-dev-sdk/dist/index.js'
import fs from 'fs'

async function main() {
  const zai = await ZAI.create()
  const img = fs.readFileSync('/home/z/my-project/work/kozy-brand/flyer-model-garmentbag.png')
  const dataUrl = `data:image/png;base64,${img.toString('base64')}`

  const response = await zai.images.generations.edit({
    prompt:
      'Keep this exact same woman — same face, same smile, same hairstyle, same black top with gold embroidery, same hands — and the same premium navy garment bag with gold KOZY CARE logo that she holds. ONLY change the scene around her: expand into a wider landscape composition where she stands just inside the elegant entrance of an upscale Lagos apartment, receiving her fresh clean laundry delivery, folded white towels peeking from the top of the garment bag, a professional Nigerian courier in a neat navy uniform standing a step behind her with his hands relaxed at his sides, moody golden-hour daylight, cinematic warm-gold contrast, deep navy and gold color grade, shallow depth of field, high-end brand campaign photography, photorealistic, luxury premium feel',
    images: [{ url: dataUrl }],
    size: '1152x864',
  })

  const base64 = response.data[0].base64
  fs.writeFileSync(
    '/home/z/my-project/work/image-rev2/female-customer-v4.png',
    Buffer.from(base64, 'base64')
  )
  console.log('saved female-customer-v4.png')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
