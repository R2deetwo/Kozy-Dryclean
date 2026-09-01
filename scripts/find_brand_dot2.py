#!/usr/bin/env python3
"""Zoom the K region and isolate the dot below the stem via morphology."""
from PIL import Image
import numpy as np
from scipy import ndimage

SRC = '/home/z/Kozy-Dryclean/public/brand/images/laundry-handover.png'
OUT = '/home/z/my-project/work/image-rev5'

img = Image.open(SRC).convert('RGB')
a = np.asarray(img).astype(np.float32)

# K region crop (generous)
X0, X1, Y0, Y1 = 400, 700, 450, 760
crop = a[Y0:Y1, X0:X1]

# 3x zoom for inspection
zc = Image.fromarray(crop.astype(np.uint8))
zc = zc.resize((zc.width * 3, zc.height * 3), Image.LANCZOS)
zc.save(f'{OUT}/k-region-current-3x.png')
print('saved k-region-current-3x.png')

# gold mask in the K region only
r, g, b = crop[..., 0], crop[..., 1], crop[..., 2]
gold = (r > 70) & (g > 55) & (r > b + 18)

# erode to break thin connections, then label
er = ndimage.binary_erosion(gold, iterations=3)
lbl, n = ndimage.label(er)
print(f'{n} components after erosion (in K region):')
comps = []
for i in range(1, n + 1):
    ys, xs = np.where(lbl == i)
    if len(xs) < 20:
        continue
    comps.append((i, xs.min() + X0, xs.max() + X0, ys.min() + Y0, ys.max() + Y0, len(xs)))
comps.sort(key=lambda c: -c[5])
for c in comps:
    print(f'  id={c[0]:3d}  x {c[1]:4d}-{c[2]:4d}  y {c[3]:4d}-{c[4]:4d}  px={c[5]}  w={c[2]-c[1]} h={c[4]-c[3]}')

# Also: raw gold column profile below the glyph area to find detached dot
# The K glyph bottom ~ y 700; dot should be below-left near x 460-500
sub = gold[:, :]
print('\ngold pixel count per row (y=560..760, region coords):')
for y in range(110, 310, 10):
    row = gold[y]
    xs = np.where(row)[0]
    if len(xs):
        print(f'  y={y+Y0}: {len(xs)} px, x-range {xs.min()+X0}-{xs.max()+X0}')
