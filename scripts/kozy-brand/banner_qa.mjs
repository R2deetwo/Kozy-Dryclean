// banner_qa.mjs — verify banners have NO text/letters/wordmarks and read premium.
import ZAI from '/home/z/my-project/node_modules/z-ai-web-dev-sdk/dist/index.js'
import fs from 'fs'

const FILES = process.argv.slice(2)

async function main() {
  const zai = await ZAI.create()
  for (const f of FILES) {
    const img = fs.readFileSync(f)
    const dataUrl = `data:image/jpeg;base64,${img.toString('base64')}`
    const res = await zai.chat.completions.createVision({
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'You are a strict QA reviewer for brand email banners. Answer two questions about this image: 1) TEXT: does it contain ANY text, letters, numbers, words, or logo-like marks? (yes/no + what you see) 2) QUALITY: does it look like a premium luxury brand banner (deep navy/gold family palette, elegant, calm negative space)? One line each, then verdict PASS or FIX.' },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      }],
      thinking: { type: 'disabled' },
    })
    const c = res.choices[0]?.message?.content || 'NO RESPONSE'
    const bad = /FIX/.test(c) || /yes/i.test(c.split('\n')[0])
    console.log(`${f.split('/').pop()}: ${c.trim().split('\n').join(' | ')}`)
    if (bad) console.log(`  ^^ CHECK THIS BANNER`)
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
