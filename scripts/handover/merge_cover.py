#!/usr/bin/env python3
"""Merge cover + body into the final handover PDF (normalized to A4)."""
from pypdf import PdfReader, PdfWriter

A4_W, A4_H = 595.28, 841.89
COVER = '/home/z/my-project/scripts/handover/handover-cover.pdf'
BODY = '/home/z/my-project/download/Kozy-Care-Project-Handover.pdf'
OUT = '/home/z/my-project/download/Kozy-Care-Project-Handover.pdf'


def normalize(page):
    w, h = float(page.mediabox.width), float(page.mediabox.height)
    if abs(w - A4_W) > 0.1 or abs(h - A4_H) > 0.1:
        page.scale_to(A4_W, A4_H)
    return page


writer = PdfWriter()
writer.add_page(normalize(PdfReader(COVER).pages[0]))
for p in PdfReader(BODY).pages:
    writer.add_page(normalize(p))
writer.add_metadata({
    '/Title': 'Kozy Care — Project Handover & Operations Guide',
    '/Author': 'Z.ai',
    '/Creator': 'Z.ai',
    '/Subject': 'Kozy Care platform and brand handover: client operations guide and developer documentation',
})
with open(OUT, 'wb') as f:
    writer.write(f)
print(f'OK merged: {OUT} ({len(writer.pages)} pages)')
