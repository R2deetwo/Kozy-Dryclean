#!/usr/bin/env python3
"""Small-size favicon variant: simplified K (no wire) for 16-48px clarity."""
import os
from fontTools import ttLib
from fontTools.pens.svgPathPen import SVGPathPen

FONTS = "/home/z/my-project/work/kozy-brand/fonts/static"
OUT = "/home/z/my-project/download/kozy-brand/logo"
GOLD, NAVY = "#D4AF37", "#0A192F"

f = ttLib.TTFont(os.path.join(FONTS, "PlayfairDisplay-Bold.ttf"))
gs = f.getGlyphSet()
pen = SVGPathPen(gs)
gs[f.getBestCmap()[ord("K")]].draw(pen)
K = pen.getCommands()  # bbox x 34..724, y 0..708

for name, fill, bg in [("kozy-icon-k-only.svg", GOLD, None),
                       ("kozy-icon-k-only-navy.svg", NAVY, None)]:
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="10 -24 738 756">'
           f'<g transform="scale(1,-1)"><path d="{K}" fill="{fill}"/></g></svg>')
    with open(os.path.join(OUT, name), "w") as fh:
        fh.write(svg)
    print("✓", name)

# favicon HTML: navy square + simplified gold K
fav = f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  body {{ margin:0; background:transparent; }}
  #asset {{ width:512px; height:512px; background:{NAVY};
           display:flex; align-items:center; justify-content:center; }}
</style></head><body><div id="asset">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="10 -24 738 756"
     style="height:340px;display:block"><g transform="scale(1,-1)">
<path d="{K}" fill="{GOLD}"/></g></svg></div></body></html>"""
with open("/home/z/my-project/work/kozy-brand/render/favicon.html", "w") as fh:
    fh.write(fav)
print("✓ favicon render page")
