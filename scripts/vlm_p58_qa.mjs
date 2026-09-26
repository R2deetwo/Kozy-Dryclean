// VLM QA of phase 58 — login banner + short-viewport admin sidebar. Pure image REVIEW.
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

const PREAMBLE = `You are a strict visual QA reviewer. You are LOOKING AT a screenshot — review it. Do NOT write HTML, CSS or code of any kind. Answer the numbered questions in plain prose only.`

const banner = await read('work/p58-login-banner.png', `${PREAMBLE}
This is the sign-in page of a premium Lagos laundry service (navy/linen/gold palette). The person is ALREADY signed in as an admin, and the page now shows a soft banner stating that, instead of silently redirecting them into the console.
Questions:
1) Do you see the banner saying the visitor is already signed in? Does it show an email address and two buttons ("Continue as ..." and "Sign out")?
2) Below the banner, is the sign-in form fully visible and usable (email prefilled, password field, gold Sign in button)?
3) Is the banner calm and clearly worded — does it explain that you can continue OR sign in with a different account below?
4) Any clipping, overlap, or visual bugs? Rate overall polish 1-10.`)
console.log('=== LOGIN BANNER (desktop) ===\n' + banner + '\n')

const sidebar = await read('work/p58-sidebar-640.png', `${PREAMBLE}
This is the full admin console of the same service, rendered on a SHORT laptop viewport (1280x640). The left navy sidebar has 13 navigation items; the fix under review makes the nav list scroll internally so the bottom of the sidebar (a "Live — lists update automatically" strip, then "Change password" and "Sign out" buttons) is ALWAYS visible.
Questions:
1) Is the "Sign out" button visible at the bottom of the left sidebar in this screenshot?
2) Is "Change password" also visible above it?
3) Is the navigation list readable, with nothing overlapping or clipped?
4) Does anything look broken or cramped at this short height? Rate overall polish 1-10.`)
console.log('=== SHORT-VIEWPORT SIDEBAR ===\n' + sidebar + '\n')

const mobile = await read('work/p58-login-banner-mobile.png', `${PREAMBLE}
This is the same sign-in page at mobile width (390px), again with the "already signed in" banner.
Questions:
1) Is the banner readable on mobile — email, "Continue as ..." and "Sign out" buttons all usable, nothing clipped?
2) Is the form below it fully usable?
3) Any overflow or squashed elements? Rate 1-10.`)
console.log('=== LOGIN BANNER (mobile) ===\n' + mobile + '\n')
