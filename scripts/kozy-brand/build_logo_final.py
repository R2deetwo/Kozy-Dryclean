#!/usr/bin/env python3
"""
Kozy logo FINAL build — Hook A (winner, 9.5/10) + CD polish:
  - optical centering nudge (+16 units right; hook mass sits right)
  - tip ball diameter ~ wire width (jewel, not lollipop)
  - descriptor gap = 0.94x descriptor cap height (measured from Marcellus 'P')
  - tight bounds; full asset set: SVGs, render pages, app icon, contact sheet
"""
import os
from fontTools import ttLib
from fontTools.pens.svgPathPen import SVGPathPen

FONTS = "/home/z/my-project/work/kozy-brand/fonts/static"
OUT = "/home/z/my-project/download/kozy-brand/logo"
WORK = "/home/z/my-project/work/kozy-brand"
PNG = os.path.join(OUT, "png")
os.makedirs(PNG, exist_ok=True)
os.makedirs(os.path.join(WORK, "render"), exist_ok=True)

GOLD, NAVY, WHITE = "#D4AF37", "#0A192F", "#FFFFFF"

def load(name): return ttLib.TTFont(os.path.join(FONTS, name))
def glyph_path(font, ch):
    gs = font.getGlyphSet(); pen = SVGPathPen(gs)
    gs[font.getBestCmap()[ord(ch)]].draw(pen); return pen.getCommands()
def advance(font, ch): return font["hmtx"][font.getBestCmap()[ord(ch)]][0]
def text_paths(font, text, tracking_em):
    upm = font["head"].unitsPerEm
    items, x = [], 0.0
    tr = tracking_em * upm
    for i, ch in enumerate(text):
        if ch != " ": items.append((glyph_path(font, ch), x))
        x += advance(font, ch)
        if i < len(text) - 1: x += tr
    return items, x - tr

pf_bold = load("PlayfairDisplay-Bold.ttf")
pf_semi = load("PlayfairDisplay-SemiBold.ttf")
marc = load("Marcellus-Regular.ttf")
CAP = 708.0
K_PATH = glyph_path(pf_bold, "K")

def cr_path(points, k=1.0):
    P = [points[0]] + list(points) + [points[-1]]
    d = f"M {points[0][0]:.1f},{points[0][1]:.1f}"
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i-1], P[i], P[i+1], P[i+2]
        c1 = (p1[0] + (p2[0]-p0[0])/6.0*k, p1[1] + (p2[1]-p0[1])/6.0*k)
        c2 = (p2[0] - (p3[0]-p1[0])/6.0*k, p2[1] - (p3[1]-p1[1])/6.0*k)
        d += (f" C {c1[0]:.1f},{c1[1]:.1f} {c2[0]:.1f},{c2[1]:.1f} "
              f"{p2[0]:.1f},{p2[1]:.1f}")
    return d

# ---------- Hook A (refined jewel curl) ----------
WIRE_W = 22.0
OPTICAL = 16.0
SERIF_BALL = (95, 704, 11.5)
HOOK_ANCHORS = [(95, 704), (180, 738), (330, 753), (480, 752), (600, 748),
                (655, 750), (700, 756), (733, 767), (748, 753), (743, 741)]
TIP_BALL = (743, 741, 12.0)

def monogram_group(fill):
    parts = [f'<path d="{K_PATH}" fill="{fill}"/>']
    parts.append(f'<path d="{cr_path(HOOK_ANCHORS)}" fill="none" stroke="{fill}" '
                 f'stroke-width="{WIRE_W}" stroke-linecap="round"/>')
    bx, by, br = SERIF_BALL
    parts.append(f'<circle cx="{bx}" cy="{by}" r="{br}" fill="{fill}"/>')
    tx, ty, tr = TIP_BALL
    parts.append(f'<circle cx="{tx}" cy="{ty}" r="{tr}" fill="{fill}"/>')
    return "\n    ".join(parts)

# ---------- wordmark ----------
KOZY_TRACK = 0.145
kozy_items, kozy_w = text_paths(pf_semi, "KOZY", KOZY_TRACK)
desc_text = "PREMIUM DRY CLEANING"
DESC_TRACK = 0.30
desc_items, desc_w_font = text_paths(marc, desc_text, DESC_TRACK)
DESC_SCALE = kozy_w / desc_w_font
DESC_CAP = 1450.0 * DESC_SCALE  # Marcellus cap height ~1450/2048 units -> KOZY units
DESC_GAP = 0.94 * DESC_CAP
DESC_Y = -(DESC_GAP + DESC_CAP)  # descriptor baseline (KOZY units)
print(f"KOZY w={kozy_w:.0f} desc scale={DESC_SCALE:.4f} cap={DESC_CAP:.0f} "
      f"gap={DESC_GAP:.0f} descY={DESC_Y:.0f}")

def wordmark_groups(fill):
    kozy = "\n    ".join(
        f'<g transform="translate({x:.1f},0)"><path d="{d}" fill="{fill}"/></g>'
        for d, x in kozy_items)
    desc = "\n    ".join(
        f'<g transform="translate({x * DESC_SCALE:.1f},{DESC_Y:.1f}) scale({DESC_SCALE:.6f})">'
        f'<path d="{d}" fill="{fill}"/></g>'
        for d, x in desc_items)
    return kozy, desc

# tight monogram content bounds (measured): x 34..760, y 0..779
MX0, MX1, MY0, MY1 = 24.0, 770.0, -10.0, 790.0

def svg_doc(inner, x0, y_top, w, h):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0:.0f} {-y_top:.0f} '
            f'{w:.0f} {h:.0f}">{inner}</svg>')

def stacked_svg(fill):
    kozy, desc = wordmark_groups(fill)
    gap = 118
    mono_dy = gap + 710
    mono_cx_offset = (kozy_w - (MX1 - MX0)) / 2 - MX0 + OPTICAL
    x0 = min(mono_cx_offset + MX0, 0) - 15
    x1 = max(mono_cx_offset + MX1, kozy_w) + 15
    y_top = mono_dy + MY1
    y_bot = DESC_Y - 30
    inner = (f'<g transform="scale(1,-1)">\n'
             f'  <g transform="translate({mono_cx_offset:.1f},{mono_dy})">\n'
             f'    {monogram_group(fill)}\n  </g>\n  {kozy}\n  {desc}\n</g>')
    return svg_doc(inner, x0, y_top, x1 - x0, y_top - y_bot)

def horizontal_svg(fill):
    kozy, desc = wordmark_groups(fill)
    s = 708.0 * 1.58 / (MY1 - MY0)
    wm_x = (MX1 - MX0) * s + 160
    mono_ty = 708 * 0.52 - (MY0 + MY1) / 2 * s
    total_w = wm_x + kozy_w
    y_top = max(mono_ty + MY1 * s, 708 + 40)
    y_bot = min(DESC_Y - 30, mono_ty + MY0 * s)
    inner = (f'<g transform="scale(1,-1)">\n'
             f'  <g transform="translate({-MX0 * s + OPTICAL * s:.1f},{mono_ty:.1f}) '
             f'scale({s:.5f})">\n    {monogram_group(fill)}\n  </g>\n'
             f'  <g transform="translate({wm_x:.1f},0)">\n{kozy}\n{desc}\n  </g>\n</g>')
    return svg_doc(inner, -15, y_top, total_w + 30, y_top - y_bot)

def icon_svg(fill):
    pad = 0.06 * (MY1 - MY0)
    cx = (MX0 + MX1) / 2 + OPTICAL
    x0 = cx - (MX1 - MX0) / 2 - pad
    x1 = x0 + (MX1 - MX0) + 2 * pad
    y0 = (MY0 + MY1) / 2 - (MY1 - MY0) / 2 - pad
    y1 = y0 + (MY1 - MY0) + 2 * pad
    inner = f'<g transform="scale(1,-1)">\n    {monogram_group(fill)}\n  </g>'
    return svg_doc(inner, x0, y1, x1 - x0, y1 - y0)

# ---------- write SVGs ----------
COLORS = {"": GOLD, "-navy": NAVY, "-white": WHITE}  # default = gold
FILES = {
    "kozy-logo-primary": stacked_svg,
    "kozy-logo-horizontal": horizontal_svg,
    "kozy-icon": icon_svg,
}
for base, fn in FILES.items():
    for suffix, color in COLORS.items():
        p = os.path.join(OUT, f"{base}{suffix}.svg")
        with open(p, "w") as f:
            f.write(fn(color))
        print("✓", os.path.basename(p))

# ---------- render pages for PNG export ----------
def asset_page(svg, height_px, bg=None):
    style = f"margin:0;padding:0;{'background:' + bg + ';' if bg else ''}"
    svg_sized = svg.replace("<svg ", f'<svg style="height:{height_px}px;display:block" ', 1)
    return (f'<!DOCTYPE html><html><head><meta charset="utf-8"><style>'
            f'#asset {{ display:inline-block; line-height:0; }}</style></head>'
            f'<body style="{style}"><div id="asset">{svg_sized}</div></body></html>')

RENDER = os.path.join(WORK, "render")
renders = [
    # (svg file, out png, height px, transparent, bg)
    ("kozy-logo-primary.svg", "kozy-logo-primary-gold.png", 1200, True, None),
    ("kozy-logo-primary-navy.svg", "kozy-logo-primary-navy.png", 1200, True, None),
    ("kozy-logo-primary-white.svg", "kozy-logo-primary-white.png", 1200, True, None),
    ("kozy-logo-horizontal.svg", "kozy-logo-horizontal-gold.png", 560, True, None),
    ("kozy-logo-horizontal-navy.svg", "kozy-logo-horizontal-navy.png", 560, True, None),
    ("kozy-icon.svg", "kozy-icon-gold.png", 1024, True, None),
    ("kozy-icon-navy.svg", "kozy-icon-navy.png", 1024, True, None),
    ("kozy-icon-white.svg", "kozy-icon-white.png", 1024, True, None),
]
for svgf, pngf, h, trans, bg in renders:
    svg = open(os.path.join(OUT, svgf)).read()
    page = asset_page(svg, h, bg)
    html_path = os.path.join(RENDER, pngf.replace(".png", ".html"))
    with open(html_path, "w") as f:
        f.write(page)
    print("render page:", os.path.basename(html_path))

# app icon (navy rounded square + gold monogram)
app_icon = f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  body {{ margin:0; padding:0; background:transparent; }}
  #asset {{ width:1024px; height:1024px; background:{NAVY};
           border-radius:22.5%; display:flex; align-items:center; justify-content:center; }}
</style></head><body><div id="asset">{icon_svg(GOLD).replace("<svg ", '<svg style="height:640px;display:block" ', 1)}</div></body></html>"""
with open(os.path.join(RENDER, "app-icon.html"), "w") as f:
    f.write(app_icon)

# print-PDF page (primary lockup on navy, print proportions)
pdf_page = f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  html,body {{ margin:0; padding:0; background:{NAVY}; }}
  .poster {{ width:1200px; height:1200px; background:{NAVY};
            display:flex; align-items:center; justify-content:center; }}
</style></head><body><div class="poster">{stacked_svg(GOLD).replace("<svg ", '<svg style="height:760px;display:block" ', 1)}</div></body></html>"""
with open(os.path.join(RENDER, "logo-print.html"), "w") as f:
    f.write(pdf_page)

# ---------- contact sheet (final QA) ----------
def embed(svg, h):
    return svg.replace("<svg ", f'<svg style="height:{h}px;display:block" ', 1)
primary = open(os.path.join(OUT, "kozy-logo-primary.svg")).read()
horiz = open(os.path.join(OUT, "kozy-logo-horizontal.svg")).read()
icon = open(os.path.join(OUT, "kozy-icon.svg")).read()
primary_n = open(os.path.join(OUT, "kozy-logo-primary-navy.svg")).read()
sheet = f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  body {{ margin:0; padding:40px; background:#0A192F; }}
  .row {{ display:flex; gap:56px; align-items:center; justify-content:center; flex-wrap:wrap; }}
  .light {{ background:#F5F1E8; border-radius:14px; padding:40px 52px; }}
  .sizes svg {{ display:inline-block; margin:0 14px; vertical-align:middle; }}
  .cap {{ color:#8FA3BF; font:12px Arial; letter-spacing:2px; text-align:center; margin-top:10px; }}
</style></head><body>
  <div class="row">
    <div>{embed(primary, 560)}</div>
    <div>{embed(horiz, 330)}</div>
  </div>
  <div class="row" style="margin-top:44px">
    <div class="light">{embed(primary_n, 300)}</div>
    <div class="sizes">
      {embed(icon, 160)}{embed(icon, 64)}{embed(icon, 32)}
      <div class="cap">icon at 160 / 64 / 32 px</div>
    </div>
  </div>
</body></html>"""
with open(os.path.join(WORK, "logo-final-sheet.html"), "w") as f:
    f.write(sheet)
print("✓ final sheet:", os.path.join(WORK, "logo-final-sheet.html"))
