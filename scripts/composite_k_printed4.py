#!/usr/bin/env python3
"""Phase 18 v4: print the brand K — physically calibrated for this image.
Panel measurements: fabric RGB (28,39,68), luminance ~38.8, essentially flat
lighting (std 0.22). Gold pigment ink under this light: luminance ~100
(2.6x fabric) = antique gold (127, 97, 49).
Realism stack:
  - ink pooling at stencil edges (inner rim darkening, classic screen-print tell)
  - visible tight synthetic weave INSIDE the ink (amp 4, period 3px)
  - weave 'chews' the print edge (coverage modulated by weave in transition zone)
  - ink mottling, photo grain, faint bleed halo
"""
from PIL import Image, ImageFilter, ImageOps
import numpy as np
import math

DIR = '/home/z/my-project/work/image-rev5'
BASE = f'{DIR}/carrier-v4-fix1.png'
K_SRC = '/home/z/my-project/work/image-rev4/brand-k-alpha.png'
OUT = f'{DIR}/carrier-k-printed4.png'

# ---- tunables ----------------------------------------------------------
K_WIDTH = 190
Y_CENTER = 585
LEAN_DEG = 4.5
TAPER = 0.954
INK = np.array([127.0, 97.0, 49.0])
GRADIENT = 0.03
WEAVE_PERIOD = 3.0
WEAVE_AMP = 4.0
WEAVE_ANGLE = 18.0
COVERAGE = 0.95
MOTTLE_AMP = 0.06
GRAIN_SIGMA = 1.6
EDGE_BLUR = 1.0
HALO_ALPHA = 0.06
RIM_DARKEN = 0.20
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
k_big = k.resize((K_WIDTH * ss, kh * ss), Image.LANCZOS)
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
ph, pw = alpha.shape

# ---- weave field --------------------------------------------------------
yy, xx = np.mgrid[0:ph, 0:pw].astype(np.float32)
ang = math.radians(WEAVE_ANGLE)
u = xx * math.cos(ang) + yy * math.sin(ang)
v = -xx * math.sin(ang) + yy * math.cos(ang)
weave = (np.sin(u * 2 * math.pi / WEAVE_PERIOD) * 0.55 +
         np.sin(v * 2 * math.pi / WEAVE_PERIOD) * 0.45)
weave_unit = weave / 1.0  # [-1, 1]

# ---- coverage: soft edge chewed by the weave ---------------------------
cov = np.clip(alpha * COVERAGE, 0, 1)
cov_img = Image.fromarray((cov * 255).astype(np.uint8)).filter(
    ImageFilter.GaussianBlur(EDGE_BLUR))
cov = np.asarray(cov_img).astype(np.float32) / 255.0
# in the transition zone, threads alternately take/not-take ink
transition = np.clip(1.0 - np.abs(alpha - 0.5) * 2.0, 0, 1)  # 1 at edge midpoint
cov = np.clip(cov * (1.0 - 0.35 * transition * np.clip(weave_unit, 0, 1)), 0, 1)

# ---- ink layer ----------------------------------------------------------
gx = xx / max(pw - 1, 1) - 0.5
gy = 0.5 - yy / max(ph - 1, 1)
grad = np.clip(1.0 + GRADIENT * 2.0 * (gx + gy), 1 - GRADIENT, 1 + GRADIENT)

rng = np.random.default_rng(18)
mottle = np.asarray(
    Image.fromarray((rng.random((ph // 10 + 2, pw // 10 + 2)) * 255).astype(np.uint8))
    .filter(ImageFilter.GaussianBlur(4)).resize((pw, ph), Image.BILINEAR)
).astype(np.float32) / 255.0
mottle_f = 1.0 + MOTTLE_AMP * (mottle - 0.5)

# ink pooling: darker rim just inside the stencil edge
alpha_img = Image.fromarray((alpha * 255).astype(np.uint8))
eroded = alpha_img.filter(ImageFilter.MinFilter(5))
eroded_np = np.asarray(eroded).astype(np.float32) / 255.0
rim = np.clip(alpha - eroded_np, 0, 1)
pool = 1.0 - RIM_DARKEN * rim

ink = INK[None, None, :] * grad[..., None] * mottle_f[..., None] * pool[..., None]
ink += (weave * WEAVE_AMP)[..., None] * np.array([1.0, 0.9, 0.7])[None, None, :]
ink = np.clip(ink, 0, 255)

grain = rng.normal(0, GRAIN_SIGMA, ink.shape)
ink = np.clip(ink + grain * (alpha[..., None] > 0.05), 0, 255)

# ---- composite ----------------------------------------------------------
x0, y0 = int(minx), int(miny)
out = a.copy()
sub = out[y0:y0 + ph, x0:x0 + pw]
c = cov[..., None]
out[y0:y0 + ph, x0:x0 + pw] = sub * (1 - c) + ink * c

# faint bleed halo outside
halo = alpha_img.filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.GaussianBlur(2.2))
halo_np = np.asarray(halo).astype(np.float32) / 255.0
halo_only = np.clip(halo_np - alpha, 0, 1) * HALO_ALPHA
sub2 = out[y0:y0 + ph, x0:x0 + pw]
out[y0:y0 + ph, x0:x0 + pw] = sub2 * (1 - halo_only[..., None]) + INK * 0.6 * halo_only[..., None]

Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(OUT)
print('saved', OUT)

dbg = Image.open(BASE).crop((220, 340, 860, 864))
comp = Image.open(OUT).crop((220, 340, 860, 864))
pair = Image.new('RGB', (dbg.width, dbg.height * 2 + 8), (255, 255, 255))
pair.paste(dbg, (0, 0)); pair.paste(comp, (0, dbg.height + 8))
pair.save(f'{DIR}/k-composite-debug4.png')
# zoom of just the K at 2x for detail QA
kzoom = Image.open(OUT).crop((x0 - 30, y0 - 30, x0 + pw + 30, y0 + ph + 30))
kzoom = kzoom.resize((kzoom.width * 2, kzoom.height * 2), Image.LANCZOS)
kzoom.save(f'{DIR}/k-zoom4.png')
print('saved k-composite-debug4.png, k-zoom4.png')
