#!/bin/bash
# render_package_v91.sh — render + package the Kozy Care v9.1 fixes
# (nylon bag social-box rebuild + owambe poster ladies fix).
#
# Outputs (download/kozy-brand/v9.1-bag-social-and-owambe-fix/):
#   nylon-bag/      print PDF (RGB + CMYK), flat PNG, mockup PNG, html-source
#   poster-owambe/  print PDF (RGB + CMYK), digital PNG, html-source
set -e
H2P=/home/z/my-project/skills/pdf/scripts/html2poster.js
PDFPY=/home/z/my-project/skills/pdf/scripts/pdf.py
SNAP=/home/z/my-project/scripts/kozy-brand/snap.js
W=/home/z/my-project/work/kozy-brand/marketing-v9
D=/home/z/my-project/download/kozy-brand/v9.1-bag-social-and-owambe-fix
PDF_SKILL_DIR=/home/z/my-project/skills/pdf
export PDF_SKILL_DIR

mkdir -p "$D"/nylon-bag/{print,html-source} "$D"/poster-owambe/{print,digital,html-source}
cd "$W"

cmyk() { gs -dSAFER -dBATCH -dNOPAUSE -sDEVICE=pdfwrite \
   -sColorConversionStrategy=CMYK -dProcessColorModel=/DeviceCMYK \
   -o "$2" "$1" >/dev/null 2>&1; echo "  CMYK: $2"; }

meta() { python3 "$PDF_SKILL_DIR/scripts/pdf.py" meta.set "$1" -o "$1.tmp" \
  -d "{\"Title\": \"$2\", \"Author\": \"Kozy Care Drycleaning & Laundry Services\", \"Creator\": \"Kozy Brand Kit v9.1\", \"Subject\": \"$3\"}" >/dev/null
  mv "$1.tmp" "$1"; }

echo "== NYLON BAG (social box fix) =="
node "$H2P" bag-navy-gold.html --output bag-navy-gold.pdf --width 1762px 2>/dev/null | grep -E 'Done|Size|page' || true
cmyk bag-navy-gold.pdf bag-navy-gold-cmyk.pdf
meta bag-navy-gold.pdf "Kozy Care — Nylon Bag Artwork (450x600mm)" "Nylon bag print artwork v9.1 — neat social box" 
meta bag-navy-gold-cmyk.pdf "Kozy Care — Nylon Bag Artwork (450x600mm, CMYK)" "Nylon bag print artwork v9.1 — neat social box"
cp bag-navy-gold.pdf       "$D/nylon-bag/print/kozy-nylon-bag-navy-gold-450x600-PRINT-RGB.pdf"
cp bag-navy-gold-cmyk.pdf  "$D/nylon-bag/print/kozy-nylon-bag-navy-gold-450x600-PRINT-CMYK.pdf"
cp bag-navy-gold.png       "$D/nylon-bag/kozy-nylon-bag-navy-gold-FLAT.png"
node "$SNAP" bag-mockup.html "$D/nylon-bag/kozy-nylon-bag-MOCKUP.png" --w 1050 --h 1470 --scale 1 >/dev/null
cp bag-navy-gold.html bag-navy-gold-digital.html bag-mockup.html "$D/nylon-bag/html-source/"

echo "== OWAMBE POSTER (ladies fix) =="
node "$H2P" poster-owambe-a3.html --output poster-owambe-a3.pdf --width 1183px 2>/dev/null | grep -E 'Done|Size|page' || true
cmyk poster-owambe-a3.pdf poster-owambe-a3-cmyk.pdf
meta poster-owambe-a3.pdf "Kozy Care — A3 Poster, Owambe (297x420mm)" "A3 owambe poster v9.1 — corrected party image"
meta poster-owambe-a3-cmyk.pdf "Kozy Care — A3 Poster, Owambe (297x420mm, CMYK)" "A3 owambe poster v9.1 — corrected party image"
cp poster-owambe-a3.pdf      "$D/poster-owambe/print/kozy-poster-owambe-a3-PRINT-RGB.pdf"
cp poster-owambe-a3-cmyk.pdf "$D/poster-owambe/print/kozy-poster-owambe-a3-PRINT-CMYK.pdf"
cp poster-owambe-a3.png      "$D/poster-owambe/digital/kozy-poster-owambe-a3-DIGITAL.png"
cp poster-owambe-a3.html poster-owambe-a3-digital.html "$D/poster-owambe/html-source/"

echo "== QR ASSET =="
cp qr-k-navy.png "$D/kozy-qr-scan-to-book.png"

echo "DONE -> $D"
