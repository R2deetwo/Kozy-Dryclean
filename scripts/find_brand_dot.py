#!/usr/bin/env python3
"""Locate the lower-left dot below the K on the suit carrier (current laundry-handover.png).
Connected-component analysis of gold-ink pixels around the K region."""
from PIL import Image
import numpy as np
from scipy import ndimage

SRC = '/home/z/Kozy-Dryclean/public/brand/images/laundry-handover.png'
OUT = '/home/z/my-project/work/image-rev5'

img = Image.open(SRC).convert('RGB')
a = np.asarray(img).astype(np.float32)
H, W = a.shape[:2]
print(f'image: {W}x{H}')

r, g, b = a[..., 0], a[..., 1], a[..., 2]
gold = (r > 70) & (g > 55) & (r > b + 18)

lbl, n = ndimage.label(gold)
print(f'{n} gold components')
comps = []
for i in range(1, n + 1):
    ys, xs = np.where(lbl == i)
    if len(xs) < 8:  # noise
        continue
    comps.append((i, xs.min(), xs.max(), ys.min(), ys.max(), len(xs)))

comps.sort(key=lambda c: -c[5])
print('largest gold components (id, x0-x1, y0-y1, px):')
for c in comps[:15]:
    print(f'  id={c[0]:3d}  x {c[1]:4d}-{c[2]:4d}  y {c[3]:4d}-{c[4]:4d}  px={c[5]}')
