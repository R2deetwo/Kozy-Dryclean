#!/usr/bin/env python3
"""v3: source ONLY from the verified clean band (y 728-742, x 444-494),
mirror-tiled to fill the patch zone (x 444-494, y 690-724),
with per-row luminance matching to the natural vertical gradient
(reference: clean mid-fabric at x 496-516, same rows)."""
from PIL import Image, ImageFilter
import numpy as np

SRC = '/home/z/Kozy-Dryclean/public/brand/images/laundry-handover.png'
OUT = '/home/z/my-project/work/image-rev5'

a = np.asarray(Image.open(SRC).convert('RGB')).astype(np.float32)
L = a.mean(axis=2)

# --- verify clean band y 728-742, x 444-494 ---
band = L[728:743, 444:495]
print('clean band stats: mean %.1f  min %.1f  max %.1f' % (band.mean(), band.min(), band.max()))
for y in range(728, 743):
    row = L[y, 444:495]
    print(f'  y={y}: mean={row.mean():.1f} min={row.min():.1f}')

# --- reference vertical gradient: x 496-516 (clean mid fabric), y 688-728 ---
print('\nreference rows (x 496-516):')
refs = {}
for y in range(688, 729):
    refs[y] = L[y, 496:517].mean()
for y in range(688, 729, 4):
    print(f'  y={y}: {refs[y]:.1f}')

# --- build mirrored source for dest rows 690..723 ---
band_rows = list(range(728, 743))          # 15 clean rows
mirror = band_rows + list(reversed(band_rows[:-1]))  # 728..742, 741..728 (29 rows)
mirror = (mirror + mirror)[::-1]           # allow tiling
# build sequence of length 34 for dest 690..723
seq = []
i = 0
while len(seq) < 34:
    seq.append(band_rows[i % len(band_rows)] if (len(seq) // len(band_rows)) % 2 == 0
               else list(reversed(band_rows))[i % len(band_rows)])
    i += 1
# simpler deterministic mirror tiling:
def mirror_tile(n, band):
    seq = []
    forward = True
    while len(seq) < n:
        rows = band if forward else band[::-1]
        for r in rows:
            if len(seq) >= n: break
            seq.append(r)
        forward = not forward
    return seq
seq = mirror_tile(34, band_rows)
print('\nmirror sequence (first 10):', seq[:10], '... last 5:', seq[-5:])

# --- patch ---
X0, X1, Y0, Y1 = 444, 495, 690, 724  # y 690..723 inclusive
reg = a[Y0:Y1, X0:X1]
r, g, b = reg[..., 0], reg[..., 1], reg[..., 2]
ink = ((r - b) > 5) & (r > 50)
m = Image.fromarray((ink * 255).astype(np.uint8))
m = m.filter(ImageFilter.MaxFilter(3))
m = m.filter(ImageFilter.GaussianBlur(1.0))
mask = np.asarray(m).astype(np.float32) / 255.0

# build source block with per-row luminance correction
src = np.zeros_like(reg)
for di, sy in enumerate(seq):
    srow = a[sy, X0:X1].copy()
    # luminance correction: source row mean -> dest row reference mean
    src_ref = L[sy, 496:517].mean()
    dst_ref = refs[Y0 + di]
    srow += (dst_ref - src_ref)
    src[di] = srow

out = a.copy()
region = out[Y0:Y1, X0:X1]
out[Y0:Y1, X0:X1] = region * (1 - mask[..., None]) + src * mask[..., None]
res = np.clip(out, 0, 255).astype(np.uint8)
Image.fromarray(res).save(f'{OUT}/carrier-k-final-nodot4.png')
print('saved carrier-k-final-nodot4.png')

# --- verification ---
chk = out[690:725, 440:500]
rr, bb = chk[..., 0], chk[..., 2]
resid = ((rr - bb) > 15) & (rr > 55)
print(f'residual ink below serif: {resid.sum()} px (must be 0)')

# dark-blob scan
from scipy import ndimage
Ln = out.mean(axis=2)
sub = Ln[690:726, 435:505]
loc = ndimage.uniform_filter(sub, size=9)
dev = sub - loc
print(f'dark deviations < -5: {(dev < -5).sum()} px | < -8: {(dev < -8).sum()} px')
print(f'bright deviations > +6: {(dev > 6).sum()} px')

# texture
def localstd(z):
    return np.mean([z[i:i+6, j:j+6].std() for i in range(0, z.shape[0]-6, 6) for j in range(0, z.shape[1]-6, 6)])
print(f'localstd inside patch: {localstd(Ln[696:720, 450:488]):.2f} | right neighbor: {localstd(Ln[696:720, 496:535]):.2f} | below: {localstd(Ln[730:750, 444:490]):.2f}')

# serif untouched
print(f'serif rows max change: {np.abs(a[688:690, 440:500] - out[688:690, 440:500]).max():.2f}')

# QA zooms
z1 = Image.fromarray(res).crop((420, 640, 540, 760)).resize((480, 480), Image.LANCZOS)
z1.save(f'{OUT}/nodot4-zoom-stem-4x.png')
z2 = Image.fromarray(res).crop((400, 450, 700, 760)).resize((900, 930), Image.LANCZOS)
z2.save(f'{OUT}/nodot4-zoom-fullK-3x.png')
print('saved QA zooms')
