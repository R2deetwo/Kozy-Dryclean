#!/usr/bin/env python3
"""Fix SVG attribute names for React JSX (camelCase)."""
from pathlib import Path

icon_dir = Path('/home/z/my-project/public/icons/services')
brand_dir = Path('/home/z/my-project/public/brand')

replacements = [
    ('stroke-width', 'strokeWidth'),
    ('stroke-linecap', 'strokeLinecap'),
    ('stroke-linejoin', 'strokeLinejoin'),
    ('stroke-dasharray', 'strokeDasharray'),
    ('stroke-dashoffset', 'strokeDashoffset'),
    ('fill-rule', 'fillRule'),
    ('clip-rule', 'clipRule'),
    ('clip-path', 'clipPath'),
    ('xmlns:xlink', 'xmlnsXlink'),
]

for d in [icon_dir, brand_dir]:
    for svg in d.glob('*.svg'):
        text = svg.read_text(encoding='utf-8')
        original = text
        for old, new in replacements:
            text = text.replace(old, new)
        if text != original:
            svg.write_text(text, encoding='utf-8')
            print(f'fixed {svg.name}')
