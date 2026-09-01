#!/usr/bin/env python3
"""
Kozy logo v2 — applies full CD critique round 1:
  - wire weight 15 -> 22 (harmonize with K stem)
  - arc raised, >= 2x wire clearance above the arm, NO contact ("aristocratic distance")
  - hook: 3 variants (A tight jewel / B extended fluid / C minimal line)
  - Catmull-Rom beziers => mathematically smooth, no flat spots
  - serif ball merged into serif bracket (jeweled finial), confident tip balls
  - descriptor: Marcellus (Trajan-like) tracked 0.30em, width-justified to KOZY
"""
import os
from fontTools import ttLib
from fontTools.pens.svgPathPen import SVGPathPen

FONTS = "/home/z/my-project/work/kozy-brand/fonts/static"
OUT = "/home/z/my-project/download/kozy-brand/logo"
WORK = "/home/z/my-project/work/kozy-brand"
os.makedirs(OUT, exist_ok=True)

GOLD, NAVY, WHITE = "#D4AF37", "#0A192F", "#FFFFFF"

def load(name):
    return ttLib.TTFont(os.path.join(FONTS, name))

def glyph_path(font, ch):
    gs = font.getGlyphSet()
    pen = SVGPathPen(gs)
    gs[font.getBestCmap()[ord(ch)]].draw(pen)
    return pen.getCommands()

def advance(font, ch):
    return font["hmtx"][font.getBestCmap()[ord(ch)]][0]

def text_paths(font, text, tracking_em):
    upm = font["head"].unitsPerEm
    items, x = [], 0.0
    tr = tracking_em * upm
    for i, ch in enumerate(text):
        if ch != " ":
            items.append((glyph_path(font, ch), x))
        x += advance(font, ch)
        if i < len(text) - 1:
            x += tr
    return items, x - tr

# ---------- fonts ----------
pf_bold = load("PlayfairDisplay-Bold.ttf")
pf_semi = load("PlayfairDisplay-SemiBold.ttf")
marc = load("Marcellus-Regular.ttf")
CAP = 708.0

K_PATH = glyph_path(pf_bold, "K")

# ---------- smooth spline engine ----------
def cr_path(points, k=1.0):
    """Catmull-Rom through points -> SVG path string. C1-smooth."""
    P = [points[0]] + list(points) + [points[-1]]
    d = f"M {points[0][0]:.1f},{points[0][1]:.1f}"
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i-1], P[i], P[i+1], P[i+2]
        c1 = (p1[0] + (p2[0]-p0[0])/6.0*k, p1[1] + (p2[1]-p0[1])/6.0*k)
        c2 = (p2[0] - (p3[0]-p1[0])/6.0*k, p2[1] - (p3[1]-p1[1])/6.0*k)
        d += (f" C {c1[0]:.1f},{c1[1]:.1f} {c2[0]:.1f},{c2[1]:.1f} "
              f"{p2[0]:.1f},{p2[1]:.1f}")
    return d

# ---------- hanger wire variants (font units, y-up) ----------
WIRE_W = 22.0
SERIF_BALL = (95, 704, 11.5)   # x, y, r — jeweled finial merged into serif top

ARC = [(95, 704), (180, 738), (330, 753), (480, 752), (600, 748)]

HOOKS = {
    "A": {  # tight & jewel-like
        "anchors": ARC + [(655, 750), (700, 756), (735, 766), (749, 753), (745, 742)],
        "tip_ball": (745, 742, 12.5),
    },
    "B": {  # extended & fluid
        "anchors": ARC + [(660, 751), (710, 762), (760, 778), (782, 758), (770, 738), (742, 734)],
        "tip_ball": (742, 734, 11.5),
    },
    "C": {  # minimalist line
        "anchors": ARC + [(650, 749), (695, 756), (728, 765), (740, 750), (732, 739)],
        "tip_ball": None,  # round cap only
    },
}

def monogram_group(fill, hook_key="A"):
    h = HOOKS[hook_key]
    wire_d = cr_path(h["anchors"])
    parts = [f'<path d="{K_PATH}" fill="{fill}"/>']
    parts.append(f'<path d="{wire_d}" fill="none" stroke="{fill}" '
                 f'stroke-width="{WIRE_W}" stroke-linecap="round"/>')
    bx, by, br = SERIF_BALL
    parts.append(f'<circle cx="{bx}" cy="{by}" r="{br}" fill="{fill}"/>')
    if h["tip_ball"]:
        tx, ty, tr = h["tip_ball"]
        parts.append(f'<circle cx="{tx}" cy="{ty}" r="{tr}" fill="{fill}"/>')
    return "\n    ".join(parts)

# ---------- wordmark ----------
KOZY_TRACK = 0.145
kozy_items, kozy_w = text_paths(pf_semi, "KOZY", KOZY_TRACK)
desc_text = "PREMIUM DRY CLEANING"
DESC_TRACK = 0.30
n = len(desc_text)
# descriptor: Marcellus (2048upm). Solve uniform scale so width == KOZY width.
desc_items, desc_w_font = text_paths(marc, desc_text, DESC_TRACK)
DESC_SCALE = kozy_w / desc_w_font  # multiplies Marcellus units -> KOZY units
print(f"KOZY width {kozy_w:.0f} | desc scale {DESC_SCALE:.4f} "
      f"| desc width {desc_w_font * DESC_SCALE:.0f} (target {kozy_w:.0f})")

def wordmark_groups(fill):
    kozy = "\n    ".join(
        f'<g transform="translate({x:.1f},0)"><path d="{d}" fill="{fill}"/></g>'
        for d, x in kozy_items)
    desc_y = -95 - 170  # baseline of descriptor (KOZY units)
    desc = "\n    ".join(
        f'<g transform="translate({x * DESC_SCALE:.1f},{desc_y}) scale({DESC_SCALE:.6f})">'
        f'<path d="{d}" fill="{fill}"/></g>'
        for d, x in desc_items)
    return kozy, desc

MONO_X0, MONO_X1, MONO_Y0, MONO_Y1 = 20, 800, -12, 805

def svg_doc(inner, x0, y_top, w, h):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0:.0f} {-y_top:.0f} '
            f'{w:.0f} {h:.0f}">{inner}</svg>')

def stacked_svg(fill, hook="A"):
    kozy, desc = wordmark_groups(fill)
    gap = 118
    mono_dy = gap + 710
    mono_cx_offset = (kozy_w - (MONO_X1 - MONO_X0)) / 2 - MONO_X0
    x0 = min(MONO_X0 + mono_cx_offset, 0) - 15
    x1 = max(MONO_X1 + mono_cx_offset, kozy_w) + 15
    y_top = mono_dy + MONO_Y1
    y_bot = -95 - 170 - 34
    inner = (
        f'<g transform="scale(1,-1)">\n'
        f'  <g transform="translate({mono_cx_offset:.1f},{mono_dy})">\n'
        f'    {monogram_group(fill, hook)}\n'
        f'  </g>\n'
        f'  {kozy}\n  {desc}\n'
        f'</g>')
    return svg_doc(inner, x0, y_top, x1 - x0, y_top - y_bot)

def horizontal_svg(fill, hook="A"):
    kozy, desc = wordmark_groups(fill)
    mono_h = MONO_Y1 - MONO_Y0
    target_h = 708 * 1.58
    s = target_h / mono_h
    gapx = 160
    wm_x = (MONO_X1 - MONO_X0) * s + gapx
    mono_cy = (MONO_Y0 + MONO_Y1) / 2
    mono_ty = 708 * 0.52 - mono_cy * s
    total_w = wm_x + kozy_w
    y_top = max(mono_ty + MONO_Y1 * s, 708 + 40)
    y_bot = min(-95 - 170 - 34, mono_ty + MONO_Y0 * s)
    inner = (
        f'<g transform="scale(1,-1)">\n'
        f'  <g transform="translate({-MONO_X0 * s:.1f},{mono_ty:.1f}) scale({s:.5f})">\n'
        f'    {monogram_group(fill, hook)}\n'
        f'  </g>\n'
        f'  <g transform="translate({wm_x:.1f},0)">\n{kozy}\n{desc}\n  </g>\n'
        f'</g>')
    return svg_doc(inner, -15, y_top, total_w + 30, y_top - y_bot)

def icon_svg(fill, hook="A"):
    pad = 0.06 * (MONO_Y1 - MONO_Y0)
    x0, x1 = MONO_X0 - pad, MONO_X1 + pad
    y0, y1 = MONO_Y0 - pad, MONO_Y1 + pad
    inner = f'<g transform="scale(1,-1)">\n    {monogram_group(fill, hook)}\n  </g>'
    return svg_doc(inner, x0, y1, x1 - x0, y1 - y0)

# ---------- write comparison sheet (hook variants) ----------
rows = []
for key in "ABC":
    rows.append(f'<div class="cell"><div class="lbl">HOOK {key}</div>'
                f'{stacked_svg(GOLD, key).replace("<svg ", "<svg style=\"height:430px\" ", 1)}</div>')
sheet = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  body {{ margin:0; padding:36px; background:#0A192F; }}
  .row {{ display:flex; flex-wrap:wrap; gap:44px; align-items:flex-start; justify-content:center; }}
  .cell {{ text-align:center; }}
  .lbl {{ color:#D4AF37; font-family:Georgia,serif; font-size:15px; letter-spacing:3px; margin-bottom:14px; }}
</style></head><body>
  <div class="row">{''.join(rows)}</div>
</body></html>"""
with open(os.path.join(WORK, "logo-variants-v2.html"), "w") as f:
    f.write(sheet)
print("✓ variants sheet written")
