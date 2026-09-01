#!/usr/bin/env python3
"""Examine the source strip (y 722-756, x 444-494) for dark features."""
from PIL import Image
import numpy as np

O = np.asarray(Image.open('/home/z/Kozy-Dryclean/public/brand/images/laundry-handover.png').convert('RGB')).astype(np.float32)
L = O.mean(axis=2)

print('source strip row means (x 444-494):')
for y in range(716, 762, 2):
    print(f'  y={y}: mean={L[y, 444:494].mean():.1f} min={L[y, 444:494].min():.1f} max={L[y, 444:494].max():.1f}')

print('\nrow means for a WIDER x range (x 420-540) - checking if darkness is a band:')
for y in range(716, 762, 2):
    print(f'  y={y}: x420-540 mean={L[y, 420:540].mean():.1f}  x444-494 mean={L[y, 444:494].mean():.1f}')

# 2D map: luminance of source region, quantized, to spot the dark feature
print('\ndark pixels (lum < 40) map in y 716-760, x 430-510:')
for y in range(716, 761, 2):
    row = L[y, 430:511]
    marks = ''.join('#' if v < 38 else ('+' if v < 42 else '.') for v in row)
    print(f'  y={y}: {marks}')
