#!/usr/bin/env python3
"""v4 FINAL APPROACH:
- Source: mirror-tiled rows 728-739 (12 verified ultra-clean rows, min lum 47.7),
  global offset -1.5 to match the dot-area natural mean (~47.3).
- Mask: gold-ink detector UNION a soft gaussian ellipse covering the dot's
  soft cast shadow just below it (center x467 y717).
- No per-row correction (reference was noisy), no grain."""
from PIL import Image, ImageFilter
import numpy as np
from scipy import ndimage

SRC = '/home/z/Kozy-Dryclean/public/brand/images/laundry-handover.png'
OUT = '/home/z/my-project/work/image-rev5'

a = np.asarray(Image.open(SRC).convert('RGB')).astype(np.float32)

X0, X1, Y0, Y1 = 442, 496, 690, 726   # y 690..725 inclusive
reg = a[Y0:Y1, X0:X1]
r, g, b = reg[..., 0], reg[..., 1], reg[..., 2]
ink = ((r - b) > 5) & (r > 50)

# soft ellipse for the dot's shadow (below dot core)
h, w = reg.shape[:2]
yy, xx = np.mgrid[0:h, 0:w]
ecx, ecy = 467 - X0, 717 - Y0
ell = np.exp(-(((xx - ecx) / 24.0) ** 2 + ((yy - ecy) / 12.0) ** 2))
ell = (ell > 0.25).astype(np.float32)

mask_base = np.maximum(ink.astype(np.float32), ell)
m = Image.fromarray((mask_base * 255).astype(np.uint8))
m = m.filter(ImageFilter.MaxFilter(3))
m = m.filter(ImageFilter.GaussianBlur(1.2))
mask = np.asarray(m).astype(np.float32) / 255.0

# mirror-tiled source from clean rows 728-739
band = list(range(728, 740))
def mirror_tile(n):
    seq, fwd = [], True
    while len(seq) < n:
        rows = band if fwd else band[::-1]
        seq.extend(rows[:n - len(seq)])
        fwd = not fwd
    return seq
seq = mirror_tile(Y1 - Y0)
print('mirror seq:', seq)

src = np.stack([a[sy, X0:X1] for sy in seq]).astype(np.float32)
src -= 1.5  # global luminance offset (clean band ~49 -> target ~47.3)

out = a.copy()
region = out[Y0:Y1, X0:X1]
out[Y0:Y1, X0:X1] = region * (1 - mask[..., None]) + src * mask[..., None]
res = np.clip(out, 0, 255).astype(np.uint8)
Image.fromarray(res).save(f'{OUT}/carrier-k-final-nodot5.png')
print('saved carrier-k-final-nodot5.png')

# ---- checks ----
chk = out[690:727, 438:500]
rr, bb = chk[..., 0], chk[..., 2]
resid = ((rr - bb) > 15) & (rr > 55)
print(f'residual gold ink below serif: {resid.sum()} px (must be 0)')

Ln = out.mean(axis=2)
sub = Ln[690:728, 435:505]
loc = ndimage.uniform_filter(sub, size=9)
dev = sub - loc
print(f'dark deviations < -5: {(dev < -5).sum()} px | < -8: {(dev < -8).sum()} px')
print(f'bright deviations > +6: {(dev > 6).sum()} px')

def localstd(z):
    return np.mean([z[i:i+6, j:j+6].std() for i in range(0, z.shape[0]-6, 6) for j in range(0, z.shape[1]-6, 6)])
print(f'localstd patch: {localstd(Ln[696:720, 448:490]):.2f} | below-band: {localstd(Ln[730:744, 448:490]):.2f}')
print(f'patch mean: {Ln[696:720, 448:490].mean():.1f}')
print(f'serif rows untouched: {np.abs(a[688:690, 440:500] - out[688:690, 440:500]).max():.2f}')

# smoothness of row means (no jumps)
print('\nrow means through patch (x 448-488):')
means = [Ln[y, 448:488].mean() for y in range(688, 730)]
print(' '.join(f'{v:.0f}' for v in means))

# QA zooms
z1 = Image.fromarray(res).crop((420, 640, 540, 760)).resize((480, 480), Image.LANCZOS)
z1.save(f'{OUT}/nodot5-zoom-stem-4x.png')
z2 = Image.fromarray(res).crop((400, 450, 700, 760)).resize((900, 930), Image.LANCZOS)
z2.save(f'{OUT}/nodot5-zoom-fullK-3x.png')
print('saved QA zooms')
