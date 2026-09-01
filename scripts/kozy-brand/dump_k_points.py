#!/usr/bin/env python3
"""Dump precise point data for the K's arm terminal and stem serif regions."""
from fontTools import ttLib

f = ttLib.TTFont("/home/z/my-project/work/kozy-brand/fonts/static/PlayfairDisplay-Bold.ttf")
glyf = f["glyf"]; glyphset = f.getGlyphSet()
g = glyf["K"]
coords, ends, flags = g.getCoordinates(glyphset)

# contour 0 = arm+leg, contour 1 = stem
start = 0
contours = []
for end in ends:
    contours.append(list(zip(coords[start:end+1], flags[start:end+1])))
    start = end + 1

def show(contour, label, filt=None):
    print(f"\n=== {label} ===")
    for i, ((x, y), fl) in enumerate(contour):
        if filt is None or filt(x, y):
            kind = "on " if fl else "off"
            print(f"  [{i:2d}] ({x:4d},{y:4d}) {kind}")

arm = contours[0]; stem = contours[1]

# Arm terminal region: top-right (x>560, y>560)
show(arm, "ARM TERMINAL (top-right)", lambda x, y: x > 560 and y > 560)
# Arm junction region (near stem, upper)
show(arm, "ARM near junction (x<420, y>350)", lambda x, y: x < 420 and y > 350)
# Stem top serif: contour 1, top area y>600
show(stem, "STEM TOP SERIF (y>600)", lambda x, y: y > 600)
# Stem left edge at mid height (to measure stem weight)
show(stem, "STEM left/right edges at y 300-400", lambda x, y: 300 <= y <= 400)
