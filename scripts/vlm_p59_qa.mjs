// VLM QA of phase 59 — rider stop cards + stop detail stepper, CRM
// separation, rider roster metrics. Pure image REVIEW.
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

const route = await read('work/p59-route-mobile.png', `${PREAMBLE}
This is the route list of a rider (delivery courier) phone app for a Lagos laundry service — dark navy theme, gold accents. A rider opens this app to see their stops for the day. Each stop should make its TYPE unmistakable at a glance: PICKUP stops (collect garments from the customer) vs DELIVERY stops (hand garments over), with distinct colour identities.
Questions:
1) Can you tell AT A GLANCE which cards are pickups and which are deliveries? What visual signals do you see (badges, colours, icons)?
2) Do the delivery cards each show a clear time expectation ("Due by ...")? Does the pickup card show its slot?
3) Do the three stat tiles at the top (stops today / pickups / drops) read cleanly?
4) Is anything clipped, overlapping, or confusing? Rate overall polish 1-10.`)
console.log('=== RIDER ROUTE (mobile) ===\n' + route + '\n')

const pickup = await read('work/p59-pickup-detail.png', `${PREAMBLE}
This is one stop's detail screen in the same rider phone app — a PICKUP (collect from the customer). The design intent: the banner at top states the stop type; a card titled "At this stop — in this order" walks the rider through EXACTLY what to do next in 3 numbered steps (ride there → count the items with the customer → swipe to confirm), with Navigate and Call buttons in step 1.
Questions:
1) Does the screen answer "what do I do here, and in what order?" Is the 3-step sequence clear and numbered?
2) Are the Navigate and Call buttons prominent and thumb-reachable within the steps card?
3) Does the top banner clearly identify this as a PICKUP (collect from customer)?
4) Any clipping, overlap, or confusing element? Rate overall polish 1-10.`)
console.log('=== PICKUP DETAIL (mobile) ===\n' + pickup + '\n')

const delivery = await read('work/p59-delivery-detail.png', `${PREAMBLE}
This is another stop's detail screen in the same rider app — a DELIVERY (hand over to the customer at a DIFFERENT address than it was collected from). Design intent: cyan banner says DELIVERY — HAND OVER TO CUSTOMER; the address block shows the DELIVERY address; a "Delivery promise" block shows when it is due; the same 3-step card (ride there → hand over and count together → swipe to confirm delivery).
Questions:
1) Is it unmistakable that this stop is a DELIVERY and not a pickup?
2) Does the "Delivery promise" block read clearly (a due time, colour-coded)?
3) Is the 3-step card present with Navigate + Call in step 1?
4) Any clipping, overlap, or visual bugs? Rate overall polish 1-10.`)
console.log('=== DELIVERY DETAIL (mobile) ===\n' + delivery + '\n')

const crm = await read('work/p59-crm.png', `${PREAMBLE}
This is the "Customers (CRM)" tab of the admin console for the same service — light linen/navy palette. The recent change: this list now contains ONLY customers (retail + corporate). Riders (couriers) are tracked in a separate "Riders" tab; admins/staff in a "Staff" tab — because orders-placed and money-spent columns are meaningless for them.
Questions:
1) Does every visible row look like a CUSTOMER record (name, contact, orders count, money spent, since)? Any rows that look like they don't belong (riders/admins)?
2) Are the filter tabs sensible (All / Retail / Corporate — no "Drivers" tab)?
3) Does the subtitle under the heading explain where riders and staff are tracked?
4) Any clipping or visual bugs? Rate overall polish 1-10.`)
console.log('=== CRM LIST ===\n' + crm + '\n')

const roster = await read('work/p59-roster.png', `${PREAMBLE}
This is the "Riders" tab of the same admin console. The rider roster cards now carry FOUR driver-specific metric tiles: open stops / done today / delivered (all-time) / open issues (unresolved reported incidents — styled rose/red when nonzero). Plus phone, last GPS ping with zone, joined date, and an Active/Paused badge.
Questions:
1) Do the four metric tiles read cleanly on each rider card? Is anything ambiguous?
2) Is the "open issues" tile visually distinct when nonzero (rose/red treatment)?
3) Does the card give you a useful at-a-glance picture of a rider's working day?
4) Any clipping, overlap, or visual bugs? Rate overall polish 1-10.`)
console.log('=== RIDER ROSTER ===\n' + roster + '\n')
