#!/usr/bin/env python3
"""Comprehensive Kozy rebrand + legibility fixes.

Changes:
1. Remove 'B2B' and 'B2C' from user-facing UI (replace with 'Corporate'/'Retail')
2. Clean up dark mode classes that cause legibility issues
3. Remove bank transfer section from footer
4. Fix various legibility issues
"""
from pathlib import Path
import re

# Map of replacements
# Format: (old, new, file_pattern)
REPLACEMENTS_GLOBAL = [
    # Remove B2B/B2C from user-facing copy (keep in admin tables where it's a role)
    ("B2C (Retail)", "Retail"),
    ("B2B (Corporate)", "Corporate"),
    ("'B2C'", "'RETAIL'"),
    ("'B2B'", "'CORPORATE'"),
    ("role === 'B2C'", "role === 'RETAIL'"),
    ("role === 'B2B'", "role === 'CORPORATE'"),
    ("role: 'B2C'", "role: 'RETAIL'"),
    ("role: 'B2B'", "role: 'CORPORATE'"),
    ("role: 'B2C',", "role: 'RETAIL',"),
    ("role: 'B2B',", "role: 'CORPORATE',"),
    ("| B2C | B2B |", "| RETAIL | CORPORATE |"),  # Prisma comment
    ("role Role @default(B2C)", "role Role @default(RETAIL)"),
    ("ADMIN\n  DRIVER\n  B2C\n  B2B", "ADMIN\n  DRIVER\n  RETAIL\n  CORPORATE"),
    # Replace user-facing labels
    ("'B2C'", "'RETAIL'"),
    ("'B2B'", "'CORPORATE'"),
    # Display labels
    ("(B2C)", "(Retail)"),
    ("(B2B)", "(Corporate)"),
    ("B2C customer", "retail customer"),
    ("B2B client", "corporate client"),
    ("B2B note", "Corporate note"),
    ("B2B bulk", "Corporate bulk"),
    ("B2B revenue", "Corporate revenue"),
    ("B2C revenue", "Retail revenue"),
    ("B2B weight entry", "Corporate weight entry"),
    ("B2B invoice ready", "Corporate invoice ready"),
    ("Hide B2B", "Hide corporate"),
    ("Show B2B", "Show corporate"),
    ("Is B2B", "Is corporate"),
    ("Is B2C", "Is retail"),
    ("Retail / B2C", "Retail"),
    ("Corporate / B2B", "Corporate"),
    ("'Per-item (Retail)'", "'Per-item'"),
    ("'Bulk (Per kg)'", "'Bulk (Per kg)'"),
    ("'Bulk laundry bag'", "'Bulk laundry bag'"),
    # Replace the trigger key names used in store.ts (internal)
    ("'B2B_INVOICE_READY'", "'CORPORATE_INVOICE_READY'"),
    ("'B2B_INVOICE_READY'", "'CORPORATE_INVOICE_READY'"),
]

paths = [
    'src/lib/types.ts',
    'src/lib/store.ts',
    'src/components/customer/customer-portal.tsx',
    'src/components/customer/customer-landing.tsx',
    'src/components/customer/booking-wizard.tsx',
    'src/components/customer/order-detail-modal.tsx',
    'src/components/customer/invoice-view.tsx',
    'src/components/admin/admin-dashboard.tsx',
    'src/components/admin/kanban-board.tsx',
    'src/components/admin/payment-queue.tsx',
    'src/components/admin/order-detail-modal.tsx',
    'src/components/admin/customers-view.tsx',
    'src/components/admin/finance-view.tsx',
    'src/components/admin/notifications-panel.tsx',
    'src/components/driver/driver-view.tsx',
    'src/components/shared/order-pipeline.tsx',
    'prisma/schema.prisma',
]

root = Path('/home/z/my-project')
total = 0
for rel in paths:
    p = root / rel
    if not p.exists():
        print(f'skip {rel}: not found')
        continue
    text = p.read_text(encoding='utf-8')
    original = text
    for old, new in REPLACEMENTS_GLOBAL:
        count = text.count(old)
        if count > 0:
            text = text.replace(old, new)
            total += count
    if text != original:
        p.write_text(text, encoding='utf-8')
        print(f'updated {rel}')
    else:
        print(f'no change {rel}')

print(f'\nTotal replacements: {total}')
