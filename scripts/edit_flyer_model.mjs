// Edit the flyer model image: replace gift bundle with KOZY garment bag
import ZAI from '/home/z/Kozy-Dryclean/node_modules/z-ai-web-dev-sdk/dist/index.js'
import fs from 'fs'

async function main() {
  const zai = await ZAI.create()
  const img = fs.readFileSync('/home/z/my-project/upload/pasted_image_1787839917309.png')
  const dataUrl = `data:image/png;base64,${img.toString('base64')}`

  const response = await zai.images.generations.edit({
    prompt:
      'Keep the woman exactly the same — same face, same smile, same pose, same black top with gold embroidery, same hands, same gold arch frame, same navy background. ONLY replace the blue fabric bundle with gold ribbon that she is holding with a premium navy blue dry-cleaning garment bag featuring elegant gold "KOZY CARE" logo text printed on it, with a small gold hanger hook visible at the top. The garment bag is crisp, professional, and held the same way in her hands. Photorealistic, luxury brand quality, keep lighting and colors identical',
    images: [{ url: dataUrl }],
    size: '864x1152',
  })

  const base64 = response.data[0].base64
  fs.writeFileSync('/home/z/my-project/work/kozy-brand/flyer-model-garmentbag.png', Buffer.from(base64, 'base64'))
  console.log('saved flyer-model-garmentbag.png')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
