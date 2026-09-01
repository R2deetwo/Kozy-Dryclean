#!/bin/bash
# Package the Kozy brand kit into download/kozy-brand/ with final names + metadata
set -e
PDF_SKILL_DIR=/home/z/my-project/skills/pdf
W=/home/z/my-project/work/kozy-brand
D=/home/z/my-project/download/kozy-brand
SNAP=/home/z/my-project/scripts/kozy-brand/snap.js

meta() { # file title subject
  python3 "$PDF_SKILL_DIR/scripts/pdf.py" meta.set "$1" -o "$1.tmp" \
    -d "{\"Title\": \"$2\", \"Author\": \"Kozy Care Drycleaning & Laundry Services\", \"Creator\": \"Kozy Brand Kit\", \"Subject\": \"$3\"}" >/dev/null
  mv "$1.tmp" "$1"
}

cd "$W"

# ---------- flyer services (A5 double-sided) ----------
mkdir -p "$D/flyer-services-a5/print" "$D/flyer-services-a5/digital" "$D/flyer-services-a5/html-source"
cp flyer-a-double-sided-cmyk.pdf "$D/flyer-services-a5/print/kozy-flyer-services-A5-print-CMYK.pdf"
cp flyer-a-double-sided.pdf      "$D/flyer-services-a5/print/kozy-flyer-services-A5-print-RGB.pdf"
cp flyer-a-front-digital.pdf     "$D/flyer-services-a5/digital/kozy-flyer-services-front-digital.pdf"
cp flyer-a-back-digital.pdf      "$D/flyer-services-a5/digital/kozy-flyer-services-back-digital.pdf"
cp flyer-a-front.html flyer-a-back.html "$D/flyer-services-a5/html-source/"
meta "$D/flyer-services-a5/print/kozy-flyer-services-A5-print-CMYK.pdf" "Kozy — Services & Pricing Flyer A5 (Print CMYK, double-sided)" "A5 148x210mm, 3mm bleed, crop marks"
meta "$D/flyer-services-a5/print/kozy-flyer-services-A5-print-RGB.pdf" "Kozy — Services & Pricing Flyer A5 (Print RGB, double-sided)" "A5 148x210mm, 3mm bleed, crop marks"
meta "$D/flyer-services-a5/digital/kozy-flyer-services-front-digital.pdf" "Kozy — Services Flyer Front (Digital)" "A5 digital"
meta "$D/flyer-services-a5/digital/kozy-flyer-services-back-digital.pdf" "Kozy — Price List Flyer Back (Digital)" "A5 digital"
node "$SNAP" flyer-a-front-digital.html "$D/flyer-services-a5/digital/kozy-flyer-services-front.png" --w 560 --h 794 --scale 2
node "$SNAP" flyer-a-back-digital.html  "$D/flyer-services-a5/digital/kozy-flyer-services-back.png"  --w 560 --h 794 --scale 2

# ---------- flyer offer (A5 single-sided) ----------
mkdir -p "$D/flyer-offer-a5/print" "$D/flyer-offer-a5/digital" "$D/flyer-offer-a5/html-source"
cp flyer-b-cmyk.pdf "$D/flyer-offer-a5/print/kozy-flyer-offer-A5-print-CMYK.pdf"
cp flyer-b.pdf      "$D/flyer-offer-a5/print/kozy-flyer-offer-A5-print-RGB.pdf"
cp flyer-b-digital.pdf "$D/flyer-offer-a5/digital/kozy-flyer-offer-digital.pdf"
cp flyer-b.html "$D/flyer-offer-a5/html-source/"
meta "$D/flyer-offer-a5/print/kozy-flyer-offer-A5-print-CMYK.pdf" "Kozy — 15% Off Offer Flyer A5 (Print CMYK)" "A5 148x210mm, 3mm bleed, crop marks"
meta "$D/flyer-offer-a5/print/kozy-flyer-offer-A5-print-RGB.pdf" "Kozy — 15% Off Offer Flyer A5 (Print RGB)" "A5 148x210mm, 3mm bleed, crop marks"
meta "$D/flyer-offer-a5/digital/kozy-flyer-offer-digital.pdf" "Kozy — 15% Off Offer Flyer (Digital)" "A5 digital"
node "$SNAP" flyer-b-digital.html "$D/flyer-offer-a5/digital/kozy-flyer-offer.png" --w 560 --h 794 --scale 2

# ---------- poster A3 ----------
mkdir -p "$D/poster-a3/print" "$D/poster-a3/digital" "$D/poster-a3/html-source"
cp poster-a3-cmyk.pdf "$D/poster-a3/print/kozy-poster-A3-print-CMYK.pdf"
cp poster-a3.pdf      "$D/poster-a3/print/kozy-poster-A3-print-RGB.pdf"
cp poster-a3-digital.pdf "$D/poster-a3/digital/kozy-poster-A3-digital.pdf"
cp poster-a3.html "$D/poster-a3/html-source/"
meta "$D/poster-a3/print/kozy-poster-A3-print-CMYK.pdf" "Kozy — Three Steps Zero Fuss Poster A3 (Print CMYK)" "A3 297x420mm, 3mm bleed, crop marks"
meta "$D/poster-a3/print/kozy-poster-A3-print-RGB.pdf" "Kozy — Three Steps Zero Fuss Poster A3 (Print RGB)" "A3 297x420mm, 3mm bleed, crop marks"
meta "$D/poster-a3/digital/kozy-poster-A3-digital.pdf" "Kozy — Poster A3 (Digital)" "A3 digital"
node "$SNAP" poster-a3-digital.html "$D/poster-a3/digital/kozy-poster-A3.png" --w 1123 --h 1588 --scale 1.5

# ---------- brand sheet ----------
mkdir -p "$D/brand-sheet"
cp brand-sheet.pdf "$D/brand-sheet/kozy-brand-sheet.pdf"
cp brand-sheet.html "$D/brand-sheet/kozy-brand-sheet.html"
meta "$D/brand-sheet/kozy-brand-sheet.pdf" "Kozy — Brand Guidelines Sheet v1.1" "Logo variants, colour, typography, usage rules"
node "$SNAP" brand-sheet.html "$D/brand-sheet/kozy-brand-sheet-preview.png" --w 794 --h 1123 --scale 2

echo "=== packaged ==="
cd "$D" && ls -R | head -60