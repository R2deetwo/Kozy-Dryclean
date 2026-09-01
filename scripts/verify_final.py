#!/usr/bin/env python3
"""PROPER verification of carrier-k-FINAL.png."""
from PIL import Image
import numpy as np
from scipy import ndimage

V = np.asarray(Image.open('/home/z/my-project/work/image-rev5/carrier-k-FINAL.png').convert('RGB')).astype(np.float32)
H4 = np.asarray(Image.open('/home/z/my-project/work/image-rev5/carrier-k-hybrid4.png').convert('RGB')).astype(np.float32)

vg = (V[..., 0] > 70) & (V[..., 1] > 55) & (V[..., 0] > V[..., 2] + 18)
og = (H4[..., 0] > 70) & (H4[..., 1] > 55) & (H4[..., 0] > H4[..., 2] + 18)

# dot bbox (from component): x 629-657, y 653-680 (+AA margin 3)
dotbbox = np.zeros_like(vg); dotbbox[650:684, 626:661] = True

# 1) TRUE serif loss: serif zone minus dot bbox
serif_zone = np.zeros_like(vg); serif_zone[655:695, 580:650] = True
serif_zone &= ~dotbbox
lost = (og & ~vg & serif_zone).sum()
print(f'TRUE serif gold lost: {lost} px (must be 0)')
if lost:
    ys, xs = np.where(og & ~vg & serif_zone)
    print(f'  bbox: x {xs.min()}-{xs.max()}, y {ys.min()}-{ys.max()}')

# 2) TRUE dot residue: dot side pixels still gold (excluding serif gold in H4)
dotzone = dotbbox.copy()
dotzone &= ~og  # exclude anything that was gold in H4 (serif corner etc)
resid = vg & dotzone
print(f'TRUE residual gold in dot area: {resid.sum()} px (must be 0)')
if resid.sum():
    ys, xs = np.where(resid)
    for yy in sorted(set(ys))[:10]:
        rowx = xs[ys == yy]
        print(f'  y={yy}: x {rowx.min()}-{rowx.max()} ({len(rowx)}px)')

# 3) loose ink residue in dot area (right of serif gold)
loose_v = (V[..., 0] - V[..., 2] > 15) & (V[..., 0] > 60)
loose_o = (H4[..., 0] - H4[..., 2] > 15) & (H4[..., 0] > 60)
resid2 = loose_v & dotzone
print(f'loose ink residue in dot area: {resid2.sum()} px')
if resid2.sum():
    ys, xs = np.where(resid2)
    for yy in sorted(set(ys))[:10]:
        rowx = xs[ys == yy]
        print(f'  y={yy}: x {rowx.min()}-{rowx.max()} ({len(rowx)}px)')

# 4) deviations in FABRIC-ONLY part of the dot area (x 644-668, right of serif corner)
Ln = V.mean(axis=2)
sub = Ln[650:688, 644:669]
loc = ndimage.uniform_filter(sub, size=9)
dev = sub - loc
print(f'\nfabric-only dot area deviations: dark<-8: {(dev < -8).sum()} | bright>+8: {(dev > 8).sum()}')
ys, xs = np.where(dev < -8)
if len(ys):
    print(f'  dark: x {xs.min()+644}-{xs.max()+644}, y {ys.min()+650}-{ys.max()+650}')
ys, xs = np.where(dev > 8)
if len(ys):
    print(f'  bright: x {xs.min()+644}-{xs.max()+644}, y {ys.min()+650}-{ys.max()+650}')

# 5) texture continuity: patched fabric vs right-neighbor fabric
def localstd(z):
    return np.mean([z[i:i+6, j:j+6].std() for i in range(0, z.shape[0]-6, 6) for j in range(0, z.shape[1]-6, 6)])
print(f'\nlocalstd patched: {localstd(Ln[655:678, 640:662]):.2f} | right fabric: {localstd(Ln[655:678, 663:685]):.2f} | below: {localstd(Ln[694:716, 626:668]):.2f}')
print(f'mean patched: {Ln[655:678, 640:662].mean():.1f} | right fabric: {Ln[655:678, 663:685].mean():.1f}')

# 6) serif corner intact? compare gold right-edge profile y 676-690
print('\nserif right-edge profile (max gold x per row):')
for y in range(674, 692, 2):
    h4_row = np.where(og[y, 560:660])[0]
    v_row = np.where(vg[y, 560:660])[0]
    h4e = h4_row.max() + 560 if len(h4_row) else -1
    ve = v_row.max() + 560 if len(v_row) else -1
    print(f'  y={y}: H4 edge x={h4e} | FINAL edge x={ve} {"OK" if h4e == ve else "DIFF"}')
