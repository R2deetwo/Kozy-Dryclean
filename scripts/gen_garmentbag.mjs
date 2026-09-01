// Phase 18: generate suit-carrier handover base images (blank front panel)
// Same veranda style the client likes, but the bag is a classic bi-fold
// travel suit carrier (garment bag). Blank panel — brand K composited later.
import ZAI from '/home/z/Kozy-Dryclean/node_modules/z-ai-web-dev-sdk/dist/index.js'
import fs from 'fs';

const OUT = '/home/z/my-project/work/image-rev5';
fs.mkdirSync(OUT, { recursive: true });

const base =
  'Professional commercial photograph for a premium laundry brand, warm golden-hour light, shallow depth of field. ' +
  'A smiling Nigerian delivery rider in a crisp navy-blue polo uniform hands a folded navy-blue suit carrier garment bag ' +
  'to a happy Nigerian woman customer on her bright residential veranda. ' +
  'The suit carrier is a classic bi-fold travel garment bag for suits: flat rectangular front panel of smooth dark-navy canvas ' +
  'with gentle soft vertical folds, folded-over top edge with the hanger hook tucked inside, a short carry handle at the top, ' +
  'and a slim brass zipper running along one edge. ' +
  'The front panel faces the camera directly and is completely plain, unbranded, empty dark-navy fabric — absolutely no logo, no text, no print, no embroidery anywhere. ' +
  'The rider supports the garment bag from underneath with both hands; the woman reaches with one hand toward the bag; natural relaxed handover moment, warm mutual eye contact, genuine friendly smiles. ' +
  'Exactly two people, no other person in the background. ' +
  'Softly blurred cream wall and a potted palm behind them. ' +
  'Photorealistic, natural skin texture, natural hands with five fingers each, premium brand photography, high quality, detailed.';

const variants = [
  { name: 'carrier-v1', extra: ' The garment bag is held horizontally between the two people at waist height, front panel fully visible and evenly lit, mild soft folds across the panel.' },
  { name: 'carrier-v2', extra: ' The garment bag is held slightly angled, front panel clearly visible, soft window light raking across the fabric creating gentle folds and highlights.' },
];

const zai = await ZAI.create();
for (const v of variants) {
  try {
    const res = await zai.images.generations.create({ prompt: base + v.extra, size: '1152x864' });
    fs.writeFileSync(`${OUT}/${v.name}.png`, Buffer.from(res.data[0].base64, 'base64'));
    console.log('OK', v.name);
  } catch (e) {
    console.error('FAIL', v.name, e.message);
  }
}
