#!/usr/bin/env python3
"""Draw a labeled 10%-grid over the three 'how it works' cartoons so the VLM
can report precise object coordinates. Output: /tmp/grid-*.png"""
from PIL import Image, ImageDraw, ImageFont

FONT = ImageFont.truetype(
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 28)

for name in ['how-1-book', 'how-2-collect', 'how-3-return']:
    img = Image.open(f'/home/z/Kozy-Dryclean/public/brand/images/{name}.png').convert('RGB')
    d = ImageDraw.Draw(img)
    W, H = img.size
    step = W // 10
    for i in range(1, 10):
        x = i * step
        d.line([(x, 0), (x, H)], fill=(255, 0, 0), width=3)
        d.line([(0, x), (W, x)], fill=(255, 0, 0), width=3)
    # labels: columns A-J, rows 1-10 (top-left = A1)
    for c in range(10):
        for r in range(10):
            label = f'{chr(65 + c)}{r + 1}'
            x = c * step + 8
            y = r * step + 6
            d.rectangle([x - 4, y - 2, x + 78, y + 34], fill=(255, 255, 255))
            d.text((x, y), label, fill=(200, 0, 0), font=FONT)
    img.save(f'/tmp/grid-{name}.png')
    print(f'grid-{name}.png saved')
