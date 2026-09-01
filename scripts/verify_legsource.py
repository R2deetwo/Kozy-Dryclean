#!/usr/bin/env python3
"""Verify clean source fabric below the leg serif (y 694-745, x 622-670)
for the correct dot re-removal."""
from PIL import Image
import numpy as np

H4 = np.asarray(Image.open('/home/z/my-project/work/image-rev5/carrier-k-hybrid4.png').convert('RGB')).astype(np.float32)
r, g, b = H4[..., 0], H4[..., 1], H4[..., 2]
gold = (r > 70) & (g > 55) & (r > b + 18)
L = H4.mean(axis=2)

print('gold px in y 694-748, x 620-672:', gold[694:749, 620:673].sum())
print('\nrow stats y 692-748 (x 622-668):')
for y in range(692, 749, 2):
    row = L[y, 622:669]
    gr = gold[y, 622:669]
    print(f'  y={y}: mean={row.mean():.1f} min={row.min():.1f} max={row.max():.1f} gold={gr.sum()}')

# dot-area fabric luminance reference: rows adjacent to the dot (y 646-650 = above dot, x 640-660)
print('\nreference fabric around dot:')
print(f'  above dot (y 644-650, x 640-660): {L[644:651, 640:661].mean():.1f}')
print(f'  right of dot (y 655-675, x 662-676): {L[655:676, 662:677].mean():.1f}')
print(f'  below serif (y 696-720, x 622-668): {L[696:721, 622:669].mean():.1f}')

# dot + serif separation test
from scipy import ndimage
reg_gold = gold[640:695, 615:680]
lbl, n = ndimage.label(reg_gold)
print(f'\ngold components in x615-680 y640-695: {n}')
for i in range(1, n + 1):
    ys, xs = np.where(lbl == i)
    if len(xs) < 8:
        continue
    print(f'  id={i}: x {xs.min()+615}-{xs.max()+615}, y {ys.min()+640}-{ys.max()+640}, px={len(xs)}')
