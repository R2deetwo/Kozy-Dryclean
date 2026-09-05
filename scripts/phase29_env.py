#!/usr/bin/env python3
"""Phase-29 production env hygiene (Vercel API):
- DELETE the two dead concierge@kozy.ng vars (unreferenced by code since the
  phase-23 purge; leaving them is a landmine for any future code that reads
  a company-email env var and suddenly surfaces the fake address).
- CREATE the two phase-29 rate-limit vars (explicit in the dashboard = the
  owner can see and retune them without a code change).
Token comes from the VERCEL_TOKEN env var (never hardcoded)."""
import json
import os
import sys
import urllib.request
import urllib.error

TOKEN = os.environ.get('VERCEL_TOKEN', '')
if not TOKEN:
    sys.exit('VERCEL_TOKEN env var required')
TEAM = 'team_RJD4xe4C4h3TiJ3M3iEa8idV'
PROJECT = 'prj_BUv0ZqDMzsONFBQXXCgBJfmIN43e'
BASE = 'https://api.vercel.com'


def call(method, path, body=None):
    req = urllib.request.Request(
        f'{BASE}{path}?teamId={TEAM}',
        data=json.dumps(body).encode() if body else None,
        method=method,
        headers={'Authorization': f'Bearer {TOKEN}',
                 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read().decode() or '{}')
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or '{}')


# --- current vars ---
st, data = call('GET', f'/v9/projects/{PROJECT}/env')
if st != 200:
    sys.exit(f'list failed: {st}')
envs = {e['key']: e for e in data.get('envs', [])}

# --- 1. purge the fake concierge address from dead slots ---
for key in ('NEXT_PUBLIC_COMPANY_EMAIL', 'POSTMARK_SENDER_EMAIL'):
    e = envs.get(key)
    if e and 'concierge' in (e.get('value') or ''):
        st, _ = call('DELETE', f'/v9/projects/{PROJECT}/env/{e["id"]}')
        print(f'deleted {key} (concierge): {st}')
    else:
        print(f'{key}: not concierge-valued or absent — left alone')

# --- 2. create the phase-29 rate-limit overrides (explicit, discoverable) ---
for key, val in (('RATE_LIMIT_GUEST_BOOKINGS_PER_HOUR', '20'),
                 ('RATE_LIMIT_USER_BOOKINGS_PER_HOUR', '30')):
    if key in envs:
        print(f'{key}: already set — left alone')
        continue
    st, _ = call('POST', f'/v9/projects/{PROJECT}/env', {
        'key': key, 'value': val, 'target': ['production', 'preview'],
        'type': 'plain'})
    print(f'created {key}={val}: {st}')
