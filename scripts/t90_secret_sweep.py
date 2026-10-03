#!/usr/bin/env python3
"""Task 90: sweep the repo for old Vercel token values leaked into scripts.

GitHub push protection flagged 5 script locations carrying Vercel Personal
Access Tokens. This extracts the token values from those lines and scans
every git-tracked file for the same values so the purge list is complete.
Values are never printed in full (masked to 6 chars).
"""
import os
import re
import subprocess

os.chdir('/home/z/my-project')

FLAGGED = {
    'scripts/add_mx_records.py': 2,
    'scripts/revert_sender_env.py': 2,
    'scripts/wire_inbound_email.py': 9,
    'scripts/p55_pull_env.py': 9,
    'scripts/t70_preflight.py': 10,
}
SKIP_EXT = ('.png', '.jpg', '.jpeg', '.webp', '.pdf', '.ico', '.svg', '.dump', '.sql')

tokens = set()
for f, ln in FLAGGED.items():
    try:
        line = open(f, encoding='utf-8', errors='ignore').read().splitlines()[ln - 1]
        for m in re.findall(r'[A-Za-z0-9_-]{20,}', line):
            if m.lower() not in ('postgresql',):
                tokens.add(m)
    except Exception as e:
        print(f'WARN {f}: {e}')

print(f'distinct old-token values extracted: {len(tokens)}')

tracked = subprocess.run(['git', 'ls-files'], capture_output=True, text=True).stdout.split()
hits = {}
for f in tracked:
    if f.endswith(SKIP_EXT) or not os.path.isfile(f):
        continue
    try:
        body = open(f, encoding='utf-8', errors='ignore').read()
    except Exception:
        continue
    for t in tokens:
        if t in body:
            hits.setdefault(f, []).append(t[:6] + '...')

print('--- files carrying old token values ---')
for f, ts in sorted(hits.items()):
    print(f'{f}: {", ".join(ts)}')
print(f'total files carrying old tokens: {len(hits)}')

with open('tool-results/t90_vtoken_files.txt', 'w') as fh:
    fh.write('\n'.join(sorted(hits)))
