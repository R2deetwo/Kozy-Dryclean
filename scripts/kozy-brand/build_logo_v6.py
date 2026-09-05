#!/usr/bin/env python3
"""build_logo_v6.py — correct the brand wordmark from 'KOZY' to 'Kozy Care'.

The v5 logo pack spelled the wordmark 'KOZY' + 'PREMIUM DRY CLEANING', which is
where the mixed naming came from: the website and all print collateral say
'Kozy Care'. This builds true vector lockups (text converted to paths via
fontTools — no font dependency on the viewer's machine):

  primary   mark + Kozy Care (title case, Playfair Display Bold) + tracked
            caps subtitle DRYCLEANING & LAUNDRY — the exact lockup the landing
            page renders (logo.tsx: mark 40px, text 20px, subtitle 9px).
  compact   mark + Kozy Care, no subtitle.
  print     mark + KOZY CARE (tracked caps) — the lockup the print collateral
            uses on cards/flyers.

Each in navy / white / gold on transparent, plus high-res PNG exports.
"""
import sys
from pathlib import Path

sys.path.insert(0, '/home/z/my-project/scripts/kozy-brand')
from kozy_kit_lib import (K_MARK_PATHS, K_WIRE_PATH, FONTS, WORK,
                          NAVY, GOLD, WHITE)

from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen

OUT = WORK / 'logo-v6'
OUT.mkdir(parents=True, exist_ok=True)

PLAYFAIR_BOLD = FONTS / 'static' / 'PlayfairDisplay-Bold.ttf'
MARCELLUS = FONTS / 'static' / 'Marcellus-Regular.ttf'


def text_to_group(font_path: Path, text: str, size: float, fill: str,
                  tracking: float = 0.0, x: float = 0.0, y: float = 0.0) -> str:
    """Convert text into a single SVG <g> of glyph paths.

    Font units are y-up; we emit in font units and flip with scale(1,-1),
    matching the K-mark's own convention. `size` = target cap height scale in
    the output units (font upm normalised), `tracking` in font units.
    Returns the group positioned so the BASELINE sits at y (in flipped space
    the group is translated to -y).
    """
    font = TTFont(str(font_path))
    upm = font['head'].unitsPerEm
    cmap = font.getBestCmap()
    hmtx = font['hmtx']
    glyf = font['glyf']
    scale = size / upm

    paths = []
    pen_x = 0.0
    for ch in text:
        if ch == ' ':
            pen_x += hmtx[cmap[0x20]][0] * 0.55  # slightly tightened space
            continue
        gid = cmap[ord(ch)]
        glyph = glyf[gid]
        pen = SVGPathPen(glyph)
        glyph.draw(pen, glyf)
        d = pen.getCommands()
        if d:
            paths.append(
                f'<path transform="translate({pen_x:.1f},0)" d="{d}"/>'
            )
        pen_x += hmtx[gid][0] + tracking
    width = pen_x * scale
    inner = ''.join(paths)
    return (
        f'<g transform="translate({x:.2f},{-y:.2f}) scale(1,-1) scale({scale:.6f})" fill="{fill}">'
        f'{inner}</g>'
    ), width


def text_width(font_path: Path, text: str, size: float, tracking: float = 0.0) -> float:
    font = TTFont(str(font_path))
    upm = font['head'].unitsPerEm
    cmap = font.getBestCmap()
    hmtx = font['hmtx']
    scale = size / upm
    pen_x = 0.0
    for ch in text:
        if ch == ' ':
            pen_x += hmtx[cmap[0x20]][0] * 0.55
            continue
        pen_x += hmtx[cmap[ord(ch)]][0] + tracking
    return pen_x * scale


def mark_group(fill: str, x: float, y: float, height: float) -> str:
    """K-mark scaled to `height` font units tall (mark box is 896 tall, 861 wide,
    origin at (-24,-838) with y-up)."""
    s = height / 896.0
    return (
        f'<g transform="translate({x:.2f},{-y:.2f}) scale({s:.6f})" fill="{fill}">'
        f'<path d="{K_MARK_PATHS}"/><path d="{K_WIRE_PATH}"/>'
        f'<circle cx="95" cy="700" r="10.0"/></g>'
    )


# ---------------------------------------------------------------------------
# Layout — mirrors src/components/shell/logo.tsx at size 'md':
#   mark 40px high, gap 10px, wordmark 20px Playfair bold (cap-height aligned
#   optically: wordmark centred on the mark's optical middle), subtitle 9px
#   Marcellus tracked +15%, sitting 4px under the wordmark baseline.
# We author in a 1000-unit-tall coordinate space and scale per variant.
# ---------------------------------------------------------------------------
def primary_lockup(color: str, sub_color: str, with_subtitle: bool = True) -> str:
    H = 1000.0                      # authoring height in units
    mark_h = 620.0                  # mark height
    word_size = 300.0               # "Kozy Care" size (units)
    sub_size = 130.0                # subtitle size
    gap = 140.0                     # gap between mark and wordmark

    mark_x = 0.0
    mark_y = 60.0                   # bottom of mark
    word_x = mark_x + (861.0 / 896.0 * mark_h) + gap
    # baseline of wordmark: optically centre the cap-height band on the mark
    # Playfair cap height ≈ 0.7 em; x-height ≈ 0.47 em
    word_baseline = mark_y + mark_h * 0.5 - word_size * 0.7 * 0.5 + word_size * 0.06

    word_g, word_w = text_to_group(PLAYFAIR_BOLD, 'Kozy Care', word_size, color,
                                   tracking=8, x=word_x, y=word_baseline)

    total_h = H
    if with_subtitle:
        sub_y = word_baseline - 70.0
        sub_track = 22.0
        sub_g, sub_w = text_to_group(MARCELLUS, 'DRYCLEANING & LAUNDRY', sub_size,
                                     sub_color, tracking=sub_track, x=word_x, y=sub_y)
        total_w = max(word_x + word_w, word_x + sub_w) + 20
        body = mark_group(color, mark_x, mark_y, mark_h) + word_g + sub_g
        vb_y = -(H)  # top edge (y-up space): mark top ≈ 60+620=680; add headroom
        return svg_wrap(body, total_w, total_h, pad=40)
    else:
        total_w = word_x + word_w + 20
        body = mark_group(color, mark_x, mark_y, mark_h) + word_g
        return svg_wrap(body, total_w, mark_h + 120, pad=40)


def print_caps_lockup(color: str) -> str:
    """Mark + KOZY CARE tracked caps (the collateral lockup)."""
    mark_h = 620.0
    word_size = 260.0
    gap = 150.0
    mark_x, mark_y = 0.0, 40.0
    word_x = mark_x + (861.0 / 896.0 * mark_h) + gap
    word_baseline = mark_y + mark_h * 0.5 - word_size * 0.72 * 0.5 + word_size * 0.04
    word_g, word_w = text_to_group(PLAYFAIR_BOLD, 'KOZY CARE', word_size, color,
                                   tracking=26, x=word_x, y=word_baseline)
    total_w = word_x + word_w + 20
    body = mark_group(color, mark_x, mark_y, mark_h) + word_g
    return svg_wrap(body, total_w, mark_h + 120, pad=40)


def svg_wrap(body: str, w: float, h: float, pad: float = 40) -> str:
    """Wrap in an SVG with a y-up viewBox (negative y since our content sits
    above y=0 after flipping)."""
    # content occupies y in [-(pad+h), pad] after the flip; x in [-pad, w+pad]
    vb = f'{-pad} {-pad - h} {w + 2 * pad} {h + 2 * pad}'
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}">{body}</svg>'
    )


def main() -> None:
    variants = []
    for name, (main_c, sub_c) in {
        'navy': (NAVY, '#6F88A8'),
        'white': (WHITE, GOLD),
        'gold': (GOLD, GOLD),
    }.items():
        primary = primary_lockup(main_c, sub_c, with_subtitle=True)
        compact = primary_lockup(main_c, sub_c, with_subtitle=False)
        caps = print_caps_lockup(main_c)
        (OUT / f'kozy-logo-primary-{name}.svg').write_text(primary, encoding='utf-8')
        (OUT / f'kozy-logo-compact-{name}.svg').write_text(compact, encoding='utf-8')
        (OUT / f'kozy-logo-print-caps-{name}.svg').write_text(caps, encoding='utf-8')
        variants += [f'kozy-logo-primary-{name}.svg', f'kozy-logo-compact-{name}.svg',
                     f'kozy-logo-print-caps-{name}.svg']
    print(f'BUILT {len(variants)} vector lockups in {OUT}')
    for v in variants:
        print('  -', v)


if __name__ == '__main__':
    main()
