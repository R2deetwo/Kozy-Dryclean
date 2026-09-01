#!/bin/bash
# Re-package the v5 marketing kit (Phase 14: 10% first order, HOTEL15 hotel
# offer, model with KOZY garment bag) into download/kozy-brand/.
set -e
PDF_SKILL_DIR=/home/z/my-project/skills/pdf
W=/home/z/my-project/work/kozy-brand
D=/home/z/my-project/download/kozy-brand
SNAP=/home/z/my-project/scripts/kozy-brand/snap.js

meta() { # file title subject
  python3 "$PDF_SKILL_DIR/scripts/pdf.py" meta.set "$1" -o "$1.tmp" \
    -d "{\"Title\": \"$2\", \"Author\": \"Kozy Care Drycleaning & Laundry Services\", \"Creator\": \"Kozy Brand Kit v5\", \"Subject\": \"$3\"}" >/dev/null
  mv "$1.tmp" "$1"
}

cd "$W"

# ---------- flyer services (A5 double-sided, v5) ----------
cp flyer-a-double-sided-cmyk.pdf "$D/flyer-services-a5/print/kozy-flyer-services-A5-print-CMYK.pdf"
cp flyer-a-double-sided.pdf      "$D/flyer-services-a5/print/kozy-flyer-services-A5-print-RGB.pdf"
cp flyer-a-front-digital.pdf     "$D/flyer-services-a5/digital/kozy-flyer-services-front-digital.pdf"
cp flyer-a-front.html            "$D/flyer-services-a5/html-source/flyer-a-front.html"
meta "$D/flyer-services-a5/print/kozy-flyer-services-A5-print-CMYK.pdf" "Kozy Care — Services & Pricing Flyer A5 (Print CMYK, double-sided)" "A5 148x210mm, 3mm bleed, crop marks, v5 — 10% first order + HOTEL15"
meta "$D/flyer-services-a5/print/kozy-flyer-services-A5-print-RGB.pdf" "Kozy Care — Services & Pricing Flyer A5 (Print RGB, double-sided)" "A5 148x210mm, 3mm bleed, crop marks, v5 — 10% first order + HOTEL15"
meta "$D/flyer-services-a5/digital/kozy-flyer-services-front-digital.pdf" "Kozy Care — Services Flyer Front (Digital)" "A5 digital, v5 — 10% first order + HOTEL15"
node "$SNAP" flyer-a-front-digital.html "$D/flyer-services-a5/digital/kozy-flyer-services-front.png" --w 560 --h 794 --scale 2 >/dev/null
echo "✓ flyer services A5 re-packaged (v5)"

# ---------- flyer offer (A5, v5 — model + garment bag) ----------
cp flyer-b-cmyk.pdf    "$D/flyer-offer-a5/print/kozy-flyer-offer-A5-print-CMYK.pdf"
cp flyer-b.pdf         "$D/flyer-offer-a5/print/kozy-flyer-offer-A5-print-RGB.pdf"
cp flyer-b-digital.pdf "$D/flyer-offer-a5/digital/kozy-flyer-offer-digital.pdf"
cp flyer-b.html        "$D/flyer-offer-a5/html-source/flyer-b.html"
meta "$D/flyer-offer-a5/print/kozy-flyer-offer-A5-print-CMYK.pdf" "Kozy Care — 10% Offer Flyer A5 (Print CMYK)" "A5 148x210mm, 3mm bleed, crop marks, v5 — model with KOZY garment bag, HOTEL15 hotel offer"
meta "$D/flyer-offer-a5/print/kozy-flyer-offer-A5-print-RGB.pdf" "Kozy Care — 10% Offer Flyer A5 (Print RGB)" "A5 148x210mm, 3mm bleed, crop marks, v5 — model with KOZY garment bag, HOTEL15 hotel offer"
meta "$D/flyer-offer-a5/digital/kozy-flyer-offer-digital.pdf" "Kozy Care — 10% Offer Flyer (Digital)" "A5 digital, v5 — model with KOZY garment bag, HOTEL15 hotel offer"
node "$SNAP" flyer-b-digital.html "$D/flyer-offer-a5/digital/kozy-flyer-offer.png" --w 560 --h 794 --scale 2 >/dev/null
echo "✓ flyer offer A5 re-packaged (v5)"

# ---------- poster A3 (v5) ----------
cp poster-a3-cmyk.pdf    "$D/poster-a3/print/kozy-poster-A3-print-CMYK.pdf"
cp poster-a3.pdf         "$D/poster-a3/print/kozy-poster-A3-print-RGB.pdf"
cp poster-a3-digital.pdf "$D/poster-a3/digital/kozy-poster-A3-digital.pdf"
cp poster-a3.html        "$D/poster-a3/html-source/poster-a3.html"
meta "$D/poster-a3/print/kozy-poster-A3-print-CMYK.pdf" "Kozy Care — A3 Poster (Print CMYK)" "A3 297x420mm, 3mm bleed, crop marks, v5 — 10% first order + HOTEL15"
meta "$D/poster-a3/print/kozy-poster-A3-print-RGB.pdf" "Kozy Care — A3 Poster (Print RGB)" "A3 297x420mm, 3mm bleed, crop marks, v5 — 10% first order + HOTEL15"
meta "$D/poster-a3/digital/kozy-poster-A3-digital.pdf" "Kozy Care — A3 Poster (Digital)" "A3 digital, v5 — 10% first order + HOTEL15"
node "$SNAP" poster-a3-digital.html "$D/poster-a3/digital/kozy-poster-A3.png" --w 1123 --h 1587 --scale 1.5 >/dev/null
echo "✓ poster A3 re-packaged (v5)"

echo "all v5 pieces packaged"
