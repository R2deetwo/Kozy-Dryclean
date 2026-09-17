// VLM read of the promo plan card + prefilled DETTY15 form screenshots.
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

const planCheck = `This is a screenshot of a "Coupons" admin tab with a card titled "The seasonal promo plan". List every season row you can see with: season name, status badge, code, discount, and the date window exactly as written. Then answer: 1) What date window does the "Detty December" row show? 2) Does any row imply Detty December starts before December 15? 3) Is each row's "Create this coupon" button visible?`

const formCheck = `This is a screenshot of a coupon creation form in an admin app, supposedly prefilled for a "Detty December" promo. Quote the exact values shown in: Name, Code, Description, Percentage off, Applies to, Max discount, Start date, End date. Then answer: does the Start date say December 15, and does a hint banner mention the seasonal promo plan?`

console.log('===== promo-plan-card.png =====')
console.log(await read('/home/z/my-project/work/detty-fix/promo-plan-card.png', planCheck))
console.log('\n===== detty15-prefilled-form.png =====')
console.log(await read('/home/z/my-project/work/detty-fix/detty15-prefilled-form.png', formCheck))
