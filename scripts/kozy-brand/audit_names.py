#!/usr/bin/env python3
"""Extract visible text from brand-kit HTML files to audit brand naming."""
import re, html, sys
from pathlib import Path

BASE = Path('/home/z/my-project/download/kozy-brand')
FILES = [
    'brand-sheet/kozy-brand-sheet.html',
    'business-cards/html-source/card-navy-front.html',
    'business-cards/html-source/card-navy-back.html',
    'business-cards/html-source/card-white-front.html',
    'business-cards/html-source/card-white-back.html',
    'flyer-services-a5/html-source/flyer-a-front.html',
    'flyer-services-a5/html-source/flyer-a-back.html',
    'flyer-offer-a5/html-source/flyer-b.html',
    'poster-a3/html-source/poster-a3.html',
    'v5.1-hotel-corporate-update/flyer-services-a5/html-source/flyer-a-front.html',
    'v5.1-hotel-corporate-update/flyer-offer-a5/html-source/flyer-b.html',
    'v5.1-hotel-corporate-update/poster-a3/html-source/poster-a3.html',
]

def visible_text(src: str) -> str:
    src = re.sub(r'<script[\s\S]*?</script>', ' ', src)
    src = re.sub(r'<style[\s\S]*?</style>', ' ', src)
    src = re.sub(r'<svg[\s\S]*?</svg>', ' [SVG] ', src)
    src = re.sub(r'<[^>]+>', '\n', src)
    src = html.unescape(src)
    lines = [l.strip() for l in src.split('\n')]
    lines = [l for l in lines if l and l != '[SVG]']
    return '\n'.join(lines)

for rel in FILES:
    p = BASE / rel
    if not p.exists():
        print(f'=== {rel} (MISSING) ==='); continue
    print(f'=== {rel} ===')
    txt = visible_text(p.read_text(encoding='utf-8'))
    print(txt[:1600])
    print()
