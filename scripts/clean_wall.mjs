// Phase 17 — edit pass 2: make the background wall fully clean (the first
// pass replaced the doorway with a large gold-framed blank rectangle that
// still reads like a door to a picky viewer).
import ZAI from '/home/z/Kozy-Dryclean/node_modules/z-ai-web-dev-sdk/dist/index.js'
import fs from 'fs'

const DIR = '/home/z/my-project/work/image-rev4'

async function main() {
  const zai = await ZAI.create()
  const img = fs.readFileSync(`${DIR}/handover-nodeor.png`)
  const dataUrl = `data:image/png;base64,${img.toString('base64')}`

  const response = await zai.images.generations.edit({
    prompt:
      'Keep this exact photograph — same two Nigerian people, same faces, same smiles, same natural eye contact, same poses and hands, same plain navy canvas laundry bag with no logo, same potted greenery at the sides, same warm daylight, same colors and composition. Make ONLY ONE change: the large gold-framed blank rectangle on the wall behind the two people must be REMOVED COMPLETELY — fill it in with the same plain continuous cream wall that surrounds it, with the same subtle wall texture and shading, so the wall is one clean unbroken surface with nothing hanging on it. No frames, no artwork, no mirrors, no panels, no doors — just the plain wall. Photorealistic, premium brand photography.',
    images: [{ url: dataUrl }],
    size: '1152x864',
  })

  const base64 = response.data[0].base64
  fs.writeFileSync(`${DIR}/handover-cleanwall.png`, Buffer.from(base64, 'base64'))
  console.log('saved handover-cleanwall.png')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
