#!/usr/bin/env python3
"""
Kozy logo v3 — INLINE WORDMARK (owner revision):
The approved stylized K (Playfair Bold K + Hook A hanger wire — UNCHANGED) is
now the FIRST LETTER of the brand name:  [K]OZY   — kills the 'K KOZY' double-K.

Lockups
  primary    — [K]OZY + PREMIUM DRY CLEANING, airy formal rhythm (hero / print)
  horizontal — same lockup, tight compact rhythm (navbar / flyer / email)
  icon       — the stylized K alone (unchanged, approved)

Colorways: default = gold; -navy; -white.  (all flat, print-safe)

This run ALSO renders an A/B weight study for OZY (SemiBold vs Bold) so the
VLM gate can pick the weight that best matches the inline Bold K.
"""
import os
from fontTools import ttLib
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen

FONTS = "/home/z/my-project/work/kozy-brand/fonts/static"
OUT   = "/home/z/my-project/download/kozy-brand/logo"
WORK  = "/home/z/my-project/work/kozy-brand"
RENDER = os.path.join(WORK, "render")
PNG   = os.path.join(OUT, "png")
os.makedirs(RENDER, exist_ok=True)
os.makedirs(PNG, exist_ok=True)

GOLD, NAVY, WHITE = "#D4AF37", "#0A192F", "#FFFFFF"

def load(name): return ttLib.TTFont(os.path.join(FONTS, name))
def glyph_path(font, ch):
    gs = font.getGlyphSet(); pen = SVGPathPen(gs)
    gs[font.getBestCmap()[ord(ch)]].draw(pen); return pen.getCommands()
def advance(font, ch): return font["hmtx"][font.getBestCmap()[ord(ch)]][0]
def ink_bounds(font, ch):
    gs = font.getGlyphSet(); bp = BoundsPen(gs)
    gs[font.getBestCmap()[ord(ch)]].draw(bp)
    return bp.bounds  # (x0, y0, x1, y1)

pf_bold = load("PlayfairDisplay-Bold.ttf")
pf_semi = load("PlayfairDisplay-SemiBold.ttf")
marc    = load("Marcellus-Regular.ttf")
UPM = pf_bold["head"].unitsPerEm
CAP = 708.0

# ---------- approved K monogram (unchanged — owner likes it) ----------
WIRE_W = 22.0
SERIF_BALL = (95, 704, 11.5)
HOOK_ANCHORS = [(95, 704), (180, 738), (330, 753), (480, 752), (600, 748),
                (655, 750), (700, 756), (733, 767), (748, 753), (743, 741)]
TIP_BALL = (743, 741, 12.0)
HOOK_RIGHT = TIP_BALL[0] + TIP_BALL[2]                    # 755
WIRE_TOP   = max(a[1] for a in HOOK_ANCHORS) + WIRE_W / 2 # ~778

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

def monogram_group(fill):
    parts = [f'<path d="{glyph_path(pf_bold, "K")}" fill="{fill}"/>']
    parts.append(f'<path d="{cr_path(HOOK_ANCHORS)}" fill="none" stroke="{fill}" '
                 f'stroke-width="{WIRE_W}" stroke-linecap="round"/>')
    bx, by, br = SERIF_BALL
    parts.append(f'<circle cx="{bx}" cy="{by}" r="{br}" fill="{fill}"/>')
    tx, ty, tr = TIP_BALL
    parts.append(f'<circle cx="{tx}" cy="{ty}" r="{tr}" fill="{fill}"/>')
    return "\n    ".join(parts)

# ---------- measurements ----------
K_ADV = advance(pf_bold, "K")
K_B   = ink_bounds(pf_bold, "K")
print(f"UPM={UPM}  K bold: adv={K_ADV}  ink x {K_B[0]:.0f}..{K_B[2]:.0f}  "
      f"y {K_B[1]:.0f}..{K_B[3]:.0f}  hook right={HOOK_RIGHT:.0f}  "
      f"wire top={WIRE_TOP:.0f}")

TRACK = 0.145 * UPM  # approved wordmark tracking
# The hook flourish extends ~41 units past the K's advance (714 -> 755),
# so the K-O pair needs extra air beyond the uniform tracking (VLM fix).
K_O_EXTRA = 55.0

def wordmark(font):
    """[K]+OZY on one baseline. Returns (ozy_letters_with_pos, diagnostics)."""
    pos, x = [], K_ADV + TRACK + K_O_EXTRA
    for ch in "OZY":
        pos.append((ch, x))
        x += advance(font, ch) + TRACK
    # visual gap diagnostics
    diags, prev_r = [], max(K_B[2], HOOK_RIGHT)
    for i, (ch, xp) in enumerate(pos):
        b = ink_bounds(font, ch)
        left = xp + b[0]
        diags.append((("K" if i == 0 else pos[i-1][0]) + "-" + ch, left - prev_r))
        prev_r = xp + b[2]
    return pos, diags

for label, fnt in (("SemiBold", pf_semi), ("Bold", pf_bold)):
    pos, dg = wordmark(fnt)
    gaps = "  ".join(f"{p}:{g:.0f}" for p, g in dg)
    yr = pos[-1][1] + ink_bounds(fnt, "Y")[2]
    print(f"OZY {label}: gaps {gaps}  wordmark ink right={yr:.0f}")

# ---------- descriptor (PREMIUM DRY CLEANING, Marcellus, justified) ----------
DESC_TEXT = "PREMIUM DRY CLEANING"
DESC_TRACK = 0.30
def desc_layout():
    dtr = DESC_TRACK * marc["head"].unitsPerEm
    items, x = [], 0.0
    for i, ch in enumerate(DESC_TEXT):
        if ch != " ":
            items.append((ch, x))
        x += advance(marc, ch)
        if i < len(DESC_TEXT) - 1:
            x += dtr
    first_b = ink_bounds(marc, items[0][0])
    last_b  = ink_bounds(marc, items[-1][0])
    ink_w = (items[-1][1] + last_b[2]) - first_b[0]
    return items, first_b[0], ink_w
DESC_ITEMS, DESC_L0, DESC_INK_W = desc_layout()
print(f"descriptor ink width @1x = {DESC_INK_W:.0f}")

# ---------- SVG assembly ----------
def svg_doc(inner, x0, y_top, w, h):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0:.0f} {-y_top:.0f} '
            f'{w:.0f} {h:.0f}">{inner}</svg>')

def lockup_svg(fill, font, gap_ratio):
    pos, _ = wordmark(font)
    wm_l = K_B[0]
    wm_r = pos[-1][1] + ink_bounds(font, "Y")[2]
    s = (wm_r - wm_l) / DESC_INK_W
    # Marcellus cap ~1450/2048
    desc_cap = 1450.0 / marc["head"].unitsPerEm * marc["head"].unitsPerEm
    desc_cap = 1450.0 * s / 1.0 * (marc["head"].unitsPerEm / marc["head"].unitsPerEm)
    desc_cap = 1450.0 * s  # in KOZY units (matches old build's 1450*DESC_SCALE)
    gap = gap_ratio * desc_cap
    desc_y = -(gap + desc_cap)
    dx_off = wm_l - DESC_L0 * s
    ozy = "\n    ".join(
        f'<g transform="translate({x:.1f},0)"><path d="{glyph_path(font, ch)}" '
        f'fill="{fill}"/></g>' for ch, x in pos)
    desc = "\n    ".join(
        f'<g transform="translate({dx_off + x * s:.1f},{desc_y:.1f}) '
        f'scale({s:.6f})"><path d="{glyph_path(marc, ch)}" fill="{fill}"/></g>'
        for ch, x in DESC_ITEMS)
    pad = 30.0
    x0, x1 = wm_l - pad, wm_r + pad
    y_top = WIRE_TOP + pad
    y_bot = min(desc_y, K_B[1]) - pad
    inner = (f'<g transform="scale(1,-1)">\n  {monogram_group(fill)}\n'
             f'  {ozy}\n  {desc}\n</g>')
    return svg_doc(inner, x0, y_top, x1 - x0, y_top - y_bot), (wm_r - wm_l)

def icon_svg(fill):
    # unchanged approved icon framing (tight square around the K)
    MX0, MX1, MY0, MY1 = 24.0, 770.0, -10.0, 790.0
    pad = 0.06 * (MY1 - MY0)
    cx = (MX0 + MX1) / 2
    x0 = cx - (MX1 - MX0) / 2 - pad
    x1 = x0 + (MX1 - MX0) + 2 * pad
    y0 = (MY0 + MY1) / 2 - (MY1 - MY0) / 2 - pad
    y1 = y0 + (MY1 - MY0) + 2 * pad
    inner = f'<g transform="scale(1,-1)">\n    {monogram_group(fill)}\n  </g>'
    return svg_doc(inner, x0, y1, x1 - x0, y1 - y0)

# VLM A/B study verdict: Bold OZY matches the Bold K (Variant B)
OZY_WEIGHT = os.environ.get("KOZY_OZY_WEIGHT", "bold")
FONT = pf_semi if OZY_WEIGHT == "semibold" else pf_bold

PRIMARY_GAP  = 0.94   # airy (approved rhythm)
HORIZONTAL_GAP = 0.62  # compact

COLORS = {"": GOLD, "-navy": NAVY, "-white": WHITE}

FILES = {
    "kozy-logo-primary":    lambda c: lockup_svg(c, FONT, PRIMARY_GAP)[0],
    "kozy-logo-horizontal": lambda c: lockup_svg(c, FONT, HORIZONTAL_GAP)[0],
    "kozy-icon":            icon_svg,
}
for base, fn in FILES.items():
    for suffix, color in COLORS.items():
        p = os.path.join(OUT, f"{base}{suffix}.svg")
        with open(p, "w") as f:
            f.write(fn(color))
        print("✓", os.path.basename(p))

# remove stale v1 double-K assets so nobody prints the old lockup by mistake
for stale in ("kozy-logo-horizontal-gold.svg", "kozy-icon-gold.svg"):
    p = os.path.join(OUT, stale)
    if os.path.exists(p):
        os.remove(p)
        print("removed stale v1 asset:", stale)

# ---------- render pages (width-sized for PNG export) ----------
def asset_page(svg, width_px, bg=None):
    style = f"margin:0;padding:0;{'background:' + bg + ';' if bg else ''}"
    svg_sized = svg.replace("<svg ", f'<svg style="width:{width_px}px;display:block" ', 1)
    return (f'<!DOCTYPE html><html><head><meta charset="utf-8"><style>'
            f'#asset {{ display:inline-block; line-height:0; }}</style></head>'
            f'<body style="{style}"><div id="asset">{svg_sized}</div></body></html>')

primary_g = open(os.path.join(OUT, "kozy-logo-primary.svg")).read()
primary_n = open(os.path.join(OUT, "kozy-logo-primary-navy.svg")).read()
primary_w = open(os.path.join(OUT, "kozy-logo-primary-white.svg")).read()
horiz_g   = open(os.path.join(OUT, "kozy-logo-horizontal.svg")).read()
horiz_n   = open(os.path.join(OUT, "kozy-logo-horizontal-navy.svg")).read()
icon_g    = open(os.path.join(OUT, "kozy-icon.svg")).read()

pages = {
    "kozy-logo-primary-gold.png":     asset_page(primary_g, 3200),
    "kozy-logo-primary-navy.png":     asset_page(primary_n, 3200),
    "kozy-logo-primary-white.png":    asset_page(primary_w, 3200),
    "kozy-logo-horizontal-gold.png":  asset_page(horiz_g, 2600),
    "kozy-logo-horizontal-navy.png":  asset_page(horiz_n, 2600),
    "kozy-icon-gold.png":             asset_page(icon_g, 1024),
}
for pngf, page in pages.items():
    with open(os.path.join(RENDER, pngf.replace(".png", ".html")), "w") as f:
        f.write(page)
    print("render page:", pngf)

# print-PDF page: primary lockup centred on navy square
pdf_page = f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  html,body {{ margin:0; padding:0; background:{NAVY}; }}
  .poster {{ width:1200px; height:1200px; background:{NAVY};
            display:flex; align-items:center; justify-content:center; }}
</style></head><body><div class="poster">{primary_g.replace('<svg ', '<svg style="width:900px;display:block" ', 1)}</div></body></html>"""
with open(os.path.join(RENDER, "logo-print.html"), "w") as f:
    f.write(pdf_page)
print("✓ logo-print.html")

# ---------- contact sheet: FINAL gate (lockups + kern zoom + scale test) ----------
def embed(svg, w):
    return svg.replace("<svg ", f'<svg style="width:{w}px;display:block" ', 1)

# magnified kern check: crop the primary SVG's viewBox around hook + O shoulder
import re as _re
m = _re.search(r'viewBox="([^"]+)"', primary_g)
kern_svg = primary_g.replace(
    f'viewBox="{m.group(1)}"', 'viewBox="620 -810 620 230"', 1)

sheet = f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  body {{ margin:0; padding:44px; background:#0A192F; }}
  .ab {{ display:flex; gap:48px; align-items:flex-start; justify-content:center; }}
  .card {{ background:#0F2440; border-radius:14px; padding:36px 44px; }}
  .card.light {{ background:#F5F1E8; }}
  .tag {{ color:#D4AF37; font:600 13px Arial; letter-spacing:3px; margin-bottom:14px; }}
  .card.light .tag {{ color:#0A192F; }}
  .row {{ display:flex; gap:44px; align-items:center; justify-content:center;
          margin-top:40px; flex-wrap:wrap; }}
  .cap {{ color:#8FA3BF; font:12px Arial; letter-spacing:2px; text-align:center;
          margin-top:10px; }}
</style></head><body>
  <div class="ab">
    <div class="card"><div class="tag">PRIMARY · GOLD ON NAVY</div>{embed(primary_g, 640)}</div>
    <div class="card light"><div class="tag">PRIMARY · NAVY ON CREAM</div>{embed(primary_n, 560)}</div>
  </div>
  <div class="row">
    <div class="card" style="padding:22px 28px">
      <div class="tag">KERN CHECK · HOOK → O (MAGNIFIED)</div>{embed(kern_svg, 860)}
    </div>
  </div>
  <div class="row">
    <div>{embed(horiz_g, 460)}<div class="cap">horizontal (compact) · gold</div></div>
  </div>
  <div class="row">
    <div>{embed(icon_g, 160)}{embed(icon_g, 64)}{embed(icon_g, 32)}
      <div class="cap">icon at 160 / 64 / 32 px</div></div>
    <div class="card" style="padding:24px 30px">{embed(horiz_g, 190)}
      <div class="cap" style="margin-top:8px">horizontal at navbar size (≈190px wide)</div></div>
  </div>
</body></html>"""
with open(os.path.join(WORK, "logo-v3-sheet.html"), "w") as f:
    f.write(sheet)
print("✓ study sheet:", os.path.join(WORK, "logo-v3-sheet.html"))
