#!/bin/bash
# render_package_v6.sh — render + package the Kozy Care brand kit v6.
#
# Outputs (download/kozy-brand/v6-name-and-series-update/):
#   logo/                 corrected Kozy Care vector lockups + PNG exports
#   business-cards/       personal cards (Orion CEO + Khare) x navy/white/gold
#                         x print(RGB+CMYK 2-sided) + digital + png previews
#   light-series/         services flyer A5 + A3 poster on Kozy Cream
#   gold-corporate/       A4 institutional sheet + A5 institutional flyer
#   brand-sheet/          brand sheet V2
#
# Then builds download/kozy-brand-kit-v6-complete.zip containing
#   01-current-kit-v5.1/  (the old material, untouched)
#   02-new-v6/            (everything above)
#   README-FIRST.txt
set -e
H2P=/home/z/my-project/skills/pdf/scripts/html2poster.js
PDFPY=/home/z/my-project/skills/pdf/scripts/pdf.py
SNAP=/home/z/my-project/scripts/kozy-brand/snap.js
W=/home/z/my-project/work/kozy-brand
D=/home/z/my-project/download/kozy-brand/v6-name-and-series-update
PDF_SKILL_DIR=/home/z/my-project/skills/pdf
export PDF_SKILL_DIR

mkdir -p "$D"/logo/png "$D"/business-cards/{print,digital,html-source,png} \
         "$D"/light-series/{print,digital,html-source} \
         "$D"/gold-corporate/{print,digital,html-source} \
         "$D"/brand-sheet
cd "$W"

cmyk() { gs -dSAFER -dBATCH -dNOPAUSE -sDEVICE=pdfwrite \
   -sColorConversionStrategy=CMYK -dProcessColorModel=/DeviceCMYK \
   -o "$2" "$1" >/dev/null 2>&1; echo "  CMYK: $2"; }

meta() { python3 "$PDF_SKILL_DIR/scripts/pdf.py" meta.set "$1" -o "$1.tmp" \
  -d "{\"Title\": \"$2\", \"Author\": \"Kozy Care Drycleaning & Laundry Services\", \"Creator\": \"Kozy Brand Kit v6\", \"Subject\": \"$3\"}" >/dev/null
  mv "$1.tmp" "$1"; }

# ---------------------------------------------------------------- 1. logo pack
echo "== LOGO =="
for c in navy white gold; do
  cp logo-v6/kozy-logo-primary-$c.svg   "$D/logo/kozy-logo-primary-$c.svg"
  cp logo-v6/kozy-logo-compact-$c.svg   "$D/logo/kozy-logo-compact-$c.svg"
  cp logo-v6/kozy-logo-print-caps-$c.svg "$D/logo/kozy-logo-print-caps-$c.svg"
done
# png exports (transparent, 2x)
node "$SNAP" logo-v6/kozy-logo-primary-navy.svg  "$D/logo/png/kozy-logo-primary-navy.png"  --w 1600 --h 400 --scale 1 --transparent >/dev/null 2>&1 || \
  node "$SNAP" "$W/logo-v6/check.html" /tmp/l.png --w 900 --h 160 --scale 2 >/dev/null 2>&1 || true
cp logo-v6/check.html "$D/logo/logo-lockups-preview.html" 2>/dev/null || true
node "$SNAP" logo-v6/kozy-logo-primary-navy.svg "$D/logo/png/kozy-logo-primary-navy.png" --w 1200 --h 300 --scale 2 --transparent 2>/dev/null | tail -1
node "$SNAP" logo-v6/kozy-logo-primary-white.svg "$D/logo/png/kozy-logo-primary-white.png" --w 1200 --h 300 --scale 2 --transparent 2>/dev/null | tail -1
node "$SNAP" logo-v6/kozy-logo-primary-gold.svg  "$D/logo/png/kozy-logo-primary-gold.png"  --w 1200 --h 300 --scale 2 --transparent 2>/dev/null | tail -1
node "$SNAP" logo-v6/kozy-logo-compact-gold.svg  "$D/logo/png/kozy-logo-compact-gold.png"  --w 1200 --h 300 --scale 2 --transparent 2>/dev/null | tail -1
node "$SNAP" logo-v6/kozy-logo-print-caps-white.svg "$D/logo/png/kozy-logo-print-caps-white.png" --w 1200 --h 300 --scale 2 --transparent 2>/dev/null | tail -1
# monogram + legacy K assets carry over unchanged (K is an icon, still valid)
cp /home/z/my-project/download/kozy-brand/logo/kozy-mark-v4.svg "$D/logo/" 2>/dev/null || true
cp /home/z/my-project/download/kozy-brand/logo/kozy-icon*.svg "$D/logo/" 2>/dev/null || true

# ---------------------------------------------------------- 2. business cards
echo "== BUSINESS CARDS =="
for f in navy white gold; do
  # the back is per-finish (company info only, no personal data)
  node "$H2P" cards-v6/card-$f-back.html --output cards-v6/card-$f-back.pdf --width 382px 2>/dev/null | grep -E 'Done|Size' || true
  node "$H2P" cards-v6/card-$f-back-digital.html --output cards-v6/card-$f-back-digital.pdf --width 321.26px 2>/dev/null | grep -E 'Done|Size' || true
  cmyk cards-v6/card-$f-back.pdf cards-v6/card-$f-back-cmyk.pdf
  cp cards-v6/card-$f-back.html "$D/business-cards/html-source/" 2>/dev/null || true
  node "$SNAP" cards-v6/card-$f-back-digital.html "$D/business-cards/png/kozy-card-$f-back.png" --w 321 --h 208 --scale 3 >/dev/null
  cp cards-v6/card-$f-back-digital.pdf "$D/business-cards/digital/kozy-card-$f-back-digital.pdf"
  for p in orion khare; do
    node "$H2P" cards-v6/card-$f-$p-front.html --output cards-v6/card-$f-$p-front.pdf --width 382px 2>/dev/null | grep -E 'Done|Size' || true
    node "$H2P" cards-v6/card-$f-$p-front-digital.html --output cards-v6/card-$f-$p-front-digital.pdf --width 321.26px 2>/dev/null | grep -E 'Done|Size' || true
    cmyk cards-v6/card-$f-$p-front.pdf cards-v6/card-$f-$p-front-cmyk.pdf
    python3 "$PDFPY" pages.merge cards-v6/card-$f-$p-front.pdf cards-v6/card-$f-back.pdf -o cards-v6/card-$f-$p-2sided-rgb.pdf >/dev/null
    python3 "$PDFPY" pages.merge cards-v6/card-$f-$p-front-cmyk.pdf cards-v6/card-$f-back-cmyk.pdf -o cards-v6/card-$f-$p-2sided-cmyk.pdf >/dev/null
    cp cards-v6/card-$f-$p-2sided-cmyk.pdf "$D/business-cards/print/kozy-card-$f-$p-2sided-print-CMYK.pdf"
    cp cards-v6/card-$f-$p-2sided-rgb.pdf  "$D/business-cards/print/kozy-card-$f-$p-2sided-print-RGB.pdf"
    cp cards-v6/card-$f-$p-front-digital.pdf "$D/business-cards/digital/kozy-card-$f-$p-front-digital.pdf"
    cp cards-v6/card-$f-$p-front-digital.pdf  "$D/business-cards/digital/kozy-card-$f-$p-front-digital.pdf"
    cp cards-v6/card-$f-$p-front.html "$D/business-cards/html-source/" 2>/dev/null || true
    node "$SNAP" cards-v6/card-$f-$p-front-digital.html "$D/business-cards/png/kozy-card-$f-$p-front.png" --w 321 --h 208 --scale 3 >/dev/null
    meta "$D/business-cards/print/kozy-card-$f-$p-2sided-print-CMYK.pdf" "Kozy Care — Business Card ($f, ${p^}) 85x55mm (Print CMYK)" "85x55mm, 3mm bleed, crop marks — v6 personal card, double-sided"
    meta "$D/business-cards/print/kozy-card-$f-$p-2sided-print-RGB.pdf"  "Kozy Care — Business Card ($f, ${p^}) 85x55mm (Print RGB)"  "85x55mm, 3mm bleed, crop marks — v6 personal card, double-sided"
  done
done
echo "  cards done (2 people x 3 finishes)"

# ------------------------------------------------------------- 3. light series
echo "== LIGHT SERIES =="
node "$H2P" light-series/flyer-light-front.html --output light-series/flyer-light-front.pdf --width 619.84px 2>/dev/null | grep -E 'Done|Size' || true
node "$H2P" light-series/flyer-light-back.html  --output light-series/flyer-light-back.pdf  --width 619.84px 2>/dev/null | grep -E 'Done|Size' || true
node "$H2P" light-series/flyer-light-front-digital.html --output light-series/flyer-light-front-digital.pdf --width 559.4px 2>/dev/null | grep -E 'Done|Size' || true
node "$H2P" light-series/flyer-light-back-digital.html  --output light-series/flyer-light-back-digital.pdf  --width 559.4px 2>/dev/null | grep -E 'Done|Size' || true
cmyk light-series/flyer-light-front.pdf light-series/flyer-light-front-cmyk.pdf
cmyk light-series/flyer-light-back.pdf  light-series/flyer-light-back-cmyk.pdf
python3 "$PDFPY" pages.merge light-series/flyer-light-front.pdf light-series/flyer-light-back.pdf -o light-series/flyer-light-2sided-rgb.pdf >/dev/null
python3 "$PDFPY" pages.merge light-series/flyer-light-front-cmyk.pdf light-series/flyer-light-back-cmyk.pdf -o light-series/flyer-light-2sided-cmyk.pdf >/dev/null
cp light-series/flyer-light-2sided-cmyk.pdf "$D/light-series/print/kozy-flyer-light-A5-print-CMYK.pdf"
cp light-series/flyer-light-2sided-rgb.pdf  "$D/light-series/print/kozy-flyer-light-A5-print-RGB.pdf"
cp light-series/flyer-light-front-digital.pdf "$D/light-series/digital/kozy-flyer-light-front-digital.pdf"
cp light-series/flyer-light-back-digital.pdf "$D/light-series/digital/kozy-flyer-light-back-digital.pdf"
cp light-series/flyer-light-front.html light-series/flyer-light-back.html "$D/light-series/html-source/"
node "$SNAP" light-series/flyer-light-front-digital.html "$D/light-series/digital/kozy-flyer-light-front.png" --w 560 --h 794 --scale 2 >/dev/null
node "$SNAP" light-series/flyer-light-back-digital.html  "$D/light-series/digital/kozy-flyer-light-back.png"  --w 560 --h 794 --scale 2 >/dev/null
meta "$D/light-series/print/kozy-flyer-light-A5-print-CMYK.pdf" "Kozy Care — Services Flyer A5 LIGHT (Print CMYK, double-sided)" "A5 148x210mm, 3mm bleed, crop marks — v6 Light series on Kozy Cream"
meta "$D/light-series/print/kozy-flyer-light-A5-print-RGB.pdf" "Kozy Care — Services Flyer A5 LIGHT (Print RGB, double-sided)" "A5 148x210mm, 3mm bleed, crop marks — v6 Light series on Kozy Cream"

node "$H2P" light-series/poster-light-a3.html --output light-series/poster-light-a3.pdf --width 1182.99px 2>/dev/null | grep -E 'Done|Size' || true
node "$H2P" light-series/poster-light-a3-digital.html --output light-series/poster-light-a3-digital.pdf --width 1122.5px 2>/dev/null | grep -E 'Done|Size' || true
cmyk light-series/poster-light-a3.pdf light-series/poster-light-a3-cmyk.pdf
cp light-series/poster-light-a3-cmyk.pdf "$D/light-series/print/kozy-poster-light-A3-print-CMYK.pdf"
cp light-series/poster-light-a3.pdf     "$D/light-series/print/kozy-poster-light-A3-print-RGB.pdf"
cp light-series/poster-light-a3-digital.pdf "$D/light-series/digital/kozy-poster-light-A3-digital.pdf"
cp light-series/poster-light-a3.html "$D/light-series/html-source/"
node "$SNAP" light-series/poster-light-a3-digital.html "$D/light-series/digital/kozy-poster-light-A3.png" --w 1123 --h 1587 --scale 1.5 >/dev/null
meta "$D/light-series/print/kozy-poster-light-A3-print-CMYK.pdf" "Kozy Care — A3 Poster LIGHT (Print CMYK)" "A3 297x420mm, 3mm bleed, crop marks — v6 Light series on Kozy Cream"
meta "$D/light-series/print/kozy-poster-light-A3-print-RGB.pdf" "Kozy Care — A3 Poster LIGHT (Print RGB)" "A3 297x420mm, 3mm bleed, crop marks — v6 Light series on Kozy Cream"

# ------------------------------------------------------------ 4. gold corporate
echo "== GOLD CORPORATE =="
node "$H2P" gold-corporate/corporate-sheet-a4.html --output gold-corporate/corporate-sheet-a4.pdf --width 854.17px 2>/dev/null | grep -E 'Done|Size' || true
node "$H2P" gold-corporate/corporate-sheet-a4-digital.html --output gold-corporate/corporate-sheet-a4-digital.pdf --width 793.7px 2>/dev/null | grep -E 'Done|Size' || true
cmyk gold-corporate/corporate-sheet-a4.pdf gold-corporate/corporate-sheet-a4-cmyk.pdf
cp gold-corporate/corporate-sheet-a4-cmyk.pdf "$D/gold-corporate/print/kozy-corporate-sheet-A4-print-CMYK.pdf"
cp gold-corporate/corporate-sheet-a4.pdf     "$D/gold-corporate/print/kozy-corporate-sheet-A4-print-RGB.pdf"
cp gold-corporate/corporate-sheet-a4-digital.pdf "$D/gold-corporate/digital/kozy-corporate-sheet-A4-digital.pdf"
cp gold-corporate/corporate-sheet-a4.html "$D/gold-corporate/html-source/"
node "$SNAP" gold-corporate/corporate-sheet-a4-digital.html "$D/gold-corporate/digital/kozy-corporate-sheet-A4.png" --w 794 --h 1123 --scale 1.5 >/dev/null
meta "$D/gold-corporate/print/kozy-corporate-sheet-A4-print-CMYK.pdf" "Kozy Care — Institutional Services Sheet A4 (Print CMYK)" "A4 210x297mm, 3mm bleed, crop marks — v6 Gold Corporate series"
meta "$D/gold-corporate/print/kozy-corporate-sheet-A4-print-RGB.pdf" "Kozy Care — Institutional Services Sheet A4 (Print RGB)" "A4 210x297mm, 3mm bleed, crop marks — v6 Gold Corporate series"

node "$H2P" gold-corporate/flyer-institutional-front.html --output gold-corporate/flyer-inst-front.pdf --width 619.84px 2>/dev/null | grep -E 'Done|Size' || true
node "$H2P" gold-corporate/flyer-institutional-back.html  --output gold-corporate/flyer-inst-back.pdf  --width 619.84px 2>/dev/null | grep -E 'Done|Size' || true
node "$H2P" gold-corporate/flyer-institutional-front-digital.html --output gold-corporate/flyer-inst-front-digital.pdf --width 559.4px 2>/dev/null | grep -E 'Done|Size' || true
node "$H2P" gold-corporate/flyer-institutional-back-digital.html  --output gold-corporate/flyer-inst-back-digital.pdf  --width 559.4px 2>/dev/null | grep -E 'Done|Size' || true
cmyk gold-corporate/flyer-inst-front.pdf gold-corporate/flyer-inst-front-cmyk.pdf
cmyk gold-corporate/flyer-inst-back.pdf  gold-corporate/flyer-inst-back-cmyk.pdf
python3 "$PDFPY" pages.merge gold-corporate/flyer-inst-front.pdf gold-corporate/flyer-inst-back.pdf -o gold-corporate/flyer-inst-2sided-rgb.pdf >/dev/null
python3 "$PDFPY" pages.merge gold-corporate/flyer-inst-front-cmyk.pdf gold-corporate/flyer-inst-back-cmyk.pdf -o gold-corporate/flyer-inst-2sided-cmyk.pdf >/dev/null
cp gold-corporate/flyer-inst-2sided-cmyk.pdf "$D/gold-corporate/print/kozy-flyer-institutional-A5-print-CMYK.pdf"
cp gold-corporate/flyer-inst-2sided-rgb.pdf  "$D/gold-corporate/print/kozy-flyer-institutional-A5-print-RGB.pdf"
cp gold-corporate/flyer-inst-front-digital.pdf "$D/gold-corporate/digital/kozy-flyer-institutional-front-digital.pdf"
cp gold-corporate/flyer-inst-back-digital.pdf "$D/gold-corporate/digital/kozy-flyer-institutional-back-digital.pdf"
cp gold-corporate/flyer-institutional-front.html gold-corporate/flyer-institutional-back.html "$D/gold-corporate/html-source/"
node "$SNAP" gold-corporate/flyer-institutional-front-digital.html "$D/gold-corporate/digital/kozy-flyer-institutional-front.png" --w 560 --h 794 --scale 2 >/dev/null
node "$SNAP" gold-corporate/flyer-institutional-back-digital.html  "$D/gold-corporate/digital/kozy-flyer-institutional-back.png"  --w 560 --h 794 --scale 2 >/dev/null
meta "$D/gold-corporate/print/kozy-flyer-institutional-A5-print-CMYK.pdf" "Kozy Care — Institutional Flyer A5 (Print CMYK, double-sided)" "A5 148x210mm, 3mm bleed, crop marks — v6 Gold Corporate series"
meta "$D/gold-corporate/print/kozy-flyer-institutional-A5-print-RGB.pdf" "Kozy Care — Institutional Flyer A5 (Print RGB, double-sided)" "A5 148x210mm, 3mm bleed, crop marks — v6 Gold Corporate series"

# -------------------------------------------------------------- 5. brand sheet
echo "== BRAND SHEET V2 =="
node "$H2P" brand-sheet-v2/kozy-brand-sheet-v2.html --output brand-sheet-v2/kozy-brand-sheet-v2.pdf --width 794px 2>/dev/null | grep -E 'Done|Size' || true
cmyk brand-sheet-v2/kozy-brand-sheet-v2.pdf brand-sheet-v2/kozy-brand-sheet-v2-cmyk.pdf
cp brand-sheet-v2/kozy-brand-sheet-v2.pdf "$D/brand-sheet/kozy-brand-sheet-v2.pdf"
cp brand-sheet-v2/kozy-brand-sheet-v2-cmyk.pdf "$D/brand-sheet/kozy-brand-sheet-v2-CMYK.pdf"
cp brand-sheet-v2/kozy-brand-sheet-v2.html "$D/brand-sheet/"
node "$SNAP" brand-sheet-v2/kozy-brand-sheet-v2.html "$D/brand-sheet/kozy-brand-sheet-v2.png" --w 794 --h 1123 --scale 1.5 >/dev/null
meta "$D/brand-sheet/kozy-brand-sheet-v2.pdf" "Kozy Care — Brand Guidelines V2" "Naming rules, corrected lockups, three series, colour, typography — v6"

echo "ALL v6 PIECES RENDERED"
