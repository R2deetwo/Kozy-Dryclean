import ZAI from '/home/z/my-project/node_modules/z-ai-web-dev-sdk/dist/index.js'
import fs from 'fs'
const zai = await ZAI.create()
const img = fs.readFileSync('work/t88-shots/customers-clean.png')
const res = await zai.chat.completions.createVision({
  messages: [{ role: 'user', content: [
    { type: 'text', text: 'Admin CRM table screenshot. Answer briefly: 1) Is there any long explanatory paragraph or developer-jargon footnote text on the page (like "health = ..." definitions or README-style copy)? 2) Does any info repeat between columns? 3) Do member rows show a MEMBER badge? 4) Overall: does this look like a polished professional product? End VERDICT: OK or VERDICT: BAD.' },
    { type: 'image_url', image_url: { url: `data:image/png;base64,${img.toString('base64')}` } },
  ]}],
  thinking: { type: 'disabled' },
})
console.log(res.choices[0]?.message?.content)
