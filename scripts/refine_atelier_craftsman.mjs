// Refinement pass on atelier-craftsman-v3: fix hand anatomy only.
// Keep presser, iron, shirt, atelier, lighting unchanged.
import ZAI from '/home/z/Kozy-Dryclean/node_modules/z-ai-web-dev-sdk/dist/index.js'
import fs from 'fs'

async function main() {
  const zai = await ZAI.create()
  const img = fs.readFileSync('/home/z/my-project/work/image-rev2/atelier-craftsman-v3.png')
  const dataUrl = `data:image/png;base64,${img.toString('base64')}`

  const response = await zai.images.generations.edit({
    prompt:
      'Keep this exact same Nigerian master presser, same face, same navy apron, same steam iron, same crisp white dress shirt on the pressing table, same atelier background, same moody navy-gold lighting. Make ONLY these fixes: (1) correct the hand gripping the iron handle so it shows five distinct well-formed fingers with realistic knuckles and a natural thumb wrapped around the handle; (2) correct the other hand resting on the table so all fingers are naturally separated, well-proportioned and realistic; (3) make the eyes look natural and focused downward at the garment (not glassy). Photorealistic, high-end fashion campaign photography, luxury premium feel',
    images: [{ url: dataUrl }],
    size: '1152x864',
  })

  const base64 = response.data[0].base64
  fs.writeFileSync(
    '/home/z/my-project/work/image-rev2/atelier-craftsman-v4.png',
    Buffer.from(base64, 'base64')
  )
  console.log('saved atelier-craftsman-v4.png')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
