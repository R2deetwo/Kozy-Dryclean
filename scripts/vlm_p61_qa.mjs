// VLM QA of phase 61 — the rider app as a real app (tabs, history, earnings,
// account) + the admin Rider Pay card. Pure image review harness.
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

const PREAMBLE = `You are a strict visual QA reviewer. You are LOOKING AT a screenshot — review it. Do NOT write HTML, CSS or code of any kind. Answer the numbered questions in plain prose only, under 120 words.`

const route = await read('work/p61-route-mobile.png', `${PREAMBLE}
This is a gig-rider app (dark slate design, gold accents) on a 390px phone. It shows the rider's daily route: stat tiles, stop cards with Pickup/Delivery badges, addresses, time slots, distance chips ("X km away"), and a bottom tab bar (Route / History / Earnings / Account).
Questions:
1) Is each stop card instantly readable — which type (pickup vs delivery), whose order, where, when, how far?
2) Is the distance information clear and useful (a zone name plus "X km away"), with nothing cryptic like "aja 5.6 km" or "within 12 km"?
3) Is the bottom tab bar obvious and thumb-reachable, with a clear active tab?
4) Anything clipped, overlapping, or cramped? Rate overall polish 1-10.`)
console.log('=== ROUTE (MOBILE) ===\n' + route + '\n')

const history = await read('work/p61-history-mobile.png', `${PREAMBLE}
This is the History tab of a gig-rider app on a 390px phone: completed rides grouped by day ("Today", weekday labels), each row a Pickup or Delivery badge with the order number, customer name, address, completion time, and an "on time"/"late" chip.
Questions:
1) Can a rider answer "what did I do today, and was I on time?" at a glance?
2) Are the day groups, badges and time chips legible and calm?
3) Anything clipped, overlapping, or cramped? Rate overall polish 1-10.`)
console.log('=== HISTORY (MOBILE) ===\n' + history + '\n')

const earnings = await read('work/p61-earnings-mobile.png', `${PREAMBLE}
This is the Earnings tab of a gig-rider app on a 390px phone: a "This payout week" naira hero card, all-time + on-time tiles, published per-stop rates, and a ledger list of priced completed stops (+₦ amounts).
Questions:
1) Is the earnings story immediately clear — how much this week, all-time, what the rates are, and where each line came from?
2) Are the naira figures legible and never ambiguous?
3) Anything clipped, overlapping, or cramped? Rate overall polish 1-10.`)
console.log('=== EARNINGS (MOBILE) ===\n' + earnings + '\n')

const account = await read('work/p61-account-mobile.png', `${PREAMBLE}
This is the Account tab of a gig-rider app on a 390px phone: profile card (name, phone, email, riding since), Notifications card (stop notifications toggle + WhatsApp row with a "Send test" button), an install-the-app card, and rules/password/sign-out rows.
Questions:
1) Would a rider understand how to turn on notifications and test the WhatsApp number without help?
2) Is every card clearly labelled, calm, and unhurried?
3) Anything clipped, overlapping, or cramped? Rate overall polish 1-10.`)
console.log('=== ACCOUNT (MOBILE) ===\n' + account + '\n')

const riderpay = await read('work/p61-riderpay-admin.png', `${PREAMBLE}
This is the admin console (light navy/gold design) showing a settings page with a "Rider Pay" card: two numeric inputs (pay per pickup / pay per delivery in naira) with explanatory copy, alongside other settings cards.
Questions:
1) Is the Rider Pay card self-explanatory — what the two numbers mean and what they do for riders?
2) Does it sit harmoniously with the surrounding settings cards?
3) Anything clipped, overlapping, or misaligned? Rate overall polish 1-10.`)
console.log('=== ADMIN RIDER PAY ===\n' + riderpay + '\n')
