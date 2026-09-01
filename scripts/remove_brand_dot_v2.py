#!/usr/bin/env python3
"""CLEAN REBUILD from the original image - single pass, no grain.
- Patch zone: x 444-494, y 690-724 (dot core + its top fringe hump).
  Serif's own AA rows (y 688-689) preserved untouched.
- Source: fabric at SHIFT=32 below (aligned to the 2px weave period).
- No synthetic grain (natural fabric localstd is only 0.68 - the copy
  already carries the real weave).
- Tight mask: ink detector + MaxFilter(3) + mild feather (blur 1.0)."""
from PIL import Image, ImageFilter
import numpy as np

SRC = '/home/z/Kozy-Dryclean/public/brand/images/laundry-handover.png'
OUT = '/home/z/my-project/work/image-rev5'

a = np.asarray(Image.open(SRC).convert('RGB')).astype(np.float32)
H, W = a.shape[:2]

X0, X1, Y0, Y1 = 444, 494, 690, 724
reg = a[Y0:Y1, X0:X1]
r, g, b = reg[..., 0], reg[..., 1], reg[..., 2]
ink = ((r - b) > 5) & (r > 50)
print(f'ink px in patch region: {ink.sum()}')

m = Image.fromarray((ink * 255).astype(np.uint8))
m = m.filter(ImageFilter.MaxFilter(3))
m = m.filter(ImageFilter.GaussianBlur(1.0))
mask = np.asarray(m).astype(np.float32) / 255.0
print(f'mask strong px: {(mask > 0.5).sum()}')

SHIFT = 32
src = a[Y0 + SHIFT:Y1 + SHIFT, X0:X1]
assert Y1 + SHIFT <= H

out = a.copy()
region = out[Y0:Y1, X0:X1]
out[Y0:Y1, X0:X1] = region * (1 - mask[..., None]) + src * mask[..., None]

res = np.clip(out, 0, 255).astype(np.uint8)
Image.fromarray(res).save(f'{OUT}/carrier-k-final-nodot3.png')
print('saved carrier-k-final-nodot3.png')

# ---- verification ----
# 1) no ink left below y 689
chk = out[690:724, 440:500]
rr, bb = chk[..., 0], chk[..., 2]
resid = ((rr - bb) > 15) & (rr > 55)
print(f'residual ink below serif: {resid.sum()} px (must be 0)')

# 2) serif rows untouched
orig_serif = a[688:690, 440:500]
new_serif = out[688:690, 440:500]
print(f'serif AA rows max change: {np.abs(orig_serif - new_serif).max():.2f} (must be 0)')

# 3) texture stats: patched zone vs natural fabric
L = out.mean(axis=2)
def localstd(z):
    return np.mean([z[i:i+6, j:j+6].std() for i in range(0, z.shape[0]-6, 6) for j in range(0, z.shape[1]-6, 6)])
inside = L[696:720, 450:488]
below = L[726:754, 448:490]
print(f'localstd inside patch: {localstd(inside):.2f} | natural below: {localstd(below):.2f} (should match closely)')

# 4) brightness match
print(f'mean inside: {inside.mean():.1f} | mean below: {below.mean():.1f}')

# QA zooms
z1 = Image.fromarray(res).crop((420, 640, 540, 760)).resize((480, 480), Image.LANCZOS)
z1.save(f'{OUT}/nodot3-zoom-stem-4x.png')
z2 = Image.fromarray(res).crop((400, 450, 700, 760)).resize((900, 930), Image.LANCZOS)
z2.save(f'{OUT}/nodot3-zoom-fullK-3x.png')
print('saved QA zooms')
