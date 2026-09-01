// Phase 17 — remove the background doorway from handover-cropped.png
// (plain-bag version, BEFORE the brand-K composite so the K can be
// re-composited afterwards with exact fidelity).
import ZAI from '/home/z/Kozy-Dryclean/node_modules/z-ai-web-dev-sdk/dist/index.js'
import fs from 'fs'

const DIR = '/home/z/my-project/work/image-rev4'

async function main() {
  const zai = await ZAI.create()
  const img = fs.readFileSync(`${DIR}/handover-cropped.png`)
  const dataUrl = `data:image/png;base64,${img.toString('base64')}`

  const response = await zai.images.generations.edit({
    prompt:
      'Keep this exact photograph — same two Nigerian people, same faces, same smiles, same eye contact, same poses, same hands, same navy canvas laundry bag (keep it PLAIN and unmarked, no logo), same plants, same veranda, same warm daylight and colors. Make ONLY ONE change: remove the dark doorway and its white door frame in the background behind the woman — replace that area with a continuation of the plain cream wall with the subtle gold trim, so the background is a clean wall. No doors, no door frames, no dark openings anywhere in the background. Photorealistic, premium brand photography.',
    images: [{ url: dataUrl }],
    size: '1152x864',
  })

  const base64 = response.data[0].base64
  fs.writeFileSync(`${DIR}/handover-nodeor.png`, Buffer.from(base64, 'base64'))
  console.log('saved handover-nodeor.png')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
