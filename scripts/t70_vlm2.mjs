// VLM QA of the two phase-70 PDFs (covers + a body page each).
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

const Q = `You are a strict visual QA reviewer looking at a rendered PDF page. Answer in under 80 words: 1) Is the layout clean and professional? 2) Any overlapping, clipped, or garbled text? 3) Any awkward large empty areas? End with VERDICT: OK or VERDICT: BAD.`

for (const [p, l] of [
  ['work/t70_audit_cover_check.png', 'AUDIT COVER'],
  ['work/t70_audit_body_check.png', 'AUDIT BODY p3'],
  ['work/t70_memo_cover_check.png', 'MEMO COVER'],
  ['work/t70_memo_body_check.png', 'MEMO BODY p3'],
]) {
  const out = await read(p, Q).catch((e) => 'ERR ' + e.message)
  console.log(`=== ${l} ===\n${out}\n`)
}
