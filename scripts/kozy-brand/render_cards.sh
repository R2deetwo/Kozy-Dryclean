#!/bin/bash
# Render business cards: print (RGB+CMYK) + digital PDFs + PNG previews.
set -e
H2P=/home/z/my-project/skills/pdf/scripts/html2poster.js
PDFPY=/home/z/my-project/skills/pdf/scripts/pdf.py
SNAP=/home/z/my-project/scripts/kozy-brand/snap.js
W=/home/z/my-project/work/kozy-brand
cd "$W"

cmyk() { gs -dSAFER -dBATCH -dNOPAUSE -sDEVICE=pdfwrite \
     -sColorConversionStrategy=CMYK -dProcessColorModel=/DeviceCMYK \
     -o "$2" "$1" >/dev/null 2>&1 && echo "✓ CMYK: $2"; }

for theme in navy white; do
  for side in front back; do
    node "$H2P" card-$theme-$side.html         --output card-$theme-$side.pdf         --width 382px  2>/dev/null | grep -E 'Done|Size' || true
    node "$H2P" card-$theme-$side-digital.html --output card-$theme-$side-digital.pdf --width 321px  2>/dev/null | grep -E 'Done|Size' || true
    cmyk card-$theme-$side.pdf card-$theme-$side-cmyk.pdf
    python3 "$PDFPY" pages.merge card-$theme-$side-cmyk.pdf -o /tmp/_m.pdf >/dev/null 2>&1 || true
  done
  python3 "$PDFPY" pages.merge card-$theme-front-cmyk.pdf card-$theme-back-cmyk.pdf -o card-$theme-2sided-cmyk.pdf >/dev/null
  python3 "$PDFPY" pages.merge card-$theme-front.pdf card-$theme-back.pdf -o card-$theme-2sided-rgb.pdf >/dev/null
  echo "✓ $theme two-sided merges (RGB + CMYK)"
done

node "$SNAP" card-navy-front-digital.html  qa-card-navy-front.png  --w 321 --h 208 --scale 3
node "$SNAP" card-navy-back-digital.html   qa-card-navy-back.png   --w 321 --h 208 --scale 3
node "$SNAP" card-white-front-digital.html qa-card-white-front.png --w 321 --h 208 --scale 3
node "$SNAP" card-white-back-digital.html  qa-card-white-back.png  --w 321 --h 208 --scale 3
echo "✓ card renders complete"
