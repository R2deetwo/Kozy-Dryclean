// VLM QA of phase 49: navy Pricing pill aligned in the account cluster.
import ZAI from '/home/z/my-project/node_modules/z-ai-web-dev-sdk/dist/index.js'
import fs from 'fs'

async function read(imgPath, check) {
  const zai = await ZAI.create()
  const img = fs.readFileSync(imgPath)
  const dataUrl = `data:image/png;base64,${img.toString('base64')}`
  const res = await zai.chat.completions.createVision({
    messages: [{ role: 'user', content: [
      { type: 'text', text: check },
      { type: 'image_url', image_url: { url: dataUrl } },
    ]}],
    thinking: { type: 'disabled' },
  })
  return res.choices[0]?.message?.content || 'NO RESPONSE'
}

const check = `This is a screenshot of the top navigation bar of the Kozy Care laundry website. Answer precisely:
1) Describe the buttons/pills you see and their colors.
2) Is there a "Pricing" pill? Is it dark navy blue with white text and a small tag icon?
3) Is the Pricing pill on the SAME ROW and vertically aligned with the "Sign in" and "Sign up" pills (tops and bottoms lining up)?
4) Do the three pills look like one consistent button family (same size, same rounded pill shape)?
5) Anything cramped, clipped, overlapping or misaligned?`

const mob = await read('work/p49-nav-375.png', check)
console.log('=== MOBILE NAV (375) ===\n' + mob + '\n')
const desk = await read('work/p49-nav-1440.png', check)
console.log('=== DESKTOP NAV (1440) ===\n' + desk + '\n')
