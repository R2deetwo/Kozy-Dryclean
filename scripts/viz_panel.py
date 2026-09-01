#!/usr/bin/env python3
"""Visualize the panel luminance structure around the K to understand
seams/shadows/features before final patching."""
from PIL import Image
import numpy as np

O = np.asarray(Image.open('/home/z/Kozy-Dryclean/public/brand/images/laundry-handover.png').convert('RGB')).astype(np.float32)
L = O.mean(axis=2)

# ASCII map of panel region x 380-680, y 600-780, downsampled 4x
print('Legend: " darkest | . dark | - mid | o bright | O brightest   (each char = 4x4 px)')
print('        cols: x 380..680 step 4')
x0, x1, y0, y1 = 380, 680, 600, 780
for y in range(y0, y1, 4):
    row = ''
    for x in range(x0, x1, 4):
        v = L[y:y+4, x:x+4].mean()
        if v < 30: row += '"'
        elif v < 40: row += '.'
        elif v < 52: row += '-'
        elif v < 80: row += 'o'
        else: row += 'O'
    print(f'y={y:3d} {row}')
print('\ncol ruler (x/10):')
ruler = ''
for x in range(x0, x1, 4):
    ruler += str((x // 10) % 10)
print('      ' + ruler)
