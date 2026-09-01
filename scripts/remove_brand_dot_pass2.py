#!/usr/bin/env python3
"""Second pass: remove the faint dot-fringe hump at y 690-691, x ~456-468
while preserving the foot-serif's natural AA rows (y 688-689).
Verify y-689 uniformity across serif first, then patch y 690-693."""
from PIL import Image, ImageFilter
import numpy as np

SRC = '/home/z/my-project/work/image-rev5/carrier-k-final-nodot.png'
OUT = '/home/z/my-project/work/image-rev5'

a = np.asarray(Image.open(SRC).convert('RGB')).astype(np.float32)

# 1) check y=689 uniformity across the serif width
row = a[689, 440:510]
ink689 = [int(row[i, 0] - row[i, 2]) for i in range(row.shape[0])]
print('y=689 r-b across x440-509:')
print(' '.join(f'{v:4d}' for v in ink689))

# 2) patch y 690-693, x 448-486
X0, X1, Y0, Y1 = 448, 486, 690, 694
reg = a[Y0:Y1, X0:X1]
r, g, b = reg[..., 0], reg[..., 1], reg[..., 2]
ink = ((r - b) > 5) & (r > 50)
print(f'\nfaint ink px in pass-2 region: {ink.sum()}')

m = Image.fromarray((ink * 255).astype(np.uint8))
m = m.filter(ImageFilter.MaxFilter(5))
m = m.filter(ImageFilter.GaussianBlur(1.2))
mask = np.asarray(m).astype(np.float32) / 255.0

SHIFT = 33
src = a[Y0 + SHIFT:Y1 + SHIFT, X0:X1]
rng = np.random.default_rng(23)
grain = rng.normal(0, 1.0, reg.shape)
patch = np.clip(src + grain * (mask[..., None] > 0.1), 0, 255)

out = a.copy()
region = out[Y0:Y1, X0:X1]
out[Y0:Y1, X0:X1] = region * (1 - mask[..., None]) + patch * mask[..., None]

res = np.clip(out, 0, 255).astype(np.uint8)
Image.fromarray(res).save(f'{OUT}/carrier-k-final-nodot2.png')
print('saved carrier-k-final-nodot2.png')

# 3) verify: column profile + no medium ink below y 689
chk = out[688:700, 440:505]
rr, bb = chk[..., 0], chk[..., 2]
resid = ((rr - bb > 15) & (rr > 55))
ys, xs = np.where(resid)
print(f'\nresidual ink (r-b>15) in y688-699, x440-504: {len(ys)} px')
for yy in sorted(set(ys)):
    rowx = xs[ys == yy]
    print(f'  y={yy+688}: x {rowx.min()+440}-{rowx.max()+440} ({len(rowx)} px)')

# 4) QA zooms
z1 = Image.fromarray(res).crop((420, 640, 540, 760))
z1 = z1.resize((z1.width * 4, z1.height * 4), Image.LANCZOS)
z1.save(f'{OUT}/nodot2-zoom-stem-4x.png')
z2 = Image.fromarray(res).crop((400, 450, 700, 760))
z2 = z2.resize((z2.width * 3, z2.height * 3), Image.LANCZOS)
z2.save(f'{OUT}/nodot2-zoom-fullK-3x.png')
print('saved QA zooms')
