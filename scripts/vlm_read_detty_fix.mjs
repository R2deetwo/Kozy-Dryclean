// VLM read of the fixed 52-week plan dialog screenshots.
import ZAI from '/home/z/my-project/node_modules/z-ai-web-dev-sdk/dist/index.js'
import fs from 'fs'

const CHECK = `This is a screenshot of a "52-week content plan" dialog in an admin app. List EXACTLY the rows you can see (week number, category, season label, subject line). Then answer: 1) Does ANY visible row claim Detty December starts before December, or say "one month till Detty December" in September/October? 2) Quote any rows mentioning "Detty December" with their week number and season label.`

async function read(imgPath) {
  const zai = await ZAI.create()
  const img = fs.readFileSync(imgPath)
  const dataUrl = `data:image/png;base64,${img.toString('base64')}`
  const res = await zai.chat.completions.createVision({
    messages: [{ role: 'user', content: [
      { type: 'text', text: CHECK },
      { type: 'image_url', image_url: { url: dataUrl } },
    ]}],
    thinking: { type: 'disabled' },
  })
  return res.choices[0]?.message?.content || 'NO RESPONSE'
}

for (const p of process.argv.slice(2)) {
  console.log(`\n===== ${p} =====`)
  console.log(await read(p))
}
