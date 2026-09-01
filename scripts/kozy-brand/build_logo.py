#!/usr/bin/env python3
"""
Build the Kozy production logo (true vector SVG).

Design (winning direction — AI concept 3, VLM-refined):
  - Authentic Playfair Display Bold 'K' (Didone high contrast)
  - One continuous gold 'wire' completing the hanger read:
      ball on stem-serif -> gentle arc over the K -> kisses the arm terminal
      -> curls up into a large CCW hanger hook -> tip ball
  - Wordmark: KOZY (Playfair SemiBold, tracked)
  - Descriptor: PREMIUM DRY CLEANING (Outfit Regular, tracked, width-justified to KOZY)
All flat colors, no gradients — print-safe.
"""
import os
from fontTools import ttLib
from fontTools.pens.svgPathPen import SVGPathPen

FONTS = "/home/z/my-project/work/kozy-brand/fonts/static"
OUT = "/home/z/my-project/download/kozy-brand/logo"
os.makedirs(OUT, exist_ok=True)

GOLD = "#D4AF37"
NAVY = "#0A192F"
WHITE = "#FFFFFF"

# ---------------- glyph helpers ----------------
def load(name):
    return ttLib.TTFont(os.path.join(FONTS, name))

def glyph_path(font, ch):
    """SVG path 'd' for a character, in font units (y-up, baseline y=0)."""
    gs = font.getGlyphSet()
    pname = font.getBestCmap()[ord(ch)]
    pen = SVGPathPen(gs)
    gs[pname].draw(pen)
    return pen.getCommands()

def advance(font, ch):
    gs = font.getBestCmap()
    return font["hmtx"][gs[ord(ch)]][0]

def text_paths(font, text, tracking_em=0.0):
    """Compose a tracked string. Returns (list of (d, x_offset), total_width)."""
    items, x = [], 0.0
    tr = tracking_em * 1000.0
    for i, ch in enumerate(text):
        if ch != " ":
            items.append((glyph_path(font, ch), x))
        x += advance(font, ch)
        if i < len(text) - 1:
            x += tr
    return items, x - tr if text else 0

# ---------------- fonts ----------------
pf_bold = load("PlayfairDisplay-Bold.ttf")
pf_semi = load("PlayfairDisplay-SemiBold.ttf")
outfit_reg = load("Outfit-Regular.ttf")

CAP = 708.0  # Playfair cap height (font units)

# ---------------- the K monogram ----------------
K_PATH = glyph_path(pf_bold, "K")
# K bbox: x 34..724, y 0..708 (arm terminal cut at x=689, y 689..708)

# --- hanger wire: one continuous stroke (font units, y-up) ---
# ball on stem-serif top -> arc over K -> kiss arm terminal -> CCW hook -> tip ball
WIRE_W = 15.0
WIRE = (
    "M 88,703 "
    "C 250,744 430,750 560,744 "
    "C 646,740 676,722 690,701 "
    "C 706,705 728,718 741,740 "
    "C 753,762 750,780 731,781 "
    "C 714,782 705,768 710,752 "
    "C 713,743 721,739 728,742"
)
BALL_SERIF = (88, 703, 8.0)    # x, y, r — rests on stem serif top
BALL_TIP = (728, 742, 9.0)     # hook tip ball

# ---------------- lockups ----------------
def svg_header(vb_x, vb_y_top, w, h):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb_x:.0f} {-vb_y_top:.0f} '
            f'{w:.0f} {h:.0f}">', "</svg>")

def monogram_group(fill):
    """K + wire + balls, centered on its own bbox."""
    parts = [f'<path d="{K_PATH}" fill="{fill}"/>']
    parts.append(f'<path d="{WIRE}" fill="none" stroke="{fill}" stroke-width="{WIRE_W}" '
                 f'stroke-linecap="round"/>')
    for (bx, by, br) in (BALL_SERIF, BALL_TIP):
        parts.append(f'<circle cx="{bx}" cy="{by}" r="{br}" fill="{fill}"/>')
    return "\n    ".join(parts)

# Monogram content bbox: x 34..~755 (wire right edge ~753+7.5), y 0..~788 (hook apex ~781+9)
MONO_X0, MONO_X1 = 20, 765
MONO_Y0, MONO_Y1 = -12, 795

def icon_svg(fill):
    pad = 0.06 * (MONO_Y1 - MONO_Y0)
    x0 = MONO_X0 - pad; x1 = MONO_X1 + pad
    y0 = MONO_Y0 - pad; y1 = MONO_Y1 + pad
    head, tail = svg_header(x0, y1, x1 - x0, y1 - y0)
    return (head + f'\n  <g transform="scale(1,-1)">\n    {monogram_group(fill)}\n  </g>\n' + tail)

# --- wordmark ---
KOZY_TRACK = 0.145
kozy_items, kozy_w = text_paths(pf_semi, "KOZY", KOZY_TRACK)
desc_text = "PREMIUM DRY CLEANING"
DESC_TRACK = 0.30  # em — luxury tracked caps
n = len(desc_text)
adv_sum = sum(advance(outfit_reg, c) for c in desc_text)  # at 1000upm
DESC_SIZE = kozy_w / (adv_sum / 1000.0 + DESC_TRACK * (n - 1))
desc_items, dw = text_paths(outfit_reg, desc_text, DESC_TRACK)
print(f"KOZY width: {kozy_w:.0f} | descriptor size: {DESC_SIZE:.0f} units "
      f"({DESC_SIZE/708*100:.0f}% of cap) | tracking {DESC_TRACK}em | desc width {dw:.0f}")

def wordmark_groups(fill_main, fill_desc):
    """KOZY + descriptor, baseline of KOZY at y=0. Returns (svg, total_height, width)."""
    kozy = "\n    ".join(
        f'<g transform="translate({x:.1f},0)"><path d="{d}" fill="{fill_main}"/></g>'
        for d, x in kozy_items)
    # descriptor sits below KOZY baseline: gap 92 units
    desc_y = -92 - DESC_SIZE  # Outfit has no descenders in caps; baseline here
    desc = "\n    ".join(
        f'<g transform="translate({x:.1f},{desc_y:.1f}) scale({DESC_SIZE/1000:.6f})">'
        f'<path d="{d}" fill="{fill_desc}"/></g>'
        for d, x in desc_items)
    return kozy, desc

def stacked_svg(fill, fill_desc=None):
    fill_desc = fill_desc or fill
    kozy, desc = wordmark_groups(fill, fill_desc)
    # geometry (y-up): monogram baseline at 0 (heights 0..~790), gap 120, KOZY cap 0..708 (Playfair 'O' overshoots to -14)
    gap = 118
    mono_dy = gap + 710  # translate monogram up so its baseline sits above KOZY cap
    x0 = min(MONO_X0, 0) - 20
    x1 = max(MONO_X1, kozy_w) + 20
    y_top = mono_dy + MONO_Y1
    y_bot = -92 - DESC_SIZE - 30  # below descriptor baseline (caps have no descender; pad)
    head, tail = svg_header(x0, y_top, x1 - x0, y_top - y_bot)
    g = [
        head,
        '<g transform="scale(1,-1)">',
        f'  <g transform="translate(0,{mono_dy})">',
        f'    <g transform="translate({(kozy_w-(MONO_X1-MONO_X0))/2 - MONO_X0:.1f},0)">',
        monogram_group(fill),
        '  </g>',
        '  </g>',
        '  <!-- KOZY wordmark, cap height 708 -->',
        kozy,
        '  <!-- descriptor -->',
        desc,
        '</g>',
        tail,
    ]
    return "\n".join(g)

def horizontal_svg(fill, fill_desc=None):
    fill_desc = fill_desc or fill
    kozy, desc = wordmark_groups(fill, fill_desc)
    # monogram scaled to wordmark cap height * 1.52, left; wordmark right
    mono_h = MONO_Y1 - MONO_Y0
    target_h = 708 * 1.58
    s = target_h / mono_h
    gapx = 150
    mono_x = 0
    wm_x = mono_x + (MONO_X1 - MONO_X0) * s + gapx
    # align: monogram vertical center (mid ~ (0+788)/2=394) maps to wordmark mid-cap ~ 708*0.54
    mono_cy = (MONO_Y0 + MONO_Y1) / 2
    wm_cy = 708 * 0.52
    mono_ty = wm_cy - mono_cy * s
    total_w = wm_x + kozy_w
    x0 = -20; y_top = 790 * s + mono_ty + 20 if False else 708 + 230
    # simpler: compute real bbox
    y_top = mono_ty + MONO_Y1 * s
    y_bot = min(-92 - DESC_SIZE - 30, mono_ty + MONO_Y0 * s)
    head, tail = svg_header(x0, y_top, total_w - x0 + 20, y_top - y_bot)
    g = [
        head,
        '<g transform="scale(1,-1)">',
        f'  <g transform="translate({mono_x - MONO_X0 * s:.1f},{mono_ty:.1f}) scale({s:.5f})">',
        monogram_group(fill),
        '  </g>',
        f'  <g transform="translate({wm_x:.1f},0)">',
        kozy,
        desc,
        '  </g>',
        '</g>',
        tail,
    ]
    return "\n".join(g)

# ---------------- write files ----------------
variants = {
    "gold": GOLD,
    "navy": NAVY,
    "white": WHITE,
}
for name, color in variants.items():
    with open(os.path.join(OUT, f"kozy-icon-{name}.svg"), "w") as f:
        f.write(icon_svg(color))
    with open(os.path.join(OUT, f"kozy-logo-stacked-{name}.svg"), "w") as f:
        f.write(stacked_svg(color))
    with open(os.path.join(OUT, f"kozy-logo-horizontal-{name}.svg"), "w") as f:
        f.write(horizontal_svg(color))

# contact sheet for VLM review
def read_svg(name, height=None):
    s = open(os.path.join(OUT, name)).read()
    if height:
        s = s.replace("<svg ", f'<svg style="height:{height}px" ', 1)
    return s

sheet = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  body {{ margin:0; padding:40px; background:#0A192F; }}
  .row {{ display:flex; flex-wrap:wrap; gap:56px; align-items:center; justify-content:center; }}
</style></head><body>
  <div class="row">
    <div>{read_svg('kozy-logo-stacked-gold.svg', 520)}</div>
    <div>{read_svg('kozy-logo-horizontal-gold.svg', 300)}</div>
    <div>{read_svg('kozy-icon-gold.svg', 200)}</div>
  </div>
</body></html>"""
with open("/home/z/my-project/work/kozy-brand/logo-contact-sheet.html", "w") as f:
    f.write(sheet)

print("✓ SVGs written to", OUT)
for fn in sorted(os.listdir(OUT)):
    if fn.endswith(".svg"):
        print("  -", fn)
