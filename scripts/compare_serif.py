#!/usr/bin/env python3
"""Compare the leg-serif area between carrier-k-hybrid4 (before phase-18 dot
removal) and the current v5 - did the phase-18 patch damage the serif?"""
from PIL import Image
import numpy as np

H4 = np.asarray(Image.open('/home/z/my-project/work/image-rev5/carrier-k-hybrid4.png').convert('RGB')).astype(np.float32)
V5 = np.asarray(Image.open('/home/z/my-project/work/image-rev5/carrier-k-final-nodot6.png').convert('RGB')).astype(np.float32)

print('sizes:', H4.shape, V5.shape)

# gold map of the glyph's lower-right quadrant in both
for name, A in [('HYBRID4 (before removal)', H4), ('V5 (current)', V5)]:
    r, g, b = A[..., 0], A[..., 1], A[..., 2]
    gold = (r > 70) & (g > 55) & (r > b + 18)
    print(f'\n=== {name}: gold map y 640-700, x 580-680 (# = gold) ===')
    for y in range(640, 700, 2):
        row = ''
        for x in range(580, 680, 2):
            blk = gold[y:y+2, x:x+2]
            row += '#' if blk.any() else '.'
        print(f'y={y:3d} {row}')

# luminance of the sliver zones in both
for name, A in [('HYBRID4', H4), ('V5', V5)]:
    L = A.mean(axis=2)
    print(f'\n{name}: sliver id=11 zone (y 632-634, x 608-674) mean lum: {L[632:635, 608:675].mean():.1f}')
    print(f'{name}: spot id=20 zone (y 648-651, x 630-644) mean lum: {L[648:652, 630:645].mean():.1f}')
    print(f'{name}: serif ref (y 665-680, x 595-640) mean lum: {L[665:681, 595:641].mean():.1f}')
    print(f'{name}: fabric ref (y 700-720, x 560-590) mean lum: {L[700:721, 560:591].mean():.1f}')
