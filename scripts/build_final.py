#!/usr/bin/env python3
"""FINAL BUILD from hybrid4 (intact serif + both dots present):
1. STEM-DOT fix (same proven operation as v5/nodot6)
2. LEG-DOT correct removal (replacing phase-18's buggy patch):
   - dot separated from serif via connected components (serif protected + dilated)
   - source: clean fabric band y 694-722 (no serif AA contamination)
   - luminance offset +2 to match surrounding fabric (~48)
   - restores the serif's bitten corner automatically (base = H4)
"""
from PIL import Image, ImageFilter
import numpy as np
from scipy import ndimage

H4P = '/home/z/my-project/work/image-rev5/carrier-k-hybrid4.png'
OUT = '/home/z/my-project/work/image-rev5'

a = np.asarray(Image.open(H4P).convert('RGB')).astype(np.float32)
orig = a.copy()

# ============ PATCH 1: stem dot (proven v5 operation) ============
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

# ============ PATCH 2: leg dot correct removal ============
LX0, LX1, LY0, LY1 = 622, 668, 644, 690
reg2 = orig[LY0:LY1, LX0:LX1]  # use ORIGINAL (pre-patch1) pixels - zones don't overlap
r2, g2, b2 = reg2[..., 0], reg2[..., 1], reg2[..., 2]
strict_gold = (r2 > 70) & (g2 > 55) & (r2 > b2 + 18)
loose_ink = (r2 - b2 > 8) & (r2 > 55)

lbl, n = ndimage.label(strict_gold)
print(f'gold components in leg region: {n}')
dot_id, serif_ids = None, []
for i in range(1, n + 1):
    ys, xs = np.where(lbl == i)
    if len(xs) < 8:
        continue
    bx = (xs.min() + LX0, xs.max() + LX0, ys.min() + LY0, ys.max() + LY0)
    is_dot = 625 <= bx[0] and bx[1] <= 660 and 648 <= bx[2] and bx[3] <= 684 and len(xs) > 100
    tag = 'DOT' if is_dot else 'serif'
    print(f'  id={i}: x {bx[0]}-{bx[1]}, y {bx[2]}-{bx[3]}, px={len(xs)} -> {tag}')
    if is_dot:
        dot_id = i
    else:
        serif_ids.append(i)
assert dot_id is not None, 'dot component not found'

serif_mask = np.isin(lbl, serif_ids)
serif_prot = np.asarray(Image.fromarray((serif_mask * 255).astype(np.uint8))
                        .filter(ImageFilter.MaxFilter(11))) > 0  # ~5px protection

dot_core = loose_ink & ~serif_prot
dm = Image.fromarray((dot_core * 255).astype(np.uint8))
dm = dm.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(1.2))
dmask = np.asarray(dm).astype(np.float32) / 255.0
print(f'dot mask strong px: {(dmask > 0.5).sum()}')

# source: clean band y 694-722, mirror-tiled, offset +2
lband = list(range(694, 723))  # 29 rows
lseq = []
fwd = True
while len(lseq) < (LY1 - LY0):
    rows = lband if fwd else lband[::-1]
    lseq.extend(rows[:LY1 - LY0 - len(lseq)])
    fwd = not fwd
lsrc = np.stack([orig[sy, LX0:LX1] for sy in lseq]).astype(np.float32) + 2.0

a[LY0:LY1, LX0:LX1] = orig[LY0:LY1, LX0:LX1] * (1 - dmask[..., None]) + lsrc * dmask[..., None]
print('patch 2 (leg dot) applied')

res = np.clip(a, 0, 255).astype(np.uint8)
Image.fromarray(res).save(f'{OUT}/carrier-k-FINAL.png')
print('saved carrier-k-FINAL.png')

# ============ VERIFICATION ============
V = res.astype(np.float32)
rv, gv, bv = V[..., 0], V[..., 1], V[..., 2]
vgold = (rv > 70) & (gv > 55) & (rv > bv + 18)

# 1) serif gold map identical to H4?
og = (orig[..., 0] > 70) & (orig[..., 1] > 55) & (orig[..., 0] > orig[..., 2] + 18)
serif_zone = np.zeros_like(vgold); serif_zone[655:695, 580:650] = True
diff_serif = (vgold != og) & serif_zone
print(f'serif gold map changes: {diff_serif.sum()} px (should be ~0)')

# 2) no gold left in dot zone
dotzone = np.zeros_like(vgold); dotzone[650:688, 630:662] = True
resid = vgold & dotzone & ~serif_zone
print(f'residual gold in dot zone: {resid.sum()} px (must be 0)')

# 3) loose ink residue in dot zone (excluding serif protection area)
loose_v = (rv - bv > 15) & (rv > 60)
resid2 = loose_v & dotzone
ys, xs = np.where(resid2)
if len(ys):
    for yy_ in sorted(set(ys))[:10]:
        rowx = xs[ys == yy_]
        print(f'  loose ink y={yy_}: x {rowx.min()}-{rowx.max()} ({len(rowx)}px)')

# 4) stem zone: no gold below serif
stemzone = np.zeros_like(vgold); stemzone[690:732, 440:500] = True
print(f'residual gold below stem serif: {(vgold & stemzone).sum()} px (must be 0)')

# 5) anomalies in leg patch zone
Ln = V.mean(axis=2)
sub = Ln[646:690, 622:670]
loc = ndimage.uniform_filter(sub, size=9)
dev = sub - loc
print(f'leg zone deviations: dark<-6: {(dev < -6).sum()} | dark<-10: {(dev < -10).sum()} | bright>+8: {(dev > 8).sum()}')

# 6) QA zooms
img = Image.fromarray(res)
img.crop((560, 600, 700, 720)).resize((560, 480), Image.LANCZOS).save(f'{OUT}/FINAL-zoom-leg.png')
img.crop((420, 640, 540, 760)).resize((480, 480), Image.LANCZOS).save(f'{OUT}/FINAL-zoom-stem.png')
img.crop((400, 450, 700, 760)).resize((900, 930), Image.LANCZOS).save(f'{OUT}/FINAL-zoom-fullK.png')
print('saved QA zooms')
