// VLM QA of phase 55: join-riders form (clarity + validation), the rider app
// (rules/report surfaces), and the admin order modal (customer card +
// WhatsApp + email-trigger hint). Pure image REVIEW — no code generation.
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

const join = await read('work/p55-join-riders.png', `${PREAMBLE}
The screenshot shows a "Join Our Rider Team" application page for a premium Lagos laundry brand (navy/gold). A recent rewrite made the experience question self-explaining (a real applicant previously answered "it was really nice, i enjoyed it" because he thought it asked about a ride he had taken).
Questions:
1) Locate the experience block. Does its label ask about PAST WORK ("Have you worked as a rider or driver before?"), and does the help text explicitly say "None — this would be my first" is a fine answer and that the question is NOT about a ride taken as a passenger?
2) Are the phone fields clearly labelled ("Your Phone Number", "Emergency Contact (a family member or friend)") with helper text underneath?
3) Does the form look calm and premium (navy/serif), with nothing cramped, clipped, overlapping or misaligned?`)
console.log('=== JOIN-RIDERS (clarity rewrite) ===\n' + join + '\n')

const rider = await read('work/p55-rider-app.png', `${PREAMBLE}
The screenshot shows the Kozy Care RIDER APP (dark slate theme, gold accents) used by a Lagos delivery rider on duty.
Questions:
1) Is a "Rules" button visible in the dark header area near the geofence status?
2) If a dialog is open, does it present care & safety rules in readable grouped sections (e.g. Care of the garments / Ride by the law / Money & honesty) with checkmark bullet lists?
3) Is all text comfortably readable against the dark background, with nothing clipped or overlapping?
4) Does it look usable on a phone — big tap targets, no dense walls of text?`)
console.log('=== RIDER APP (rules) ===\n' + rider + '\n')

const modal = await read('work/p55-admin-modal.png', `${PREAMBLE}
The screenshot shows an admin order-detail modal of a premium laundry console (navy/gold on light background).
Questions:
1) Near the top of the modal, is there a CUSTOMER card showing a name and email with a "Call" button and a green "WhatsApp" button side by side?
2) Near the status dropdown, is there a small hint line explaining which status changes email the customer?
3) Does the modal remain uncluttered and professional — nothing overlapping, clipped or misaligned?`)
console.log('=== ADMIN MODAL (customer card + WhatsApp) ===\n' + modal + '\n')
