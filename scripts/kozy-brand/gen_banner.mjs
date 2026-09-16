// gen_banner.mjs — direct SDK image generation with a custom size
// (CLI restricts sizes; the API accepts multiples of 32 → 1472x736 = 2:1).
import ZAI from '/home/z/my-project/node_modules/z-ai-web-dev-sdk/dist/index.js'
import fs from 'fs'

const OUT = process.argv[2]
const PROMPT = fs.readFileSync(process.argv[3], 'utf-8')

async function main() {
  const zai = await ZAI.create()
  const res = await zai.images.generations.create({
    prompt: PROMPT,
    size: '1472x736',
  })
  const b64 = res?.data?.[0]?.base64
  if (!b64) {
    console.error('NO IMAGE DATA RETURNED')
    process.exit(1)
  }
  fs.writeFileSync(OUT, Buffer.from(b64, 'base64'))
  console.log(`OK -> ${OUT}`)
}

main().catch((e) => { console.error(e?.message || e); process.exit(1) })
