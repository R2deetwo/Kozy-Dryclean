#!/usr/bin/env python3
"""Does the ORIGINAL have a natural soft shadow under the K's leg serif
(same as under the stem serif)? Compare luminance profiles below both serifs."""
from PIL import Image
import numpy as np

O = np.asarray(Image.open('/home/z/Kozy-Dryclean/public/brand/images/laundry-handover.png').convert('RGB')).astype(np.float32)
L = O.mean(axis=2)

print('=== below STEM serif (x 450-485) — the patched zone ===')
for y in range(686, 706):
    print(f'  y={y}: {L[y, 450:486].mean():.1f}')

print('\n=== below LEG serif (x 596-640) — untouched reference ===')
for y in range(686, 706):
    print(f'  y={y}: {L[y, 596:641].mean():.1f}')

print('\n=== below RIGHT part of stem serif (x 486-504) — untouched (right of dot) ===')
for y in range(686, 706):
    print(f'  y={y}: {L[y, 486:505].mean():.1f}')

print('\n=== fabric further below leg serif (y 706-730) for baseline ===')
for y in range(706, 731, 3):
    print(f'  y={y}: leg-x {L[y, 596:641].mean():.1f} | stem-x {L[y, 450:486].mean():.1f}')
