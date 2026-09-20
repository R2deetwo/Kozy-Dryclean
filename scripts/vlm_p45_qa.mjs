// VLM QA of the phase-45 changes: calendar picker with pending draft,
// continuum timeline, home/services page split.
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

const calCheck = `This is the Kozy Care admin "newsletter engine" panel. A start-date calendar popover is open. Answer precisely:
1) Is a month-grid calendar fully visible with weekday headers and day numbers?
2) Are earlier days in the month greyed out / disabled?
3) Is there a small explanatory note under the calendar about the picked day starting the next newsletter?
4) Any overlap, clipping, or broken layout anywhere in the panel?`

const timelineCheck = `This is the Kozy Care admin newsletter engine panel. Answer precisely:
1) Is there a "What's coming up next" section with a vertical timeline of upcoming newsletter dates?
2) How many timeline rows are visible, and do they each show a date and an email subject?
3) Are the badges (e.g. "Draft", "Approved", "Next to be drafted") readable?
4) Does the section end with a note that it keeps rolling and each send waits for approval?
5) Any layout defects?`

const homeCheck = `This is a full-page screenshot of the Kozy Care laundry home page. Answer precisely:
1) List the sections you see in order from top to bottom.
2) Is there a compact "Six services. One pickup." grid of 6 service cards with prices?
3) Is there any full per-item pricing table with dozens of price rows on this page? (there should NOT be)
4) Do the sections look complete and professionally styled (navy/gold, no broken images)?
5) Any blank areas, overlap, or layout breakage?`

const servicesCheck = `This is a full-page screenshot of the Kozy Care /services page. Answer precisely:
1) Is there a navy page header titled "Everything Kozy Care does — and what it costs."?
2) Is there a pricing area with Men / Women / Corporate tabs and per-item price cards?
3) Are there sections for the atelier, sneaker restoration, and alterations?
4) Does the page end with a "Ready when you are." CTA and a footer?
5) Any blank areas, broken images, overlap, or layout breakage?`

const mobileCheck = `This is a mobile (390px) screenshot of the Kozy Care /services page mid-scroll. Answer:
1) Is content readable and well laid out at this width?
2) Is there a sticky bottom bar with a call button and a gold "Book a pickup" button?
3) Any horizontal overflow, clipped text, or broken layout?`

const runs = [
  ['/home/z/my-project/work/p45-calendar-with-pending.png', calCheck, 'CALENDAR WITH PENDING DRAFT'],
  ['/home/z/my-project/work/p45-engine-final.png', timelineCheck, 'CONTINUUM TIMELINE'],
  ['/home/z/my-project/work/p45-home-full.png', homeCheck, 'HOME PAGE (SLIMMED)'],
  ['/home/z/my-project/work/p45-services-full.png', servicesCheck, 'SERVICES PAGE'],
  ['/home/z/my-project/work/p45-services-mobile.png', mobileCheck, 'SERVICES MOBILE'],
]

for (const [img, check, label] of runs) {
  console.log(`\n===== ${label} =====`)
  try {
    console.log(await read(img, check))
  } catch (e) {
    console.log('VLM ERROR:', e.message)
  }
}
