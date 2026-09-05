// v6.2 VLM QA — verify the two client-directed changes:
//  (1) business cards: lockup moved to TOP-LEFT, website style
//  (2) gold-corporate: descriptor now "PREMIUM DRYCLEANING & LAUNDRY"
import ZAI from '/home/z/my-project/node_modules/z-ai-web-dev-sdk/dist/index.js'
import fs from 'fs'

const DIR = '/home/z/my-project/work/vlm-v62'

const CHECKS = {
  'card-navy-front-1': `You are a strict brand QA reviewer for Kozy Care (premium dry cleaning, Lagos). This is the FRONT of a navy business card (85x55mm with crop marks). Answer precisely:
1. LOGO PLACEMENT: where is the brand lockup (K monogram + name) — top-LEFT, top-RIGHT, or elsewhere? Is the K mark to the LEFT of the wordmark?
2. WORDMARK: does it read exactly "Kozy Care" in title case? Any caps-lock spelling?
3. DESCRIPTOR: what small tracked-caps line sits under the name? Quote it exactly.
4. ALIGNMENT: is the lockup left-aligned as a unit (mark + text stacked left)?
5. REST OF CARD: is the person's name centered mid-card, with a small title and gold rule, and contacts (email + phone) centered at the bottom? Quote the email and phone.
6. FIT: is any text or element touching or crossing the crop marks / cut lines? Is everything inside the inner hairline frame?
7. VERDICT: PASS or FIX (with the one fix needed).`,
  'card-gold-front-1': `You are a strict brand QA reviewer for Kozy Care. This is the FRONT of a gold-finish business card (85x55mm with crop marks). Answer precisely:
1. LOGO PLACEMENT: where is the brand lockup — top-LEFT or top-RIGHT? Is the K mark left of the wordmark?
2. WORDMARK: exact text and case?
3. DESCRIPTOR: quote the small line under the name exactly.
4. REST: person's name centered? title? contacts centered at bottom (quote email + phone)?
5. FIT: anything crossing the crop marks or cut off?
6. VERDICT: PASS or FIX (one fix).`,
  'flyer-front-1': `You are a strict brand QA reviewer for Kozy Care. This is the FRONT of an A5 institutional flyer (with 3mm bleed + crop marks). Answer precisely:
1. BRAND LOCKUP: quote the main name and the small descriptor line under it EXACTLY. Does the descriptor read "PREMIUM DRYCLEANING & LAUNDRY" or "INSTITUTIONAL & CORPORATE GARMENT CARE" or something else?
2. OFFER BAND: is the "PREFERRED PARTNER RATES" band (or similar rates band) fully visible and safely inside the cut lines — not sliced at the bottom?
3. FOOTER: is the bottom contact/footer line fully visible inside the trim?
4. FIT: any element touching or crossing the crop marks that should not be (gold edge bands are ALLOWED to bleed to the marks)?
5. VERDICT: PASS or FIX (one fix).`,
  'sheet-a4-1': `You are a strict brand QA reviewer for Kozy Care. This is an A4 corporate services sheet (with 3mm bleed + crop marks). Answer precisely:
1. BRAND LOCKUP top-left: quote the name and the small descriptor line under it EXACTLY. Does it read "PREMIUM DRYCLEANING & LAUNDRY" or "INSTITUTIONAL & CORPORATE GARMENT CARE"?
2. COMMERCIAL TERMS: is the terms box (15% / 5% partner rates) fully visible inside the trim?
3. CONTACT BAND + LEGAL FOOT: fully visible at the bottom, not sliced?
4. FIT: any content crossing the cut lines (gold bands bleeding to marks are allowed)?
5. VERDICT: PASS or FIX (one fix).`,
}

async function main() {
  const zai = await ZAI.create()
  for (const name of Object.keys(CHECKS)) {
    const img = fs.readFileSync(`${DIR}/${name}.png`)
    const dataUrl = `data:image/png;base64,${img.toString('base64')}`
    const res = await zai.chat.completions.createVision({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: CHECKS[name] },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
      thinking: { type: 'disabled' },
    })
    const content = res.choices[0]?.message?.content || 'NO RESPONSE'
    fs.writeFileSync(`${DIR}/vlm-${name}.json`, JSON.stringify(res, null, 2))
    console.log(`\n===== ${name} =====\n${content}\n`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
