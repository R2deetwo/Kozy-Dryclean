#!/usr/bin/env python3
"""Measure actual rendered proportions of the child croquis PNG."""
from PIL import Image
import numpy as np

for name in ['children', 'men']:
    img = Image.open(f'/home/z/my-project/work/croquis/after-{name}-fig.png').convert('L')
    a = np.array(img)
    h, w = a.shape
    # stroke color #9FB1C7 ~ luminance 173; white is 255. Find "line" pixels < 220
    lines = a < 230
    rows = np.where(lines.any(axis=1))[0]
    cols = np.where(lines.any(axis=0))[0]
    print(f'=== {name} (png {w}x{h}) ===')
    print(f'ink bbox: y {rows.min()}-{rows.max()}  x {cols.min()}-{cols.max()}')
    top, bot = rows.min(), rows.max()
    fig_h = bot - top
    print(f'figure height px: {fig_h}  (top {top}, bottom {bot})')

    # find the head: the chin is the narrowest point of the head-neck region.
    # scan row ink-width in the top 30% of the figure
    per_row = lines.sum(axis=1)
    print('row ink-width profile (every 4% of figure height):')
    for frac in [0.02, 0.06, 0.10, 0.14, 0.18, 0.22, 0.26, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90, 0.97]:
        y = int(top + fig_h * frac)
        # count horizontal extent of ink in this row
        xs = np.where(lines[y])[0]
        if len(xs):
            print(f'  y={y} ({frac:.0%}): ink x {xs.min()}-{xs.max()} width~{xs.max()-xs.min()}')
        else:
            print(f'  y={y} ({frac:.0%}): empty')

    # head height estimate: neck = local minimum of ink-width in top 25%
    ys = np.arange(top, top + int(fig_h * 0.28))
    widths = []
    for y in ys:
        xs = np.where(lines[y])[0]
        widths.append((xs.max() - xs.min()) if len(xs) else 0)
    warr = np.array(widths)
    neck_i = int(np.argmin(warr[5:])) + 5  # skip very top
    print(f'estimated neck row y={ys[neck_i]} width={warr[neck_i]}')
    print(f'=> estimated head height (top->neck): {ys[neck_i]-top}px = {(ys[neck_i]-top)/fig_h:.1%} of figure')
    print(f'=> implied head-units: {fig_h/(ys[neck_i]-top):.2f}')
    print()
