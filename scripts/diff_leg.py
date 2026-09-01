#!/usr/bin/env python3
"""Diff hybrid4 (before phase-18 dot removal) vs v5 (current) in the leg area.
Identify every changed region, then restore the serif corner damage."""
from PIL import Image
import numpy as np
from scipy import ndimage

H4 = np.asarray(Image.open('/home/z/my-project/work/image-rev5/carrier-k-hybrid4.png').convert('RGB')).astype(np.float32)
V5 = np.asarray(Image.open('/home/z/my-project/work/image-rev5/carrier-k-final-nodot6.png').convert('RGB')).astype(np.float32)

# diff in leg area
d = np.abs(V5 - H4).mean(axis=2)
zone = d[600:710, 560:700]
changed = zone > 6
lbl, n = ndimage.label(changed)
print(f'changed regions (vs H4) in x560-700 y600-710: {n}')
for i in range(1, n + 1):
    ys, xs = np.where(lbl == i)
    if len(xs) < 10:
        continue
    print(f'  id={i}: x {xs.min()+560}-{xs.max()+560}, y {ys.min()+600}-{ys.max()+600}, px={len(xs)}')

# check the id=11 sliver zone: identical in both?
s_h4 = H4[630:637, 605:678].mean(axis=2)
s_v5 = V5[630:637, 605:678].mean(axis=2)
print(f'\nsliver zone y630-636 x605-677: H4 mean {s_h4.mean():.1f}, V5 mean {s_v5.mean():.1f}, '
      f'max abs diff {np.abs(s_h4 - s_v5).max():.1f}')
