// VLM QA of phase 54: the rider-onboarding surfaces + the Ask-the-customer
// composer — clarity and premium consistency, no visual defects.
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

const desk = await read('work/p54-join-riders-desktop.png', `This is a screenshot of a "Join Our Rider Team" application page for a premium Lagos laundry brand (navy/gold, serif headings). It should show: a rider hero with heading and short pitch, three benefit cards (pay / flexible hours / own bike), a "HOW ONBOARDING WORKS" strip with FOUR numbered steps (Apply, Review call, Bike & licence check, Welcome email), and an application form card with sections for personal information, location, vehicle information and a contract-consent box. Answer precisely:
1) Are all those elements present and readable?
2) Is the 4-step onboarding strip clear — do the steps read left-to-right as a progression, with legible labels?
3) Does the page stay calm and premium (no clutter, no aggressive sales banners)?
4) Anything cramped, clipped, overlapping, misaligned or confusing?`)
console.log('=== JOIN-RIDERS DESKTOP ===\n' + desk + '\n')

const mob = await read('work/p54-join-riders-mobile.png', `This is a MOBILE (390px) screenshot of the same rider application page. Answer precisely:
1) Is everything fully visible with no horizontal overflow?
2) Do the benefit cards and the four onboarding steps stack cleanly on the narrow screen?
3) Are the form inputs comfortably sized for touch?
4) Anything clipped, overlapping or confusing?`)
console.log('=== JOIN-RIDERS MOBILE (390) ===\n' + mob + '\n')

const tab = await read('work/p54-riders-tab.png', `This is a screenshot of the "Riders" tab inside a laundry operations console (navy sidebar, light content area). It should show: an "Applications" section with filter chips (Pending / Approved / Declined / All), at least one application card with the applicant's name, a status badge, a mono reference code like KZR-XXXX, phone/area/bike details and Approve + Decline buttons; and further down a "Rider roster" section with cards showing each rider's name, active badge, phone, stats (open stops / delivered / joined) and an assignment hint. Answer precisely:
1) Are all those elements present and readable?
2) Do the application cards look scannable — name, status, reference and key details clear at a glance?
3) Do the roster stat tiles align within their cards?
4) Anything cramped, clipped, overlapping, misaligned or confusing?`)
console.log('=== RIDERS TAB ===\n' + tab + '\n')

const composer = await read('work/p54-ask-composer.png', `This is a screenshot of an order-detail modal in a laundry operations console with a small dialog open on top titled "Ask [customer] a question". The dialog should contain: a short description of when to use it, a textarea pre-filled with a question about a gate, a character counter line, and two buttons ("Never mind" outline + dark "Send question"). Answer precisely:
1) Are all those elements present and readable?
2) Is the dialog properly centered over the modal, not clipped at any edge?
3) Does it visually match the console's navy/gold styling?
4) Anything cramped, clipped, overlapping, misaligned or confusing?`)
console.log('=== ASK-CUSTOMER COMPOSER ===\n' + composer + '\n')
