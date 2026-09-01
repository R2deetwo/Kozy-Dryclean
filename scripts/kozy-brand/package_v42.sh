#!/bin/bash
# Package the v4.2 marketing kit (flyers A/B + poster revisions) and the new
# business-card set into download/kozy-brand/ with final names + metadata.
set -e
PDF_SKILL_DIR=/home/z/my-project/skills/pdf
W=/home/z/my-project/work/kozy-brand
D=/home/z/my-project/download/kozy-brand
SNAP=/home/z/my-project/scripts/kozy-brand/snap.js

meta() { # file title subject
  python3 "$PDF_SKILL_DIR/scripts/pdf.py" meta.set "$1" -o "$1.tmp" \
    -d "{\"Title\": \"$2\", \"Author\": \"Kozy Care Drycleaning & Laundry Services\", \"Creator\": \"Kozy Brand Kit v4.2\", \"Subject\": \"$3\"}" >/dev/null
  mv "$1.tmp" "$1"
}

cd "$W"

# ---------- flyer services (A5 double-sided, v4.2) ----------
mkdir -p "$D/flyer-services-a5/print" "$D/flyer-services-a5/digital" "$D/flyer-services-a5/html-source"
cp flyer-a-double-sided-cmyk.pdf "$D/flyer-services-a5/print/kozy-flyer-services-A5-print-CMYK.pdf"
cp flyer-a-double-sided.pdf      "$D/flyer-services-a5/print/kozy-flyer-services-A5-print-RGB.pdf"
cp flyer-a-front-digital.pdf     "$D/flyer-services-a5/digital/kozy-flyer-services-front-digital.pdf"
cp flyer-a-back-digital.pdf      "$D/flyer-services-a5/digital/kozy-flyer-services-back-digital.pdf"
cp flyer-a-front.html flyer-a-back.html "$D/flyer-services-a5/html-source/"
meta "$D/flyer-services-a5/print/kozy-flyer-services-A5-print-CMYK.pdf" "Kozy Care — Services & Pricing Flyer A5 (Print CMYK, double-sided)" "A5 148x210mm, 3mm bleed, crop marks, v4.2"
meta "$D/flyer-services-a5/print/kozy-flyer-services-A5-print-RGB.pdf" "Kozy Care — Services & Pricing Flyer A5 (Print RGB, double-sided)" "A5 148x210mm, 3mm bleed, crop marks, v4.2"
meta "$D/flyer-services-a5/digital/kozy-flyer-services-front-digital.pdf" "Kozy Care — Services Flyer Front (Digital)" "A5 digital, v4.2"
meta "$D/flyer-services-a5/digital/kozy-flyer-services-back-digital.pdf" "Kozy Care — Price List Flyer Back (Digital)" "A5 digital, v4.2"
node "$SNAP" flyer-a-front-digital.html "$D/flyer-services-a5/digital/kozy-flyer-services-front.png" --w 560 --h 794 --scale 2
node "$SNAP" flyer-a-back-digital.html  "$D/flyer-services-a5/digital/kozy-flyer-services-back.png"  --w 560 --h 794 --scale 2
echo "✓ flyer services A5 packaged"

# ---------- flyer offer (A5, v4.2) ----------
mkdir -p "$D/flyer-offer-a5/print" "$D/flyer-offer-a5/digital" "$D/flyer-offer-a5/html-source"
cp flyer-b-cmyk.pdf    "$D/flyer-offer-a5/print/kozy-flyer-offer-A5-print-CMYK.pdf"
cp flyer-b.pdf         "$D/flyer-offer-a5/print/kozy-flyer-offer-A5-print-RGB.pdf"
cp flyer-b-digital.pdf "$D/flyer-offer-a5/digital/kozy-flyer-offer-digital.pdf"
cp flyer-b.html        "$D/flyer-offer-a5/html-source/"
meta "$D/flyer-offer-a5/print/kozy-flyer-offer-A5-print-CMYK.pdf" "Kozy Care — 15% Offer Flyer A5 (Print CMYK)" "A5 148x210mm, 3mm bleed, crop marks, v4.2"
meta "$D/flyer-offer-a5/print/kozy-flyer-offer-A5-print-RGB.pdf" "Kozy Care — 15% Offer Flyer A5 (Print RGB)" "A5 148x210mm, 3mm bleed, crop marks, v4.2"
meta "$D/flyer-offer-a5/digital/kozy-flyer-offer-digital.pdf" "Kozy Care — 15% Offer Flyer (Digital)" "A5 digital, v4.2"
node "$SNAP" flyer-b-digital.html "$D/flyer-offer-a5/digital/kozy-flyer-offer.png" --w 560 --h 794 --scale 2
echo "✓ flyer offer A5 packaged"

# ---------- poster A3 (v4.2) ----------
mkdir -p "$D/poster-a3/print" "$D/poster-a3/digital" "$D/poster-a3/html-source"
cp poster-a3-cmyk.pdf    "$D/poster-a3/print/kozy-poster-A3-print-CMYK.pdf"
cp poster-a3.pdf         "$D/poster-a3/print/kozy-poster-A3-print-RGB.pdf"
cp poster-a3-digital.pdf "$D/poster-a3/digital/kozy-poster-A3-digital.pdf"
cp poster-a3.html        "$D/poster-a3/html-source/"
meta "$D/poster-a3/print/kozy-poster-A3-print-CMYK.pdf" "Kozy Care — A3 Poster (Print CMYK)" "A3 297x420mm, 3mm bleed, crop marks, v4.2"
meta "$D/poster-a3/print/kozy-poster-A3-print-RGB.pdf" "Kozy Care — A3 Poster (Print RGB)" "A3 297x420mm, 3mm bleed, crop marks, v4.2"
meta "$D/poster-a3/digital/kozy-poster-A3-digital.pdf" "Kozy Care — A3 Poster (Digital)" "A3 digital, v4.2"
node "$SNAP" poster-a3-digital.html "$D/poster-a3/digital/kozy-poster-A3.png" --w 1123 --h 1587 --scale 1.5
echo "✓ poster A3 packaged"

# ---------- business cards (NEW — navy + white) ----------
mkdir -p "$D/business-cards/print" "$D/business-cards/digital" "$D/business-cards/html-source"
for theme in navy white; do
  T=$(echo "$theme" | sed 's/^./\U&/')   # Navy / White
  cp card-$theme-2sided-cmyk.pdf "$D/business-cards/print/kozy-card-$theme-2sided-print-CMYK.pdf"
  cp card-$theme-2sided-rgb.pdf  "$D/business-cards/print/kozy-card-$theme-2sided-print-RGB.pdf"
  meta "$D/business-cards/print/kozy-card-$theme-2sided-print-CMYK.pdf" "Kozy Care — Business Card, $T (Print CMYK, 2-sided)" "85x55mm, 3mm bleed, crop marks, v4.2"
  meta "$D/business-cards/print/kozy-card-$theme-2sided-print-RGB.pdf" "Kozy Care — Business Card, $T (Print RGB, 2-sided)" "85x55mm, 3mm bleed, crop marks, v4.2"
  for side in front back; do
    S=$(echo "$side" | sed 's/^./\U&/')
    cp card-$theme-$side-digital.pdf "$D/business-cards/digital/kozy-card-$theme-$side-digital.pdf"
    meta "$D/business-cards/digital/kozy-card-$theme-$side-digital.pdf" "Kozy Care — Business Card, $T $S (Digital)" "85x55mm digital, v4.2"
    node "$SNAP" card-$theme-$side-digital.html "$D/business-cards/digital/kozy-card-$theme-$side.png" --w 321 --h 208 --scale 3
  done
  cp card-$theme-front.html card-$theme-back.html "$D/business-cards/html-source/"
done
echo "✓ business cards packaged (navy + white)"

echo ""
echo "=== Packaged sizes ==="
du -sh "$D"/* | sort -k2
