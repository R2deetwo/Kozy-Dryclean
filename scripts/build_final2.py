#!/usr/bin/env python3
"""FINAL BUILD v2: from hybrid4.
Patch 1: stem dot (proven v5 operation) - unchanged.
Patch 2 (rebuilt): leg dot removal with
  - per-row serif/dot separation (midpoint between strict-gold edges,
    so serif AA is never eaten)
  - source speck cleanup (dark outliers -> local median)
  - border-matched luminance offset."""
from PIL import Image, ImageFilter
import numpy as np
from scipy import ndimage

H4P = '/home/z/my-project/work/image-rev5/carrier-k-hybrid4.png'
OUT = '/home/z/my-project/work/image-rev5'

a = np.asarray(Image.open(H4P).convert('RGB')).astype(np.float32)
orig = a.copy()

# ============ PATCH 1: stem dot ============
X0, X1, Y0, Y1 = 442, 496, 690, 731
reg = a[Y0:Y1, X0:X1]
r, g, b = reg[..., 0], reg[..., 1], reg[..., 2]
ink = ((r - b) > 5) & (r > 50)
h, w = reg.shape[:2]
yy, xx = np.mgrid[0:h, 0:w]
ell = np.exp(-(((xx - (467 - X0)) / 24.0) ** 2 + ((yy - (717 - Y0)) / 12.0) ** 2))
ell = (ell > 0.25).astype(np.float32)
mask_base = np.maximum(ink.astype(np.float32), ell)
m = Image.fromarray((mask_base * 255).astype(np.uint8))
m = m.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(1.2))
mask = np.asarray(m).astype(np.float32) / 255.0
band = list(range(728, 740))
def mirror_tile(n):
    seq, fwd = [], True
    while len(seq) < n:
        rows = band if fwd else band[::-1]
        seq.extend(rows[:n - len(seq)])
        fwd = not fwd
    return seq
seq = mirror_tile(Y1 - Y0)
src = np.stack([a[sy, X0:X1] for sy in seq]).astype(np.float32) - 1.5
a[Y0:Y1, X0:X1] = a[Y0:Y1, X0:X1] * (1 - mask[..., None]) + src * mask[..., None]
print('patch 1 (stem dot) applied')

# ============ PATCH 2: leg dot (rebuilt) ============
LX0, LX1, LY0, LY1 = 622, 668, 644, 690
o = orig  # original pixels
ro, go, bo = o[..., 0], o[..., 1], o[..., 2]
strict_gold = (ro > 70) & (go > 55) & (ro > bo + 18)
loose_ink = (ro - bo > 8) & (ro > 55)

# dot strict-gold component (known bbox x629-657 y653-680)
dot_gold = np.zeros_like(strict_gold)
dot_gold[LY0:LY1, LX0:LX1] = strict_gold[LY0:LY1, LX0:LX1]
lbl, n = ndimage.label(dot_gold)
dot_id = None
for i in range(1, n + 1):
    ys, xs = np.where(lbl == i)
    if 625 <= xs.min() and xs.max() <= 660 and 648 <= ys.min() and ys.max() <= 684 and len(xs) > 100:
        dot_id = i
        print(f'dot component id={i}: x {xs.min()}-{xs.max()}, y {ys.min()}-{ys.max()}, px={len(xs)}')
assert dot_id
dot_strict = lbl == dot_id

# per-row cut: midpoint between serif gold right edge and dot gold left edge
h2, w2 = LY1 - LY0, LX1 - LX0
cutmap = np.full((h2, w2), np.inf)
for j in range(h2):
    y = LY0 + j
    # serif gold right edge in region (strict gold that is NOT dot)
    row_gold = strict_gold[y, LX0:LX1] & ~dot_strict[y, LX0:LX1]
    drow = dot_strict[y, LX0:LX1]
    s_right = np.where(row_gold)[0].max() if row_gold.any() else -1
    d_left = np.where(drow)[0].min() if drow.any() else w2
    if s_right >= 0 and d_left < w2:
        cut = (s_right + d_left) // 2
    elif s_right >= 0:
        cut = s_right + 3      # serif only: protect AA, no dot anyway
    else:
        cut = 0                # no serif in region: whole row eligible
    cutmap[j, :] = cut

xx2 = np.arange(w2)[None, :]
row_mask = (xx2 >= cutmap).astype(np.float32)   # eligible = right of cut
core = (loose_ink[LY0:LY1, LX0:LX1].astype(np.float32) * row_mask)
dm = Image.fromarray((core * 255).astype(np.uint8))
dm = dm.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(1.2))
dmask = np.asarray(dm).astype(np.float32) / 255.0
# never mask left of cut (serif AA) even after dilation: zero it
dmask = dmask * row_mask
print(f'dot mask strong px: {(dmask > 0.5).sum()}')

# ---- source: clean band y 694-722, speck-cleaned ----
lband = list(range(694, 723))
lseq = []
fwd = True
while len(lseq) < h2:
    rows = lband if fwd else lband[::-1]
    lseq.extend(rows[:h2 - len(lseq)])
    fwd = not fwd
lsrc = np.stack([o[sy, LX0:LX1] for sy in lseq]).astype(np.float32)

# speck cleanup: dark/bright outliers vs 3x3 median -> replace with median
med = np.stack([ndimage.median_filter(lsrc[..., c], size=3) for c in range(3)], axis=-1)
lum_s = lsrc.mean(axis=2)
lum_m = med.mean(axis=2)
speck = np.abs(lum_s - lum_m) > 6
print(f'source specks cleaned: {speck.sum()} px')
lsrc = np.where(speck[..., None], med, lsrc)

# luminance offset: match destination ring (fabric right/above of dot) vs source means
dst_ref = np.concatenate([o[655:676, 662:676].mean(axis=(0, 1)), o[644:651, 640:660].mean(axis=(0, 1))]).reshape(2, 3).mean(axis=0)
src_ref = lsrc.mean(axis=(0, 1))
offset = dst_ref - src_ref
print(f'luminance offset (RGB): {offset.round(1)}')
lsrc = lsrc + offset

a[LY0:LY1, LX0:LX1] = o[LY0:LY1, LX0:LX1] * (1 - dmask[..., None]) + lsrc * dmask[..., None]
print('patch 2 (leg dot) applied')

res = np.clip(a, 0, 255).astype(np.uint8)
Image.fromarray(res).save(f'{OUT}/carrier-k-FINAL.png')
print('saved carrier-k-FINAL.png')

# ============ VERIFICATION ============
V = res.astype(np.float32)
vg = (V[..., 0] > 70) & (V[..., 1] > 55) & (V[..., 0] > V[..., 2] + 18)
og = strict_gold

serif_zone = np.zeros_like(vg); serif_zone[655:695, 580:650] = True
lost = (og & ~vg & serif_zone).sum()
print(f'serif gold LOST: {lost} px (must be 0)')
print(f'serif gold gained: {(vg & ~og & serif_zone).sum()} px (must be 0)')

dotzone = np.zeros_like(vg); dotzone[651:684, 632:662] = True
print(f'residual strict gold in dot zone: {(vg & dotzone).sum()} px (must be 0)')

loose_v = (V[..., 0] - V[..., 2] > 15) & (V[..., 0] > 60)
# residue right of the cut (dot side) only
resid = np.zeros_like(loose_v)
for j in range(h2):
    y = LY0 + j
    cut = cutmap[j, 0]
    if np.isfinite(cut) and cut < w2:
        resid[y, int(cut) + LX0:LX1] = loose_v[y, int(cut) + LX0:LX1]
print(f'residual loose ink on dot side: {resid.sum()} px')
ys, xs = np.where(resid)
for yy_ in sorted(set(ys))[:8]:
    rowx = xs[ys == yy_]
    print(f'  y={yy_}: x {rowx.min()}-{rowx.max()} ({len(rowx)}px)')

Ln = V.mean(axis=2)
sub = Ln[648:688, 624:668]
loc = ndimage.uniform_filter(sub, size=9)
dev = sub - loc
print(f'leg zone deviations: dark<-8: {(dev < -8).sum()} | bright>+8: {(dev > 8).sum()}')
ys, xs = np.where(dev < -8)
if len(ys):
    print(f'  dark spots bbox: x {xs.min()+624}-{xs.max()+624}, y {ys.min()+648}-{ys.max()+648}')
ys, xs = np.where(dev > 8)
if len(ys):
    print(f'  bright spots bbox: x {xs.min()+624}-{xs.max()+624}, y {ys.min()+648}-{ys.max()+648}')

img = Image.fromarray(res)
img.crop((560, 600, 700, 720)).resize((560, 480), Image.LANCZOS).save(f'{OUT}/FINAL-zoom-leg.png')
img.crop((420, 640, 540, 760)).resize((480, 480), Image.LANCZOS).save(f'{OUT}/FINAL-zoom-stem.png')
img.crop((400, 450, 700, 760)).resize((900, 930), Image.LANCZOS).save(f'{OUT}/FINAL-zoom-fullK.png')
print('saved QA zooms')
