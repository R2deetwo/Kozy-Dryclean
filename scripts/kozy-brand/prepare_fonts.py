#!/usr/bin/env python3
"""Instantiate static weights from variable fonts + inspect the Playfair 'K' glyph structure."""
import os
from fontTools import ttLib
from fontTools.varLib.instancer import instantiateVariableFont

FONT_DIR = "/home/z/my-project/work/kozy-brand/fonts"
OUT_DIR = os.path.join(FONT_DIR, "static")
os.makedirs(OUT_DIR, exist_ok=True)

JOBS = [
    ("PlayfairDisplay-VF.ttf", 500, "PlayfairDisplay-Medium.ttf"),
    ("PlayfairDisplay-VF.ttf", 600, "PlayfairDisplay-SemiBold.ttf"),
    ("PlayfairDisplay-VF.ttf", 700, "PlayfairDisplay-Bold.ttf"),
    ("PlayfairDisplay-VF.ttf", 800, "PlayfairDisplay-ExtraBold.ttf"),
    ("Outfit-VF.ttf", 300, "Outfit-Light.ttf"),
    ("Outfit-VF.ttf", 400, "Outfit-Regular.ttf"),
    ("Outfit-VF.ttf", 500, "Outfit-Medium.ttf"),
]

for src, wght, dst in JOBS:
    font = ttLib.TTFont(os.path.join(FONT_DIR, src))
    instantiateVariableFont(font, {"wght": wght}, inplace=True)
    out = os.path.join(OUT_DIR, dst)
    font.save(out)
    print(f"✓ {dst}")

# ---- Inspect Playfair Bold 'K' glyph ----
f = ttLib.TTFont(os.path.join(OUT_DIR, "PlayfairDisplay-Bold.ttf"))
cmap = f.getBestCmap()
glyf = f["glyf"]
glyphset = f.getGlyphSet()
kname = cmap[ord("K")]
print(f"\n'K' glyph name: {kname}")
g = glyf[kname]
print(f"numberOfContours: {g.numberOfContours}")
print(f"xMin/yMin/xMax/yMax: {g.xMin}, {g.yMin}, {g.xMax}, {g.yMax}")
upm = f["head"].unitsPerEm
print(f"unitsPerEm: {upm}")

# Dump raw coordinates of each contour so we can see the arm vs stem vs leg structure
from fontTools.pens.recordingPen import RecordingPen
pen = RecordingPen()
glyphset[kname].draw(pen)
for i, (op, pts) in enumerate(pen.value):
    if op == "closePath":
        continue
print(f"total ops: {len(pen.value)}")

# Use DecomposingPen? Simpler: print contours from glyf coordinates
coords, ends, flags = g.getCoordinates(glyphset)
print(f"total points: {len(coords)}, contour ends: {ends}")
start = 0
for ci, end in enumerate(ends):
    contour = coords[start:end+1]
    xs = [p[0] for p in contour]; ys = [p[1] for p in contour]
    print(f"\ncontour {ci}: {len(contour)} pts | x {min(xs)}..{max(xs)} y {min(ys)}..{max(ys)}")
    start = end + 1

# Also check O Z Y for wordmark, and metrics
hmtx = f["hmtx"]
for ch in "KOZY":
    gn = cmap[ord(ch)]
    print(f"'{ch}' ({gn}): advance={hmtx[gn][0]}, bbox={glyf[gn].xMin},{glyf[gn].yMin},{glyf[gn].xMax},{glyf[gn].yMax}")
