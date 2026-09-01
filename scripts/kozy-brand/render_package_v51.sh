#!/bin/bash
# Render + package marketing kit v5.1 (hotel/corporate wording) — ADDITIVE:
# v5 files in download/kozy-brand/ are left untouched; v5.1 goes to its own
# folder so the owner can compare versions and reprint selectively.
set -e
H2P=/home/z/my-project/skills/pdf/scripts/html2poster.js
PDFPY=/home/z/my-project/skills/pdf/scripts/pdf.py
SNAP=/home/z/my-project/scripts/kozy-brand/snap.js
W=/home/z/my-project/work/kozy-brand
D=/home/z/my-project/download/kozy-brand/v5.1-hotel-corporate-update
PDF_SKILL_DIR=/home/z/my-project/skills/pdf

mkdir -p "$D/flyer-services-a5/print" "$D/flyer-services-a5/digital" "$D/flyer-services-a5/html-source" \
         "$D/flyer-offer-a5/print" "$D/flyer-offer-a5/digital" "$D/flyer-offer-a5/html-source" \
         "$D/poster-a3/print" "$D/poster-a3/digital" "$D/poster-a3/html-source"
cd "$W"

cmyk() { gs -dSAFER -dBATCH -dNOPAUSE -sDEVICE=pdfwrite \
   -sColorConversionStrategy=CMYK -dProcessColorModel=/DeviceCMYK \
   -o "$2" "$1" >/dev/null 2>&1; echo "✓ CMYK: $2"; }

meta() { python3 "$PDF_SKILL_DIR/scripts/pdf.py" meta.set "$1" -o "$1.tmp" \
  -d "{\"Title\": \"$2\", \"Author\": \"Kozy Care Drycleaning & Laundry Services\", \"Creator\": \"Kozy Brand Kit v5.1\", \"Subject\": \"$3\"}" >/dev/null
  mv "$1.tmp" "$1"; }

# ---------- flyer A front v5.1 (uses v5 back — back is unchanged) ----------
node "$H2P" flyer-a-front-v51.html --output flyer-a-front-v51.pdf --width 620px
node "$H2P" flyer-a-front-digital-v51.html --output flyer-a-front-digital-v51.pdf --width 560px
cmyk flyer-a-front-v51.pdf flyer-a-front-v51-cmyk.pdf
python3 "$PDFPY" pages.merge flyer-a-front-v51.pdf flyer-a-back.pdf -o flyer-a-v51-double-sided.pdf >/dev/null
python3 "$PDFPY" pages.merge flyer-a-front-v51-cmyk.pdf flyer-a-back-cmyk.pdf -o flyer-a-v51-double-sided-cmyk.pdf >/dev/null

cp flyer-a-v51-double-sided-cmyk.pdf "$D/flyer-services-a5/print/kozy-flyer-services-A5-print-CMYK.pdf"
cp flyer-a-v51-double-sided.pdf      "$D/flyer-services-a5/print/kozy-flyer-services-A5-print-RGB.pdf"
cp flyer-a-front-digital-v51.pdf     "$D/flyer-services-a5/digital/kozy-flyer-services-front-digital.pdf"
cp flyer-a-front-v51.html            "$D/flyer-services-a5/html-source/flyer-a-front.html"
meta "$D/flyer-services-a5/print/kozy-flyer-services-A5-print-CMYK.pdf" "Kozy Care — Services & Pricing Flyer A5 (Print CMYK, double-sided)" "A5 148x210mm, 3mm bleed, crop marks, v5.1 — hotels & corporate wording on HOTEL15 line"
meta "$D/flyer-services-a5/print/kozy-flyer-services-A5-print-RGB.pdf" "Kozy Care — Services & Pricing Flyer A5 (Print RGB, double-sided)" "A5 148x210mm, 3mm bleed, crop marks, v5.1 — hotels & corporate wording on HOTEL15 line"
meta "$D/flyer-services-a5/digital/kozy-flyer-services-front-digital.pdf" "Kozy Care — Services Flyer Front (Digital)" "A5 digital, v5.1 — hotels & corporate wording on HOTEL15 line"
node "$SNAP" flyer-a-front-digital-v51.html "$D/flyer-services-a5/digital/kozy-flyer-services-front.png" --w 560 --h 794 --scale 2 >/dev/null
echo "✓ flyer services A5 packaged (v5.1)"

# ---------- flyer B v5.1 ----------
node "$H2P" flyer-b-v51.html --output flyer-b-v51.pdf --width 620px
node "$H2P" flyer-b-digital-v51.html --output flyer-b-v51-digital.pdf --width 560px
cmyk flyer-b-v51.pdf flyer-b-v51-cmyk.pdf
cp flyer-b-v51-cmyk.pdf    "$D/flyer-offer-a5/print/kozy-flyer-offer-A5-print-CMYK.pdf"
cp flyer-b-v51.pdf         "$D/flyer-offer-a5/print/kozy-flyer-offer-A5-print-RGB.pdf"
cp flyer-b-v51-digital.pdf "$D/flyer-offer-a5/digital/kozy-flyer-offer-digital.pdf"
cp flyer-b-v51.html        "$D/flyer-offer-a5/html-source/flyer-b.html"
meta "$D/flyer-offer-a5/print/kozy-flyer-offer-A5-print-CMYK.pdf" "Kozy Care — 10% Offer Flyer A5 (Print CMYK)" "A5 148x210mm, 3mm bleed, crop marks, v5.1 — model with KOZY garment bag, hotels & corporate HOTEL15 offer"
meta "$D/flyer-offer-a5/print/kozy-flyer-offer-A5-print-RGB.pdf" "Kozy Care — 10% Offer Flyer A5 (Print RGB)" "A5 148x210mm, 3mm bleed, crop marks, v5.1 — model with KOZY garment bag, hotels & corporate HOTEL15 offer"
meta "$D/flyer-offer-a5/digital/kozy-flyer-offer-digital.pdf" "Kozy Care — 10% Offer Flyer (Digital)" "A5 digital, v5.1 — model with KOZY garment bag, hotels & corporate HOTEL15 offer"
node "$SNAP" flyer-b-digital-v51.html "$D/flyer-offer-a5/digital/kozy-flyer-offer.png" --w 560 --h 794 --scale 2 >/dev/null
echo "✓ flyer offer A5 packaged (v5.1)"

# ---------- poster A3 v5.1 ----------
node "$H2P" poster-a3-v51.html --output poster-a3-v51.pdf --width 1183px
node "$H2P" poster-a3-digital-v51.html --output poster-a3-v51-digital.pdf --width 1123px
cmyk poster-a3-v51.pdf poster-a3-v51-cmyk.pdf
cp poster-a3-v51-cmyk.pdf    "$D/poster-a3/print/kozy-poster-A3-print-CMYK.pdf"
cp poster-a3-v51.pdf         "$D/poster-a3/print/kozy-poster-A3-print-RGB.pdf"
cp poster-a3-v51-digital.pdf "$D/poster-a3/digital/kozy-poster-A3-digital.pdf"
cp poster-a3-v51.html        "$D/poster-a3/html-source/poster-a3.html"
meta "$D/poster-a3/print/kozy-poster-A3-print-CMYK.pdf" "Kozy Care — A3 Poster (Print CMYK)" "A3 297x420mm, 3mm bleed, crop marks, v5.1 — hotels & corporate wording on HOTEL15 line"
meta "$D/poster-a3/print/kozy-poster-A3-print-RGB.pdf" "Kozy Care — A3 Poster (Print RGB)" "A3 297x420mm, 3mm bleed, crop marks, v5.1 — hotels & corporate wording on HOTEL15 line"
meta "$D/poster-a3/digital/kozy-poster-A3-digital.pdf" "Kozy Care — A3 Poster (Digital)" "A3 digital, v5.1 — hotels & corporate wording on HOTEL15 line"
node "$SNAP" poster-a3-digital-v51.html "$D/poster-a3/digital/kozy-poster-A3.png" --w 1123 --h 1587 --scale 1.5 >/dev/null
echo "✓ poster A3 packaged (v5.1)"

echo "all v5.1 pieces rendered + packaged (v5 untouched)"
