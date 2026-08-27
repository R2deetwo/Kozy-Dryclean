#!/usr/bin/env python3
"""Trigger a production deploy of Kozy-Dryclean via the Vercel API and verify it goes READY.
Token is read from the VERCEL_TOKEN env var (never hardcoded)."""
import json
import os
import sys
import time
import urllib.request

TOKEN = os.environ.get('VERCEL_TOKEN', '')
if not TOKEN:
    sys.exit('VERCEL_TOKEN env var required')
TEAM = 'team_RJD4xe4C4h3TiJ3M3iEa8idV'
PROJECT = 'prj_BUv0ZqDMzsONFBQXXCgBJfmIN43e'
BASE = 'https://api.vercel.com'
SHA = sys.argv[1] if len(sys.argv) > 1 else None


def call(method, path, body=None):
    req = urllib.request.Request(
        f'{BASE}{path}?teamId={TEAM}',
        data=json.dumps(body).encode() if body else None,
        method=method,
        headers={'Authorization': f'Bearer {TOKEN}',
                 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or '{}')


if not SHA:
    st, me = call('GET', '/v2/user')
    print('user:', me.get('user', {}).get('username', '?'))
    sys.exit('usage: deploy.py <commit-sha>')

body = {
    'name': 'kozy-dryclean',
    'project': PROJECT,
    'target': 'production',
    'gitSource': {
        'type': 'github',
        'org': 'R2deetwo',
        'repo': 'Kozy-Dryclean',
        'ref': 'main',
        'sha': SHA,
    },
}
st, dep = call('POST', '/v13/deployments', body)
if st not in (200, 201, 202):
    print('deploy create failed:', st, json.dumps(dep)[:400])
    sys.exit(1)
dep_id = dep.get('id') or dep.get('deployment', {}).get('id')
print(f'deployment created: {dep_id} — polling...')
url = f'https://kozy-dryclean.vercel.app'
for i in range(60):
    time.sleep(8)
    st, d = call('GET', f'/v13/deployments/{dep_id}')
    state = (d.get('readyState') or d.get('status') or '?').upper()
    print(f'  [{i*8+3:3d}s] {state}')
    if state == 'READY':
        print(f'✓ READY — production serving {SHA[:7]}')
        sys.exit(0)
    if state in ('ERROR', 'CANCELED'):
        print('✗ deploy failed:', json.dumps(d)[:400])
        sys.exit(1)
print('timeout waiting for READY')
sys.exit(1)
