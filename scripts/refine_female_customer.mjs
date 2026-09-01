// Refinement pass on female-customer-v4: remove towel obscuring the KOZY CARE
// logo, fix hand anatomy. Keep woman, bag, scene, lighting unchanged.
import ZAI from '/home/z/Kozy-Dryclean/node_modules/z-ai-web-dev-sdk/dist/index.js'
import fs from 'fs'

async function main() {
  const zai = await ZAI.create()
  const img = fs.readFileSync('/home/z/my-project/work/image-rev2/female-customer-v4.png')
  const dataUrl = `data:image/png;base64,${img.toString('base64')}`

  const response = await zai.images.generations.edit({
    prompt:
      'Keep this exact same woman, same face, same smile, same outfit, same navy garment bag, same background scene, same lighting and colors. Make ONLY these two fixes: (1) Remove the white towel draped over the garment bag completely — the bag should be clean and closed so the gold "KOZY CARE" logo text on it is fully visible and unobstructed; (2) correct her hands so they hold the bag naturally with five well-formed distinct fingers per hand, realistic knuckles and natural thumb placement. Photorealistic, high-end brand campaign photography, luxury premium feel',
    images: [{ url: dataUrl }],
    size: '1152x864',
  })

  const base64 = response.data[0].base64
  fs.writeFileSync(
    '/home/z/my-project/work/image-rev2/female-customer-v5.png',
    Buffer.from(base64, 'base64')
  )
  console.log('saved female-customer-v5.png')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
