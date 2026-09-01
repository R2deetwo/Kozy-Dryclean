#!/usr/bin/env python3
"""Blind A/B (original vs v5) + website-scale render for realistic QA."""
from PIL import Image

OUT = '/home/z/my-project/work/image-rev5'
O = Image.open('/home/z/Kozy-Dryclean/public/brand/images/laundry-handover.png').convert('RGB')
V = Image.open(f'{OUT}/carrier-k-final-nodot6.png').convert('RGB')

# A/B: full K area crop
box = (400, 440, 700, 780)
o = O.crop(box); v = V.crop(box)
w, h = o.size
canvas = Image.new('RGB', (w, h * 2 + 20), (255, 255, 255))
canvas.paste(o, (0, 0)); canvas.paste(v, (0, h + 20))
canvas = canvas.resize((w * 2, (h * 2 + 20) * 2), Image.LANCZOS)
canvas.save(f'{OUT}/ab-orig-vs-v5.png')
print('saved ab-orig-vs-v5.png (TOP=original, BOTTOM=fixed)')

# Website-scale: the landing renders the image ~640px wide (of 1152). K area ~ 190px.
site = V.crop((380, 430, 720, 780)).resize((170, 175), Image.LANCZOS)
site = site.resize((510, 525), Image.NEAREST)  # keep website pixels, view bigger
site.save(f'{OUT}/website-scale-k.png')
print('saved website-scale-k.png (K at actual landing-page size)')

# also original at website scale for comparison
site_o = O.crop((380, 430, 720, 780)).resize((170, 175), Image.LANCZOS)
site_o = site_o.resize((510, 525), Image.NEAREST)
site_o.save(f'{OUT}/website-scale-k-original.png')
print('saved website-scale-k-original.png')
