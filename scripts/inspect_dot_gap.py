#!/usr/bin/env python3
"""Inspect the stem/dot gap and find a clean fabric source strip."""
from PIL import Image
import numpy as np
from scipy import ndimage

SRC = '/home/z/Kozy-Dryclean/public/brand/images/laundry-handover.png'
img = Image.open(SRC).convert('RGB')
a = np.asarray(img).astype(np.float32)

print('--- column profile x=462..470, y 678..726 (ink channel r-b) ---')
for y in range(678, 727):
    vals = [int(a[y, x, 0] - a[y, x, 2]) for x in range(462, 471)]
    print(f'y={y}: ' + ' '.join(f'{v:4d}' for v in vals))

# check candidate source strip below: x 444-486, y 726-764
strip = a[726:766, 444:487]
r, g, b = strip[..., 0], strip[..., 1], strip[..., 2]
goldish = (r > 70) & (g > 55) & (r > b + 18)
print(f'\nsource strip x444-486 y726-766: gold px = {goldish.sum()}')
print(f'strip stats: mean RGB = {strip.reshape(-1,3).mean(0).round(1)}, std = {strip.reshape(-1,3).std(0).round(1)}')

# also check strip to the left: x 404-444, y 684-724
stripL = a[684:724, 404:444]
rL, gL, bL = stripL[..., 0], stripL[..., 1], stripL[..., 2]
goldL = (rL > 70) & (gL > 55) & (rL > bL + 18)
print(f'left strip x404-444 y684-724: gold px = {goldL.sum()}')
print(f'left stats: mean RGB = {stripL.reshape(-1,3).mean(0).round(1)}, std = {stripL.reshape(-1,3).std(0).round(1)}')

# dot bbox tight: find all gold in x 440-492, y 684-726
reg = a[684:727, 440:493]
rr, gg, bb = reg[..., 0], reg[..., 1], reg[..., 2]
gm = (rr > 60) & (gg > 45) & (rr > bb + 12)
ys, xs = np.where(gm)
if len(ys):
    print(f'\nloose-gold dot bbox: x {xs.min()+440}-{xs.max()+440}, y {ys.min()+684}-{ys.max()+684}, px={len(ys)}')
