#!/usr/bin/env python3
"""Phase 18 v2: print the brand K on the garment carrier using LUMINANCE
TRANSFER — the standard physical model for realistic logo mockups on fabric:
  - take the fabric's own per-pixel luminance (folds, weave, directional
    lighting all preserved automatically)
  - contrast-stretch it into a gold-ink brightness range
  - recolor with the gold hue/saturation (slightly desaturated print ink)
  - composite with ink coverage (density mottling + soft bleed edges)
The print's brightness now follows the scene lighting exactly, and the weave
shows through because it IS the fabric's own luminance.
"""
from PIL import Image, ImageFilter
import numpy as np
import math

DIR = '/home/z/my-project/work/image-rev5'
BASE = f'{DIR}/carrier-v4-fix1.png'
K_SRC = '/home/z/my-project/work/image-rev4/brand-k-alpha.png'
OUT = f'{DIR}/carrier-k-printed2.png'

# ---- tunables ----------------------------------------------------------
K_WIDTH = 190
Y_CENTER = 585
LEAN_DEG = 4.5
TAPER = 0.954
L_LO, L_HI = 0.40, 0.80      # gold-ink luminance range (0..1)
SAT = 0.78                    # print ink saturation (vs pure gold)
HUE = 46.0 / 360.0            # gold hue (~#D4AF37)
COVERAGE = 0.92               # max ink coverage (fabric ghost-through)
HF_BOOST = 0.45               # extra high-frequency (weave) passthrough
GAMMA = 0.85                  # shadow opening
GRAIN_SIGMA = 2.0
# ------------------------------------------------------------------------

img = Image.open(BASE).convert('RGB')
a = np.asarray(img).astype(np.float32)

def panel_left(y):  return -0.054 * y + 318.2
def panel_right(y): return -0.173 * y + 881.6

kh = int(K_WIDTH * 667 / 643)
y_top, y_bot = Y_CENTER - kh // 2, Y_CENTER + kh // 2
cx_top = (panel_left(y_top) + panel_right(y_top)) / 2
w_bot = K_WIDTH * TAPER
lean_shift = kh * math.tan(math.radians(LEAN_DEG))
cx_bot = cx_top - lean_shift
quad = [
    (cx_top - K_WIDTH / 2, y_top), (cx_top + K_WIDTH / 2, y_top),
    (cx_bot + w_bot / 2, y_bot), (cx_bot - w_bot / 2, y_bot),
]
print('K quad:', [(round(x), round(y)) for x, y in quad])

# ---- warp K alpha -------------------------------------------------------
k = Image.open(K_SRC).convert('RGBA')
ss = 4
k_big = k.resize((K_WIDTH * ss, int(K_WIDTH * 667 / 643) * ss), Image.LANCZOS)
kw, khh = k_big.size

def find_coeffs(pa, pb):
    A = []
    for (x, y), (X, Y) in zip(pa, pb):
        A.append([x, y, 1, 0, 0, 0, -x * X, -y * X])
        A.append([0, 0, 0, x, y, 1, -x * Y, -y * Y])
    A = np.array(A, dtype=np.float64)
    B = np.array([c for p in pb for c in p], dtype=np.float64)
    return tuple(np.linalg.solve(A, B))

minx = min(p[0] for p in quad); miny = min(p[1] for p in quad)
maxx = max(p[0] for p in quad); maxy = max(p[1] for p in quad)
bw, bh = (int(math.ceil(maxx - minx)) + 2) * ss, (int(math.ceil(maxy - miny)) + 2) * ss
src_pts = [(0, 0), (kw, 0), (kw, khh), (0, khh)]
dst_pts = [((p[0] - minx) * ss, (p[1] - miny) * ss) for p in quad]
coeffs = find_coeffs(src_pts, dst_pts)
alpha_big = k_big.split()[3]
warped = alpha_big.transform((bw, bh), Image.PERSPECTIVE, coeffs, resample=Image.BICUBIC)
warped = warped.resize((bw // ss, bh // ss), Image.LANCZOS)
alpha = np.asarray(warped).astype(np.float32) / 255.0

# ---- fabric luminance under the K --------------------------------------
x0, y0 = int(minx), int(miny)
pw, ph = warped.size
region = img.crop((x0, y0, x0 + pw, y0 + ph))
reg = np.asarray(region).astype(np.float32)
lum = 0.2126 * reg[..., 0] + 0.7152 * reg[..., 1] + 0.0722 * reg[..., 2]  # Rec.709

# robust contrast stretch to [0,1]
p5, p95 = np.percentile(lum, 5), np.percentile(lum, 95)
f = np.clip((lum - p5) / max(p95 - p5, 1e-3), 0, 1) ** GAMMA

# high-frequency residual (weave) added on top of the stretched map
low = np.asarray(region.convert('L').filter(ImageFilter.GaussianBlur(3))).astype(np.float32)
hf = lum - low
f = np.clip(f + HF_BOOST * hf / 80.0, 0, 1)

print_L = L_LO + (L_HI - L_LO) * f

# ---- recolor: gold hue at print luminance ------------------------------
import colorsys
h = HUE
def hsl_to_rgb_vec(hh, ss_, ll):
    # vectorized HSL->RGB
    c = (1 - np.abs(2 * ll - 1)) * ss_
    x = c * (1 - np.abs(np.mod(hh * 6, 2) - 1))
    m = ll - c / 2
    r = np.zeros_like(c); g = np.zeros_like(c); b = np.zeros_like(c)
    cond = hh * 6 < 1; r[cond] = c[cond]; g[cond] = x[cond]
    cond = (hh * 6 >= 1) & (hh * 6 < 2); r[cond] = x[cond]; g[cond] = c[cond]
    cond = (hh * 6 >= 2) & (hh * 6 < 3); g[cond] = c[cond]; b[cond] = x[cond]
    cond = (hh * 6 >= 3) & (hh * 6 < 4); g[cond] = x[cond]; b[cond] = c[cond]
    cond = (hh * 6 >= 4) & (hh * 6 < 5); r[cond] = x[cond]; b[cond] = c[cond]
    cond = hh * 6 >= 5; r[cond] = c[cond]; b[cond] = x[cond]
    return (r + m, g + m, b + m)

pr, pg, pb = hsl_to_rgb_vec(np.full_like(print_L, h), np.full_like(print_L, SAT), print_L)
ink = np.stack([pr, pg, pb], axis=-1) * 255.0

# ---- coverage: density mottling + bleed --------------------------------
rng = np.random.default_rng(18)
mottle = np.asarray(
    Image.fromarray((rng.random((ph // 8 + 2, pw // 8 + 2)) * 255).astype(np.uint8))
    .filter(ImageFilter.GaussianBlur(3)).resize((pw, ph), Image.BILINEAR)
).astype(np.float32) / 255.0
density = 0.88 + 0.12 * mottle
cov = np.clip(alpha * density * COVERAGE, 0, 1)
cov_img = Image.fromarray((cov * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))
cov = np.asarray(cov_img).astype(np.float32) / 255.0

grain = rng.normal(0, GRAIN_SIGMA, ink.shape)
ink = np.clip(ink + grain * (cov[..., None] > 0.05), 0, 255)

# ---- composite ----------------------------------------------------------
out = a.copy()
sub = out[y0:y0 + ph, x0:x0 + pw]
c = cov[..., None]
out[y0:y0 + ph, x0:x0 + pw] = sub * (1 - c) + ink * c

# subtle ink-bleed halo
halo = Image.fromarray((alpha * 255).astype(np.uint8)).filter(
    ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(2.0))
halo_np = np.asarray(halo).astype(np.float32) / 255.0
halo_only = np.clip(halo_np - alpha, 0, 1) * 0.08
sub2 = out[y0:y0 + ph, x0:x0 + pw]
gold_dark = np.array([120.0, 95.0, 35.0])
out[y0:y0 + ph, x0:x0 + pw] = sub2 * (1 - halo_only[..., None]) + gold_dark * halo_only[..., None]

Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(OUT)
print('saved', OUT)

dbg = Image.open(BASE).crop((220, 340, 860, 864))
comp = Image.open(OUT).crop((220, 340, 860, 864))
pair = Image.new('RGB', (dbg.width, dbg.height * 2 + 8), (255, 255, 255))
pair.paste(dbg, (0, 0)); pair.paste(comp, (0, dbg.height + 8))
pair.save(f'{DIR}/k-composite-debug2.png')
print('saved k-composite-debug2.png')
