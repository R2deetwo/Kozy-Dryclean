#!/usr/bin/env python3
"""Final cleanup of remaining emerald refs to align with Kozy palette."""
from pathlib import Path

REPLACEMENTS = [
    # highlight border
    ('border-emerald-400 ring-2 ring-gold-200', 'border-gold-400 ring-2 ring-gold-200'),
    ('hover:border-emerald-200', 'hover:border-gold-200'),
    # Badges (guarantee badge etc) — use gold
    ('bg-emerald-100 text-navy-300 hover:bg-emerald-100', 'bg-gold-100 text-navy hover:bg-gold-100'),
    ('bg-emerald-50 text-navy-300', 'bg-gold-50 text-navy-300'),
    # Photo uploader button border/text
    ('border-emerald-300 text-navy-300 hover:bg-emerald-50', 'border-gold-300 text-navy hover:bg-gold-50'),
    # Guarantee activated banner
    ('rounded-xl bg-emerald-100 px-4 py-3 text-sm text-navy', 'rounded-xl bg-gold-100 px-4 py-3 text-sm text-navy'),
    # Time slot selected
    ('border-emerald-500 bg-emerald-50 text-navy', 'border-navy bg-navy-50 text-navy'),
    # Receipt uploaded info banner
    ('rounded-lg bg-emerald-50 px-3 py-2 text-xs text-navy-300 ring-1 ring-gold-200', 'rounded-lg bg-gold-50 px-3 py-2 text-xs text-navy-300 ring-1 ring-gold-200'),
    # Driver info section in order modal
    ('rounded-lg bg-emerald-50/50 p-3 text-sm ring-1 ring-emerald-100', 'rounded-lg bg-gold-50/50 p-3 text-sm ring-1 ring-gold-100'),
    # Invoice header gradient
    ('from-teal-600 to-emerald-600', 'from-navy to-navy-500'),
    ('text-emerald-50', 'text-gold-100'),
    # Invoice verified payment banner
    ('rounded-lg bg-emerald-50 p-4 text-sm ring-1 ring-emerald-100', 'rounded-lg bg-gold-50 p-4 text-sm ring-1 ring-gold-100'),
    # Invoice guarantee note
    ('rounded-lg bg-emerald-50/50 p-3 text-xs text-navy-300 ring-1 ring-emerald-100', 'rounded-lg bg-gold-50/50 p-3 text-xs text-navy-300 ring-1 ring-gold-100'),
    # Order pipeline ring
    ('ring-emerald-500/30', 'ring-gold-400/30'),
    # Pipeline stage done dot
    ('bg-navy-500/20 text-gold-400', 'bg-navy-500/20 text-gold-400'),
    # Remaining emerald-200 etc.
    ('hover:border-emerald-300', 'hover:border-gold-300'),
    ('border-emerald-300', 'border-gold-300'),
    ('bg-emerald-50/50', 'bg-gold-50/50'),
    ('bg-emerald-100', 'bg-gold-100'),
    ('bg-emerald-50', 'bg-gold-50'),
    ('text-emerald-700', 'text-navy-300'),
    ('text-emerald-800', 'text-navy-300'),
    ('text-emerald-900', 'text-navy'),
    ('text-emerald-600', 'text-gold-400'),
    ('text-emerald-500', 'text-gold-400'),
    ('text-emerald-300', 'text-gold-300'),
    ('ring-emerald-100', 'ring-gold-100'),
    ('ring-emerald-200', 'ring-gold-200'),
    ('ring-emerald-300', 'ring-gold-300'),
    ('bg-emerald-600/30', 'bg-gold-400/30'),
    ('border-emerald-500', 'border-gold-400'),
]

paths = [
    'src/components/customer/booking-wizard.tsx',
    'src/components/customer/customer-dashboard.tsx',
    'src/components/customer/order-detail-modal.tsx',
    'src/components/customer/invoice-view.tsx',
    'src/components/admin/kanban-board.tsx',
    'src/components/admin/payment-queue.tsx',
    'src/components/admin/order-detail-modal.tsx',
    'src/components/admin/customers-view.tsx',
    'src/components/admin/finance-view.tsx',
    'src/components/admin/admin-dashboard.tsx',
    'src/components/admin/notifications-panel.tsx',
    'src/components/driver/driver-view.tsx',
    'src/components/shared/order-pipeline.tsx',
]

root = Path('/home/z/my-project')
total = 0
for rel in paths:
    p = root / rel
    if not p.exists():
        continue
    text = p.read_text(encoding='utf-8')
    original = text
    for old, new in REPLACEMENTS:
        count = text.count(old)
        if count > 0:
            text = text.replace(old, new)
            total += count
    if text != original:
        p.write_text(text, encoding='utf-8')
        print(f'updated {rel}')

print(f'\nTotal: {total}')
