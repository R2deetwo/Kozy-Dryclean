#!/bin/bash
# render_owambe_v92.sh — re-render ONLY the owambe poster after the
# finger-corrected asset swap (v9.2). The nylon bag and every other piece
# in the kit are intentionally NOT re-rendered (client rule: do not alter
# pieces without humans / pieces already anatomically correct).
set -e
H2P=/home/z/my-project/skills/pdf/scripts/html2poster.js
PDF_SKILL_DIR=/home/z/my-project/skills/pdf
export PDF_SKILL_DIR
W=/home/z/my-project/work/kozy-brand/marketing-v9
D=/home/z/my-project/download/kozy-brand/v9.1-bag-social-and-owambe-fix

mkdir -p "$D"/poster-owambe/{print,digital,html-source}
cd "$W"

cmyk() { gs -dSAFER -dBATCH -dNOPAUSE -sDEVICE=pdfwrite \
   -sColorConversionStrategy=CMYK -dProcessColorModel=/DeviceCMYK \
   -o "$2" "$1" >/dev/null 2>&1; echo "  CMYK: $2"; }

meta() { python3 "$PDF_SKILL_DIR/scripts/pdf.py" meta.set "$1" -o "$1.tmp" \
  -d "{\"Title\": \"$2\", \"Author\": \"Kozy Care Drycleaning & Laundry Services\", \"Creator\": \"Kozy Brand Kit v9.2\", \"Subject\": \"$3\"}" >/dev/null
  mv "$1.tmp" "$1"; }

echo "== OWAMBE POSTER (finger-corrected asset) =="
node "$H2P" poster-owambe-a3.html --output poster-owambe-a3.pdf --width 1183px 2>/dev/null | grep -E 'Done|Size|page' || true
cmyk poster-owambe-a3.pdf poster-owambe-a3-cmyk.pdf
meta poster-owambe-a3.pdf "Kozy Care — A3 Poster, Owambe (297x420mm)" "A3 owambe poster v9.2 — finger-corrected party image"
meta poster-owambe-a3-cmyk.pdf "Kozy Care — A3 Poster, Owambe (297x420mm, CMYK)" "A3 owambe poster v9.2 — finger-corrected party image"
cp poster-owambe-a3.pdf      "$D/poster-owambe/print/kozy-poster-owambe-a3-PRINT-RGB.pdf"
cp poster-owambe-a3-cmyk.pdf "$D/poster-owambe/print/kozy-poster-owambe-a3-PRINT-CMYK.pdf"
cp poster-owambe-a3.png      "$D/poster-owambe/digital/kozy-poster-owambe-a3-DIGITAL.png"
cp poster-owambe-a3.html poster-owambe-a3-digital.html "$D/poster-owambe/html-source/"
cp images/asset-owambe-party.png "$D/poster-owambe/source-asset/owambe-party-trio.png"
cp images/vlm-owambe-v4.json "$D/poster-owambe/source-asset/vlm-qa-eyes-hands.json"
echo "DONE -> $D/poster-owambe"
