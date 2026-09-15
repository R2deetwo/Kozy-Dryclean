// Surgical hand fix via z-ai image edit — keeps the rest of the image intact.
import ZAI from '/home/z/my-project/node_modules/z-ai-web-dev-sdk/dist/index.js'
import fs from 'fs'

const IN = process.argv[2]
const OUT = process.argv[3]
const PROMPT = process.argv[4]
const SIZE = process.argv[5] || '864x1152'

async function main() {
  const zai = await ZAI.create()
  const b64 = fs.readFileSync(IN).toString('base64')
  const dataUrl = `data:image/png;base64,${b64}`
  const res = await zai.images.generations.edit({
    prompt: PROMPT,
    images: [{ url: dataUrl }],
    size: SIZE,
  })
  const out = res?.data?.[0]?.base64
  if (!out) {
    console.error('NO IMAGE DATA RETURNED')
    process.exit(1)
  }
  fs.writeFileSync(OUT, Buffer.from(out, 'base64'))
  console.log(`EDITED -> ${OUT}`)
}

main().catch((e) => { console.error(e?.message || e); process.exit(1) })
