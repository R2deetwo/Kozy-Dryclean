// VLM QA of phase 55 (round 2): the join-riders FORM and the rider app's
// route list + Rules dialog. Pure image REVIEW — no code generation.
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

const join = await read('work/p55-join-riders-form.png', `${PREAMBLE}
The screenshot shows the application FORM of a "Join Our Rider Team" page for a premium Lagos laundry brand (navy/gold). A recent rewrite made the experience question self-explaining (a real applicant previously answered "it was really nice, i enjoyed it" because he thought it asked about a ride he had taken).
Questions:
1) Locate the experience block. Does its label ask about PAST WORK ("Have you worked as a rider or driver before?"), and does the help text explicitly say writing "None — this would be my first" is fine and that the question is NOT about a ride taken as a passenger?
2) Are the phone fields clearly labelled ("Your Phone Number", "Emergency Contact (a family member or friend)") with helper text underneath?
3) Does the form look calm and premium (navy/serif), with nothing cramped, clipped, overlapping or misaligned?`)
console.log('=== JOIN-RIDERS FORM (clarity rewrite) ===\n' + join + '\n')

const route = await read('work/p55-rider-route.png', `${PREAMBLE}
The screenshot shows the Kozy Care RIDER APP route list (dark slate theme, gold accents, mobile 390px) used by a Lagos delivery rider on duty.
Questions:
1) In the dark header, are a "Rules" button and a "Sign out" button visible next to the geofence status?
2) Are the day stats (stops / pickups / drops) and the stop cards legible and well spaced?
3) Anything clipped, overlapping or misaligned?`)
console.log('=== RIDER ROUTE LIST ===\n' + route + '\n')

const rules = await read('work/p55-rider-rules.png', `${PREAMBLE}
The screenshot shows the Kozy Care rider app with the CARE & SAFETY RULES dialog open (dark slate, gold accents).
Questions:
1) Does the dialog present rules grouped into readable sections (e.g. "Care of the garments", "Ride by the law", "Money & honesty") with checkmark bullet lists?
2) Is the text comfortably readable against the dark background, nothing clipped or overlapping?
3) Does it look usable on a phone — comfortable tap area for the buttons, no dense wall of text?`)
console.log('=== RIDER RULES DIALOG ===\n' + rules + '\n')
