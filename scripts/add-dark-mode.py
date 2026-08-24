#!/usr/bin/env python3
"""Add dark mode variants to remaining components."""
from pathlib import Path

REPLACEMENTS = [
    # Booking wizard page background
    ('min-h-screen bg-gradient-to-b from-linen-200 to-white', 'min-h-screen bg-gradient-to-b from-linen-200 to-white dark:from-navy-900 dark:to-navy-800'),
    # Customer dashboard header text colors
    ('text-foreground hover:text-navy dark:text-white', 'text-navy dark:text-white'),
    # General foreground -> navy
    ('text-foreground/80', 'text-navy-300 dark:text-navy-200'),
    ('text-foreground', 'text-navy dark:text-white'),
    # Muted foreground -> navy-300
    ('text-muted-foreground hover:text-navy', 'text-navy-300 dark:text-navy-200'),
    ('text-muted-foreground', 'text-navy-300 dark:text-navy-200'),
    # Muted backgrounds
    ('bg-muted/40', 'bg-linen-200 dark:bg-navy-700'),
    ('bg-muted/30', 'bg-linen-200 dark:bg-navy-700'),
    ('bg-muted/20', 'bg-linen-100 dark:bg-navy-700'),
    ('bg-muted text-muted-foreground', 'bg-linen-200 text-navy-300 dark:bg-navy-700 dark:text-navy-200'),
    ('bg-muted', 'bg-linen-200 dark:bg-navy-700'),
    # White cards in dark mode
    ('border-muted/60 shadow-sm', 'border-navy-100 shadow-navy dark:border-navy-600 dark:bg-navy-800'),
    ('border-muted/60', 'border-navy-100 dark:border-navy-600'),
    # borders
    ('border-muted', 'border-navy-100 dark:border-navy-600'),
    # foreground muted on dark
    ('text-muted-foreground hover:text-foreground', 'text-navy-300 hover:text-navy dark:text-navy-200 dark:hover:text-white'),
    # Tabs
    ('bg-muted-foreground/15 text-foreground hover:bg-muted-foreground/15', 'bg-navy-100/40 text-navy dark:bg-navy-600 dark:text-white'),
    # hover backgrounds
    ('hover:bg-muted/60 hover:text-foreground', 'hover:bg-linen-200 hover:text-navy dark:hover:bg-navy-600 dark:hover:text-white'),
    ('hover:bg-muted/40', 'hover:bg-linen-200 dark:hover:bg-navy-600'),
    ('hover:bg-muted/30', 'hover:bg-linen-100 dark:hover:bg-navy-700'),
    # Sidebar / drawer backgrounds
    ('bg-muted', 'bg-linen-200 dark:bg-navy-700'),
]

paths = [
    'src/components/admin/admin-dashboard.tsx',
    'src/components/admin/kanban-board.tsx',
    'src/components/admin/payment-queue.tsx',
    'src/components/admin/order-detail-modal.tsx',
    'src/components/admin/customers-view.tsx',
    'src/components/admin/finance-view.tsx',
    'src/components/admin/notifications-panel.tsx',
    'src/components/customer/order-detail-modal.tsx',
    'src/components/customer/invoice-view.tsx',
    'src/components/customer/booking-wizard.tsx',
    'src/components/customer/customer-landing.tsx',
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
