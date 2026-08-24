#!/usr/bin/env python3
"""Bulk replace emerald color references with Kozy navy/gold palette."""
import re
from pathlib import Path

REPLACEMENTS = [
    # Order summary bar at bottom
    ('bg-foreground px-4 py-3 text-background', 'bg-navy px-4 py-3 text-white'),
    # Progress step circles
    ('bg-emerald-600 text-white ring-emerald-600/30', 'bg-navy text-white ring-gold-400/30'),
    ('bg-emerald-100 text-emerald-700 ring-emerald-200', 'bg-gold-100 text-navy ring-gold-200'),
    # Radio option selections
    ('border-emerald-500 bg-emerald-50/50', 'border-gold-400 bg-gold-50/50'),
    ('bg-emerald-100 text-emerald-700', 'bg-gold-100 text-navy'),
    # B2B corporate card
    ('border-emerald-200 bg-emerald-50/50', 'border-gold-200 bg-gold-50/50'),
    ('text-emerald-700', 'text-navy-300'),
    ('text-emerald-900', 'text-navy'),
    ('text-emerald-800', 'text-navy-300'),
    # Continue button
    ('bg-emerald-600 px-6 hover:bg-emerald-700', 'bg-gold-gradient px-6 hover:opacity-90 text-navy'),
    # Photo uploader
    ('border-dashed border-emerald-300', 'border-dashed border-gold-300'),
    ('border-emerald-300 text-emerald-700 hover:bg-emerald-50', 'border-gold-300 text-navy hover:bg-gold-50'),
    ('ring-emerald-200', 'ring-gold-200'),
    ('bg-emerald-50/60 p-3 text-sm', 'bg-gold-50/60 p-3 text-sm'),
    ('accent-emerald-600', 'accent-gold-400'),
    ('bg-emerald-100 px-4 py-3 text-sm text-emerald-900', 'bg-gold-100 px-4 py-3 text-sm text-navy'),
    # Time slots
    ('border-emerald-500 bg-emerald-50 text-emerald-900', 'border-navy bg-navy-50 text-navy'),
    ('hover:border-emerald-300', 'hover:border-gold-300'),
    # Logistics
    ('shrink-0 text-emerald-600', 'shrink-0 text-gold-400'),
    # Order summary line
    ('text-xl font-bold text-emerald-700', 'text-xl font-bold text-navy'),
    # Receipt uploaded badge
    ('bg-emerald-50 px-3 py-2 text-xs text-emerald-800 ring-1 ring-emerald-200', 'bg-gold-50 px-3 py-2 text-xs text-navy ring-1 ring-gold-200'),
    # Checkout
    ('border-emerald-200 bg-emerald-50/40', 'border-gold-200 bg-gold-50/40'),
    # Continue button primary
    ('rounded-full bg-emerald-600 hover:bg-emerald-700', 'rounded-full bg-gold-gradient text-navy hover:opacity-90'),
    # Pay & Confirm
    ('bg-emerald-600 px-6 hover:bg-emerald-700', 'bg-gold-gradient px-6 hover:opacity-90 text-navy'),
    # Page background gradient
    ('bg-gradient-to-b from-emerald-50/30 to-white', 'bg-gradient-to-b from-linen-200 to-white'),
    # Photos badge border
    ('ring-1 ring-emerald-300', 'ring-1 ring-gold-300'),
    # Bank transfer card
    ('border-emerald-200 bg-emerald-50/40', 'border-gold-200 bg-gold-50/40'),
    # General text-emerald
    ('text-emerald-600', 'text-gold-400'),
    # Take photos button color
    ('rounded-lg bg-emerald-100 text-emerald-700', 'rounded-lg bg-gold-100 text-navy'),
    # Order pipeline stage active
    ('bg-emerald-500', 'bg-navy'),
]

paths = [
    'src/components/customer/booking-wizard.tsx',
    'src/components/customer/customer-dashboard.tsx',
    'src/components/customer/order-detail-modal.tsx',
    'src/components/customer/invoice-view.tsx',
    'src/components/customer/customer-portal.tsx',
    'src/components/admin/admin-dashboard.tsx',
    'src/components/admin/kanban-board.tsx',
    'src/components/admin/payment-queue.tsx',
    'src/components/admin/order-detail-modal.tsx',
    'src/components/admin/customers-view.tsx',
    'src/components/admin/finance-view.tsx',
    'src/components/admin/notifications-panel.tsx',
    'src/components/driver/driver-view.tsx',
    'src/components/shared/order-pipeline.tsx',
]

root = Path('/home/z/my-project')
total_replacements = 0
for rel in paths:
    p = root / rel
    if not p.exists():
        print(f'skip {rel}: not found')
        continue
    text = p.read_text(encoding='utf-8')
    original = text
    for old, new in REPLACEMENTS:
        count = text.count(old)
        if count > 0:
            text = text.replace(old, new)
            total_replacements += count
    if text != original:
        p.write_text(text, encoding='utf-8')
        print(f'updated {rel}')
    else:
        print(f'no change {rel}')

print(f'\nTotal replacements: {total_replacements}')
