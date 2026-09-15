#!/bin/bash
# package_v92.sh — the COMPLETE clean set the client asked for:
# everything (v5.1 kit + v6 additions + v9.1 marketing pieces with the
# finger-corrected owambe poster) in ONE zip.
#
# Scope guarantees:
#   - 01-current-kit-v5.1/ and 02-new-v6/ are copied byte-identical from the
#     approved kozy-brand-kit-v6-complete.zip (no humans defects, untouched).
#   - 03-marketing-v9.1/ carries the nylon bag (no humans) byte-identical and
#     the owambe poster rebuilt ONLY because its party photo had a malformed
#     hand (extra/fused finger) — now regenerated and re-audited: every hand
#     PASS.
set -e
STAGE=/home/z/my-project/work/kozy-brand/pkg-v92
SRC_V6=/home/z/my-project/download/kozy-brand-kit-v6-complete.zip
SRC_V91=/home/z/my-project/download/kozy-brand/v9.1-bag-social-and-owambe-fix
OUT_ZIP=/home/z/my-project/download/kozy-brand-kit-v9.2-complete.zip

rm -rf "$STAGE"; mkdir -p "$STAGE"
cd "$STAGE"

# 1. the approved v6 kit, byte-identical
unzip -q "$SRC_V6" -d .
# the v6 zip ships its own README-FIRST.txt at root — keep as kit README
mv README-FIRST.txt KIT-README-v6.txt 2>/dev/null || true

# 2. the v9.1 marketing additions (owambe poster = finger-corrected v9.2 files)
mkdir -p 03-marketing-v9.1
cp -r "$SRC_V91"/nylon-bag      03-marketing-v9.1/nylon-bag
cp -r "$SRC_V91"/poster-owambe  03-marketing-v9.1/poster-owambe
cp    "$SRC_V91"/kozy-qr-scan-to-book.png 03-marketing-v9.1/
cp    "$SRC_V91"/README-FIRST.txt 03-marketing-v9.1/README-v9.1.txt

# 3. fresh master README + version history
cp /home/z/my-project/download/kozy-brand/VERSIONS.txt VERSIONS.txt

zip -q -r "$OUT_ZIP" .
echo "PACKAGED -> $OUT_ZIP"
unzip -l "$OUT_ZIP" | tail -3
