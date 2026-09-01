#!/usr/bin/env python3
"""Phase 18: composite the exact brand K onto the garment carrier so it reads
as INK PRINTED ON FABRIC, not a sticker. Key realism drivers:
  1. quad warp of the K onto the panel plane (lean + taper from edge fits)
  2. ink brightness modulated by the fabric's low-frequency fold shading
  3. weave texture showing THROUGH the ink (high-frequency modulation)
  4. fabric ghost-through (ink opacity ~0.88, not 1.0)
  5. ink-bleed halo + soft edges + print mottling + grain match
Base: carrier-v4-fix1.png (1152x864). Panel edges measured numerically:
  left(y)  = -0.054*y + 318.2 ; right(y) = -0.173*y + 881.6
"""
from PIL import Image, ImageFilter, ImageDraw
import numpy as np
import math

DIR = '/home/z/my-project/work/image-rev5'
BASE = f'{DIR}/carrier-v4-fix1.png'
K_SRC = '/home/z/my-project/work/image-rev4/brand-k-alpha.png'
OUT = f'{DIR}/carrier-k-printed.png'

# ---- tunables ----------------------------------------------------------
K_WIDTH = 190          # px, ~38% of panel width
Y_CENTER = 600         # vertical center of the K on the panel
LEAN_DEG = 4.5         # clockwise lean of the panel's vertical axis
TAPER = 0.954          # bottom_width / top_width of the panel locally
INK_OPACITY = 0.88     # fabric ghost-through
WEAVE_AMP = 0.32       # high-frequency weave modulation strength
SHADE_LO, SHADE_HI = 0.52, 1.02  # ink brightness range from fold shading
GOLD = np.array([212.0, 175.0, 55.0])  # #D4AF37 brand gold
GOLD_AMBIENT_MIX = 0.10  # mix a little navy into gold (ambient light on print)
GRAIN_SIGMA = 2.3
# ------------------------------------------------------------------------

img = Image.open(BASE).convert('RGB')
W, H = img.size
a = np.asarray(img).astype(np.float32)
navy_fabric = np.array([16.0, 27.0, 50.0])
ink_base = GOLD * (1 - GOLD_AMBIENT_MIX) + navy_fabric * GOLD_AMBIENT_MIX

# ---- destination quad on the panel ------------------------------------
def panel_left(y):  return -0.054 * y + 318.2
def panel_right(y): return -0.173 * y + 881.6

kh = int(K_WIDTH * 667 / 643)  # K aspect 643x667
y_top, y_bot = Y_CENTER - kh // 2, Y_CENTER + kh // 2
cx_top = (panel_left(y_top) + panel_right(y_top)) / 2
w_top = K_WIDTH
w_bot = K_WIDTH * TAPER
lean_shift = kh * math.tan(math.radians(LEAN_DEG))   # bottom moves LEFT (CW lean)
cx_bot = cx_top - lean_shift

quad = [
    (cx_top - w_top / 2, y_top), (cx_top + w_top / 2, y_top),          # TL, TR
    (cx_bot + w_bot / 2, y_bot), (cx_bot - w_bot / 2, y_bot),          # BR, BL
]
print('K quad:', [(round(x), round(y)) for x, y in quad], 'size', w_top, 'x', kh)

# ---- warp the K alpha into the quad -----------------------------------
k = Image.open(K_SRC).convert('RGBA')
ss = 4  # supersample for crisp AA
k_big = k.resize((K_WIDTH * ss, kh * ss), Image.LANCZOS)
kw, khh = k_big.size

def quad_to_pil_coeffs(dst_quad, w, h):
    # solve perspective: src(0..w, 0..h) -> dst quad (TL, TR, BR, BL)
    xs = [p[0] for p in dst_quad]; ys = [p[1] for p in dst_quad]
    # 8 unknowns; solve two linear systems via least squares
    A = []; bx = []; by = []
    src = [(0, 0), (w, 0), (w, h), (0, h)]
    for (u, v), (X, Y) in zip(src, dst_quad):
        A.append([u, v, 1, 0, 0, 0, -u * X, -v * X]); bx.append(X)
        A.append([0, 0, 0, u, v, 1, -u * Y, -v * Y]); by.append(Y)
    A = np.array(A, dtype=np.float64); bx = np.array(bx); by = np.array(by)
    cx_ = np.linalg.solve(A, bx); cy_ = np.linalg.solve(A, by)
    return tuple(cx_) + tuple(cy_)

# PIL PERSPECTIVE transform maps output->input; we need inverse mapping:
# for each dst pixel find src. Standard trick: compute coeffs for dst->src.
# Build the inverse: dst quad corners correspond to src corners of k_big.
dst_quad_ss = [(x * ss, y * ss) for x, y in quad]
# We'll transform a canvas the size of the bbox of the quad at ss resolution.
minx = min(p[0] for p in quad); maxx = max(p[0] for p in quad)
miny = min(p[1] for p in quad); maxy = max(p[1] for p in quad)
bw, bh = int(math.ceil(maxx - minx)) + 2, int(math.ceil(maxy - miny)) + 2
bw *= ss; bh *= ss

# inverse coeffs: map (dst-normalized) -> src. Use find_coeffs pattern.
def find_coeffs(pa, pb):
    """pa: 4 src points, pb: 4 dst points -> perspective coeffs (PIL)."""
    A = []
    for (x, y), (X, Y) in zip(pa, pb):
        A.append([x, y, 1, 0, 0, 0, -x * X, -y * X])
        A.append([0, 0, 0, x, y, 1, -x * Y, -y * Y])
    A = np.array(A, dtype=np.float64)
    B = np.array([c for p in pb for c in p], dtype=np.float64)
    res = np.linalg.solve(A, B)
    return tuple(res)

src_pts = [(0, 0), (kw, 0), (kw, khh), (0, khh)]
# dst quad in canvas coords (scaled by ss, offset by bbox min)
dst_pts = [((p[0] - minx) * ss, (p[1] - miny) * ss) for p in quad]
coeffs = find_coeffs(src_pts, dst_pts)

canvas = Image.new('L', (bw, bh), 0)
alpha_big = k_big.split()[3]
warped = alpha_big.transform((bw, bh), Image.PERSPECTIVE, coeffs, resample=Image.BICUBIC)
warped = warped.resize((bw // ss, bh // ss), Image.LANCZOS)
warped.save(f'{DIR}/k-warped-alpha.png')

# ---- fabric maps under the K ------------------------------------------
x0, y0 = int(minx), int(miny)
pw, ph = warped.size
region = img.crop((x0, y0, x0 + pw, y0 + ph)).convert('L')
reg_np = np.asarray(region).astype(np.float32)
low = np.asarray(region.filter(ImageFilter.GaussianBlur(21))).astype(np.float32) / 255.0
high = reg_np - np.asarray(region.filter(ImageFilter.GaussianBlur(2))).astype(np.float32)

# ---- build the ink layer ----------------------------------------------
alpha = np.asarray(warped).astype(np.float32) / 255.0

# fold shading: ink brightness follows fabric illumination
shade = SHADE_LO + (SHADE_HI - SHADE_LO) * low
# weave through: ink responds to fabric's high-frequency texture
weave = np.clip(1.0 + WEAVE_AMP * high / 60.0, 0.55, 1.45)
ink_rgb = ink_base[None, None, :] * shade[..., None] * weave[..., None]
ink_rgb = np.clip(ink_rgb, 0, 255)

# print mottling (uneven ink density)
rng = np.random.default_rng(18)
mottle = np.asarray(
    Image.fromarray((rng.random((ph // 8 + 2, pw // 8 + 2)) * 255).astype(np.uint8))
    .filter(ImageFilter.GaussianBlur(3)).resize((pw, ph), Image.BILINEAR)
).astype(np.float32) / 255.0
density = 0.86 + 0.14 * mottle

# final coverage: alpha * density * global opacity, then ink-bleed softening
cov = np.clip(alpha * density * INK_OPACITY, 0, 1)
cov_img = Image.fromarray((cov * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))
cov = np.asarray(cov_img).astype(np.float32) / 255.0

# grain match
grain = rng.normal(0, GRAIN_SIGMA, ink_rgb.shape)
ink_rgb = np.clip(ink_rgb + grain * (cov[..., None] > 0.05), 0, 255)

# ---- composite into the base ------------------------------------------
out = a.copy()
sub = out[y0:y0 + ph, x0:x0 + pw]
c = cov[..., None]
new_sub = sub * (1 - c) + ink_rgb * c
out[y0:y0 + ph, x0:x0 + pw] = new_sub

# ---- ink-bleed halo (very subtle dark-gold rim around the print) ------
halo_src = Image.fromarray((alpha * 255).astype(np.uint8))
halo = halo_src.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(2.0))
halo_np = np.asarray(halo).astype(np.float32) / 255.0
halo_only = np.clip(halo_np - alpha, 0, 1) * 0.10  # faint rim
sub2 = out[y0:y0 + ph, x0:x0 + pw]
tint = ink_base * 0.55  # darker gold tint
out[y0:y0 + ph, x0:x0 + pw] = sub2 * (1 - halo_only[..., None]) + tint * halo_only[..., None]

Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(OUT)
print('saved', OUT)

# side-by-side debug crop for QA
dbg = Image.open(BASE).crop((220, 340, 860, 864))
comp = Image.open(OUT).crop((220, 340, 860, 864))
pair = Image.new('RGB', (dbg.width, dbg.height * 2 + 8), (255, 255, 255))
pair.paste(dbg, (0, 0)); pair.paste(comp, (0, dbg.height + 8))
pair.save(f'{DIR}/k-composite-debug.png')
print('saved k-composite-debug.png (top=before, bottom=after)')
