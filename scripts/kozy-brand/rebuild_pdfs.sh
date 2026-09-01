#!/bin/bash
# Rebuild all print PDFs (RGB + CMYK) + digital PDFs + merges for the Kozy brand kit.
# Run AFTER build_logo_v3.py + the flyer/poster/brand-sheet builders.
set -e
H2P=/home/z/my-project/skills/pdf/scripts/html2poster.js
PDFPY=/home/z/my-project/skills/pdf/scripts/pdf.py
W=/home/z/my-project/work/kozy-brand
LOGO_OUT=/home/z/my-project/download/kozy-brand/logo
cd "$W"

cmyk() { # in.pdf out.pdf — DeviceCMYK conversion via ghostscript
  gs -dSAFER -dBATCH -dNOPAUSE -sDEVICE=pdfwrite \
     -sColorConversionStrategy=CMYK -dProcessColorModel=/DeviceCMYK \
     -o "$2" "$1" >/dev/null 2>&1
  echo "✓ CMYK: $2"
}

echo "--- logo print PDF (vector, navy square) ---"
node "$H2P" render/logo-print.html --output "$LOGO_OUT/kozy-logo-print.pdf" --width 1200px

echo "--- flyer A (A5 double-sided) ---"
node "$H2P" flyer-a-front.html --output flyer-a-front.pdf --width 620px
node "$H2P" flyer-a-back.html --output flyer-a-back.pdf --width 620px
node "$H2P" flyer-a-front-digital.html --output flyer-a-front-digital.pdf --width 560px
node "$H2P" flyer-a-back-digital.html --output flyer-a-back-digital.pdf --width 560px
cmyk flyer-a-front.pdf flyer-a-front-cmyk.pdf
cmyk flyer-a-back.pdf flyer-a-back-cmyk.pdf
python3 "$PDFPY" pages.merge flyer-a-front.pdf flyer-a-back.pdf -o flyer-a-double-sided.pdf >/dev/null
python3 "$PDFPY" pages.merge flyer-a-front-cmyk.pdf flyer-a-back-cmyk.pdf -o flyer-a-double-sided-cmyk.pdf >/dev/null
echo "✓ merged double-sided (RGB + CMYK)"

echo "--- flyer B (A5 offer) ---"
node "$H2P" flyer-b.html --output flyer-b.pdf --width 620px
node "$H2P" flyer-b-digital.html --output flyer-b-digital.pdf --width 560px
cmyk flyer-b.pdf flyer-b-cmyk.pdf

echo "--- poster A3 ---"
node "$H2P" poster-a3.html --output poster-a3.pdf --width 1183px
node "$H2P" poster-a3-digital.html --output poster-a3-digital.pdf --width 1123px
cmyk poster-a3.pdf poster-a3-cmyk.pdf

echo "--- brand sheet A4 ---"
node "$H2P" brand-sheet.html --output brand-sheet.pdf --width 794px

echo "=== all PDFs rebuilt ==="