#!/bin/bash
# Render the v4.2 marketing pieces: print PDFs (RGB + CMYK), merges, digital PDFs + PNG previews.
set -e
H2P=/home/z/my-project/skills/pdf/scripts/html2poster.js
PDFPY=/home/z/my-project/skills/pdf/scripts/pdf.py
SNAP=/home/z/my-project/scripts/kozy-brand/snap.js
W=/home/z/my-project/work/kozy-brand
cd "$W"

cmyk() { gs -dSAFER -dBATCH -dNOPAUSE -sDEVICE=pdfwrite \
     -sColorConversionStrategy=CMYK -dProcessColorModel=/DeviceCMYK \
     -o "$2" "$1" >/dev/null 2>&1 && echo "✓ CMYK: $2"; }

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

echo "--- QA preview PNGs ---"
node "$SNAP" flyer-a-front-digital.html qa-fa-front.png --w 560 --h 794 --scale 2
node "$SNAP" flyer-a-back-digital.html  qa-fa-back.png  --w 560 --h 794 --scale 2
node "$SNAP" flyer-b-digital.html      qa-fb.png        --w 560 --h 794 --scale 2
node "$SNAP" poster-a3-digital.html    qa-poster.png    --w 1123 --h 1587 --scale 1.5
echo "✓ all renders complete"
