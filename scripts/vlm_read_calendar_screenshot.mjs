// Read the user's screenshot of the marketing calendar UI.
import ZAI from '/home/z/my-project/node_modules/z-ai-web-dev-sdk/dist/index.js'
import fs from 'fs'

const IMG = '/home/z/my-project/upload/pasted_image_1789585466349.png'

const CHECK = `This is a screenshot of a marketing calendar / newsletter content plan UI. Describe EXACTLY what is shown, focusing on anything mentioning "Detty December", months (October, November, December), week numbers, dates, or season labels. Quote any text rows that mention December/Detty December along with their month or week label as shown on screen. Also state which part of the app this screen appears to be.`

async function main() {
  const zai = await ZAI.create()
  const img = fs.readFileSync(IMG)
  const dataUrl = `data:image/png;base64,${img.toString('base64')}`
  const res = await zai.chat.completions.createVision({
    messages: [{ role: 'user', content: [
      { type: 'text', text: CHECK },
      { type: 'image_url', image_url: { url: dataUrl } },
    ]}],
    thinking: { type: 'disabled' },
  })
  console.log(res.choices[0]?.message?.content || 'NO RESPONSE')
}
main().catch((e) => { console.error(e); process.exit(1) })
