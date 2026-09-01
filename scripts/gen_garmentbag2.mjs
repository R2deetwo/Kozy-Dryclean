// Phase 18 attempt 2: suit-carrier handover — cleaner panel geometry.
// Fixes from attempt 1: zipper around the outer EDGE only (never across the
// front face), bag hangs UPRIGHT held by the top handle, front face is one
// unbroken expanse of navy fabric. Blank panel — brand K composited later.
import ZAI from '/home/z/Kozy-Dryclean/node_modules/z-ai-web-dev-sdk/dist/index.js'
import fs from 'fs'

const OUT = '/home/z/my-project/work/image-rev5'
fs.mkdirSync(OUT, { recursive: true })

const base =
  'Photorealistic premium lifestyle photograph for a luxury Lagos laundry and tailoring brand, warm golden-hour daylight, shallow depth of field. ' +
  'Scene: a friendly young Nigerian delivery rider in a smart deep-navy uniform polo shirt with subtle gold piping presents a freshly pressed, freshly returned garment bag to a delighted Nigerian woman customer on her bright sunlit apartment veranda. ' +
  'THE BAG: a classic bi-fold travel suit carrier (garment bag) for carrying suits — a large flat rectangular folded garment cover made of smooth dark-navy canvas. It hangs UPRIGHT and vertical. The zipper runs around the OUTSIDE PERIMETER EDGE of the bag only — it never crosses the front face. The top edge is folded over where the hanger is tucked inside, with a short fabric carry handle at the very top. ' +
  'THE FRONT FACE of the bag is one single continuous unbroken expanse of smooth dark-navy canvas facing the camera straight-on, evenly lit, gently draped with soft natural folds and subtle fabric weave texture — the front face is completely EMPTY: absolutely no logo, no monogram, no text, no print, no embroidery, no zipper, no pocket on it. ' +
  'HANDOVER MOMENT: the rider holds the suit carrier up by its top carry handle with one hand at chest height; the customer has just taken hold of the same top handle with her hand, mid-handover, both gently smiling with warm natural eye contact. Both of their arms stay at the TOP edge of the bag, leaving the entire front face open and unobstructed. ' +
  'Exactly two people, waist-up framing, natural well-formed hands with five fingers each. No doorway, no door frame. Softly blurred cream wall and a potted palm behind them. ' +
  'Rich navy and warm gold color palette, luxury brand campaign photography, natural skin texture, crisp fabric texture, high quality, detailed.';

const variants = [
  { name: 'carrier-v3', extra: ' Slightly wide shot: the full garment bag visible from top handle to bottom hem, centered between the two people.' },
  { name: 'carrier-v4', extra: ' Medium shot: bag centered, the woman on the right smiling down at the bag with pride, rider on the left presenting it.' },
  { name: 'carrier-v5', extra: ' The customer cradles the bottom edge of the carrier with one supporting hand under it while gripping the top handle with the other; front face still fully visible.' },
];

const zai = await ZAI.create();
for (const v of variants) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await zai.images.generations.create({ prompt: base + v.extra, size: '1152x864' });
      fs.writeFileSync(`${OUT}/${v.name}.png`, Buffer.from(res.data[0].base64, 'base64'));
      console.log('OK', v.name);
      break;
    } catch (e) {
      console.error('FAIL', v.name, 'attempt', attempt, e.message);
    }
  }
}
