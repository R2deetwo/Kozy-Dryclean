#!/usr/bin/env python3
"""build_light_series.py — Light series (v6): the approved navy collateral
re-composed on Kozy Cream.

Same layout, same typography, same geometry — only the palette inverts:
  navy surfaces -> Kozy Cream #F5F1E8
  on-navy text tints -> navy / slate
  gold TEXT accents -> deep gold #B8942C (brand rule: never light gold text on
  light grounds; hairlines & filled bands keep #D4AF37)
  cream price panel -> white panel
The gold offer band stays gold with navy text (unchanged), and the QR white
box stays white for scannability.
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, '/home/z/my-project/scripts/kozy-brand')
from kozy_kit_lib import WORK

SRC = WORK
OUT = WORK / 'light-series'
OUT.mkdir(parents=True, exist_ok=True)

# Ordered replacement pairs — longer / more specific first.
REPLACEMENTS = [
    # page + bleed background
    ('.bleedbox { position:absolute; inset:18.9px; background:#0A192F; overflow:hidden; }',
     '.bleedbox { position:absolute; inset:18.9px; background:#F5F1E8; overflow:hidden; }'),
    ('background:#0A192F', 'background:#F5F1E8'),
    # price panel: cream-on-navy becomes white-on-cream
    ('.pricepanel { margin-top:22.68; background:#F5F1E8; border-radius:10px;',
     '.pricepanel { margin-top:22.68; background:#FFFFFF; border-radius:10px;'),
    # text colours: on-navy tints -> navy family
    ('color:#F2F6FB', 'color:#0A192F'),
    ('color:#E7EDF5', 'color:#0A192F'),
    ('color:#C9D5E6', 'color:#3B4A63'),
    ('color:#9FB0C6', 'color:#6F88A8'),
    ('color:rgba(201,213,230,.6)', 'color:rgba(10,25,47,.55)'),
    # gold TEXT -> deep gold on light grounds (hairlines/bands untouched)
    ('color:#D4AF37', 'color:#B8942C'),
    ('.footer b { color:#D4AF37', '.footer b { color:#B8942C'),
    # dotted leaders keep (fine on white panel)
    # white QR pad stays; inner white text on navy stickers -> navy
    ('.steps .lb { color:#C9D5E6', '.steps .lb { color:#3B4A63'),
    ('.foot .addr { font-size:10.5px; line-height:1.5; color:#9FB0C6',
     '.foot .addr { font-size:10.5px; line-height:1.5; color:#6F88A8'),
    # crop-mark label: enforce the brand name (was 'KOZY ·')
    ('>KOZY · ', '>KOZY CARE · '),
    ('letter-spacing="1.5">KOZY · ', 'letter-spacing="1.5">KOZY CARE · '),
]

FILES = {
    # print + digital, front + back
    'flyer-a-front-v51.html': 'flyer-light-front.html',
    'flyer-a-front-digital-v51.html': 'flyer-light-front-digital.html',
    'flyer-a-back.html': 'flyer-light-back.html',
    'flyer-a-back-digital.html': 'flyer-light-back-digital.html',
    'poster-a3-v51.html': 'poster-light-a3.html',
    'poster-a3-digital-v51.html': 'poster-light-a3-digital.html',
}


def invert(src_text: str) -> str:
    out = src_text
    for old, new in REPLACEMENTS:
        out = out.replace(old, new)
    return out


def main() -> None:
    for src, dst in FILES.items():
        s = (SRC / src).read_text(encoding='utf-8')
        if not s:
            raise RuntimeError(f'missing source {src}')
        (OUT / dst).write_text(invert(s), encoding='utf-8')
        print(f'  {src}  ->  light-series/{dst}')
    print('LIGHT SERIES built')


if __name__ == '__main__':
    main()
