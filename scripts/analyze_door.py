#!/usr/bin/env python3
"""Locate the dark doorway + white frame in handover-final.png numerically,
then patch it with plain cream wall cloned from the left, blending seams.
Outputs handover-final2.png (door-free)."""
from PIL import Image, ImageFilter
import numpy as np

DIR = '/home/z/my-project/work/image-rev4'
img = Image.open(f'{DIR}/handover-final.png').convert('RGB')
W, H = img.size
a = np.asarray(img).astype(np.float32)
lum = 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]

# Search window generously around the VLM bbox (x 599-691, y 130-389)
x0, x1, y0, y1 = 540, 780, 50, 450
win = lum[y0:y1, x0:x1]

# Column profile: mean luminance of the top half (above people, wall/door zone)
colprof = lum[max(60, y0):min(420, y1), x0:x1].mean(axis=0)
rowprof = lum[:, 560:720].mean(axis=1)

print('column profile (x, lum) — low = dark doorway:')
for i in range(0, len(colprof), 6):
    print(f'  x={x0 + i:4d}  lum={colprof[i]:6.1f}')

print('\nrow profile (y, lum) over x 560-720:')
for j in range(0, len(rowprof), 12):
    print(f'  y={j:4d}  lum={rowprof[j]:6.1f}')
