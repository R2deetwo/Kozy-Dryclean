#!/usr/bin/env python3
"""Shared print-production frame: page = trim + bleed + slug, with crop marks.
All flyer/poster builders import from here."""

MM = 96.0 / 25.4  # CSS px per mm (96dpi)

NAVY = "#0A192F"
GOLD = "#D4AF37"
CREAM = "#F5F1E8"
INK = "#111827"

def px(mm_val):
    return round(mm_val * MM, 2)

class PrintFrame:
    def __init__(self, trim_w_mm, trim_h_mm, bleed_mm=3.0, slug_mm=5.0):
        self.tw, self.th = trim_w_mm, trim_h_mm
        self.bleed, self.slug = bleed_mm, slug_mm
        self.margin = bleed_mm + slug_mm          # beyond trim on each side
        self.pw = trim_w_mm + 2 * self.margin     # page width mm
        self.ph = trim_h_mm + 2 * self.margin     # page height mm
        self.trim_in = px(self.margin)            # trim box inset from page edge (px)
        self.bleed_in = px(self.slug)             # bleed box inset from page edge (px)

    @property
    def W(self): return px(self.pw)
    @property
    def H(self): return px(self.ph)

    def marks_svg(self, note):
        """8 crop marks + slug caption, as an SVG overlay covering the page."""
        w, h = self.W, self.H
        t = self.trim_in                      # trim inset px
        b = px(self.bleed + self.slug)        # mark start offset from trim (bleed+0? no:)
        # marks run from (margin - 1mm) to (bleed edge) measured from page edge:
        m0 = px(self.slug - 1.0)              # start (1mm inside page edge)
        m1 = px(self.slug + 1.0)              # end (1mm outside bleed box)
        # horizontal cut lines at x = t and x = w-t:
        #   mark segments on left: (m0..m1) at y=t and y=h-t ; on right: (w-m1..w-m0)
        # vertical cut lines at y = t and y = h-t:
        #   mark segments on top: (m0..m1) at x=t and x=w-t ; bottom: (h-m1..h-m0)
        L = []
        for y in (t, h - t):
            L.append(f'<line x1="{m0}" y1="{y}" x2="{m1}" y2="{y}"/>')
            L.append(f'<line x1="{w-m1}" y1="{y}" x2="{w-m0}" y2="{y}"/>')
        for x in (t, w - t):
            L.append(f'<line x1="{x}" y1="{m0}" x2="{x}" y2="{m1}"/>')
            L.append(f'<line x1="{x}" y1="{h-m1}" x2="{x}" y2="{h-m0}"/>')
        lines = "\n      ".join(L)
        return f'''<svg class="marks" width="{w}" height="{h}" viewBox="0 0 {w} {h}">
      <g stroke="#111827" stroke-width="0.35" opacity="0.9">
      {lines}
      </g>
      <text x="{w/2}" y="{h - px(2.2)}" text-anchor="middle"
        font-family="Outfit, Arial, sans-serif" font-size="8.5" fill="#6B7280"
        letter-spacing="1.5">{note}</text>
    </svg>'''

    def css(self, digital=False):
        if digital:
            return f"""
  .poster {{ width:{px(self.tw)}px; height:{px(self.th)}px; position:relative; background:{NAVY}; }}
  .bleedbox {{ position:absolute; inset:0; background:{NAVY}; overflow:hidden; }}
  .trim {{ position:absolute; inset:0; }}
  .marks {{ display:none; }}
"""
        return f"""
  .poster {{ width:{self.W}px; height:{self.H}px; position:relative; background:#FFFFFF; }}
  .bleedbox {{ position:absolute; inset:{self.bleed_in}px; background:{NAVY}; overflow:hidden; }}
  .trim {{ position:absolute; inset:{px(self.bleed)}px; }}
  .marks {{ position:absolute; left:0; top:0; pointer-events:none; }}
"""

    def wrap(self, body_html, note, extra_css="", digital=False):
        """Full HTML document with print frame (or clean digital trim-only page)."""
        marks = "" if digital else self.marks_svg(note)
        bg = NAVY if digital else "#FFFFFF"
        return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;0,700;0,800;1,500&family=Marcellus&family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
  html, body {{ margin:0; padding:0; background:{bg}; }}
  * {{ box-sizing:border-box; }}{self.css(digital)}{extra_css}
</style></head>
<body>
<div class="poster">
  <div class="bleedbox"><div class="trim">
{body_html}
  </div></div>
  {marks}
</div>
</body></html>"""
