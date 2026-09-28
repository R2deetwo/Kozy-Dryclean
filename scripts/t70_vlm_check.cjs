// VLM sanity check on the two covers + a body page each.
const ZAI = require('z-ai-web-dev-sdk').default
const fs = require('fs')

async function check(zai, path, label) {
  const b64 = fs.readFileSync(path).toString('base64')
  const res = await zai.chat.completions.create({
    messages: [
      { role: 'user', content: [
        { type: 'text', text: 'This is a PDF page render. In 2-3 sentences: is the layout clean and professional? Any overlapping, clipped, or garbled text? End with VERDICT: OK or VERDICT: BAD.' },
        { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}` } },
      ]},
    ],
    thinking: { type: 'disabled' },
  })
  console.log(`--- ${label} ---`)
  console.log(res.choices[0]?.message?.content?.slice(0, 500))
}

;(async () => {
  const zai = await ZAI.create()
  for (const [p, l] of [
    ['work/t70_audit_cover_check.png', 'audit cover'],
    ['work/t70_audit_body_check.png', 'audit body page 3'],
    ['work/t70_memo_cover_check.png', 'memo cover'],
    ['work/t70_memo_body_check.png', 'memo body page 3'],
  ]) {
    await check(zai, p, l).catch((e) => console.log(l, 'ERR', e.message))
  }
})()
