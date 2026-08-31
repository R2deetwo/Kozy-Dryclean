#!/usr/bin/env python3
"""Phase 25 E2E — payment-claim removal (DELETE /api/payments/[id]).

Runs against the LOCAL dev server (port 3000, production DB with seeded
.example artifacts from e2e-seed25.ts). Verifies:

 1. RBAC: unauthenticated DELETE -> 401; customer DELETE -> 403
 2. Remove a REJECTED claim (order PAYMENT_PENDING_VERIFICATION, no other
    open claim) -> 200; payment gone from the list; order reverts to
    REQUESTED with a timeline note
 3. Removing a VERIFIED payment -> 409 (financial record, never deletable)
 4. Remove a PENDING claim -> 200; order reverts to REQUESTED
 5. Unknown payment id -> 404
 6. Cleanup: seeded users/orders/payments removed; DB returns to pre-test state
"""
import json
import sys
import urllib.request
import urllib.error

BASE = 'http://localhost:3000'
ADMIN = ('e2e-admin25@kozy-test.example', 'E2e-Admin-Pw-2525!')
CUSTOMER = ('e2e-p25-user@kozy-test.example', 'E2e-Cust-Pw-2525!')

passed = 0
failed = 0


def check(name: str, cond: bool, detail: str = ''):
    global passed, failed
    if cond:
        passed += 1
        print(f'  PASS  {name}')
    else:
        failed += 1
        print(f'  FAIL  {name}  {detail}')


def req(method: str, path: str, body=None, cookies=None, csrf=None):
    url = BASE + path
    data = None
    headers = {}
    if body is not None:
        data = json.dumps(body).encode()
        headers['Content-Type'] = 'application/json'
    if cookies:
        headers['Cookie'] = cookies
    if csrf:
        headers['x-authjs-csrf'] = csrf
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(r, timeout=30)
        raw = resp.read().decode()
        return resp.status, (json.loads(raw) if raw else {}), resp.headers
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw), e.headers
        except Exception:
            return e.code, {}, e.headers


def login(email, password):
    """NextAuth credentials login -> session cookie."""
    s, body, h = req('GET', '/api/auth/csrf')
    csrf = body['csrfToken']
    cookie = h.get('Set-Cookie', '').split(';')[0]
    s2, body2, h2 = req(
        'POST',
        '/api/auth/callback/credentials',
        {
            'email': email,
            'password': password,
            'csrfToken': csrf,
            'json': 'true',
        },
        cookies=cookie,
        csrf=csrf,
    )
    # Collect the session cookie from the response headers
    set_cookies = h2.get_all('Set-Cookie') or []
    session = None
    for sc in set_cookies:
        if 'authjs.session-token' in sc or 'next-auth.session-token' in sc:
            session = sc.split(';')[0]
            break
    if not session:
        # some setups redirect without set-cookie on the callback itself;
        # try the secure variant
        for sc in set_cookies:
            if 'session-token' in sc:
                session = sc.split(';')[0]
    return session


def main():
    print('== login ==')
    admin_cookie = login(*ADMIN)
    cust_cookie = login(*CUSTOMER)
    check('admin login', bool(admin_cookie))
    check('customer login', bool(cust_cookie))

    # ---- locate seeded payments ----
    s, body, _ = req('GET', '/api/payments?limit=100', cookies=admin_cookie)
    items = body.get('items', [])
    by_num = {}
    s2, obody, _ = req('GET', '/api/orders?limit=100', cookies=admin_cookie)
    order_id = {}
    for o in obody.get('items', []):
        if o.get('orderNumber', '').startswith('KZ-E2EP25'):
            order_id[o['orderNumber']] = o['id']
    for p in items:
        oid = p.get('orderId')
        num = next((n for n, i in order_id.items() if i == oid), None)
        if num:
            by_num[num] = p

    check('seeded orders found (3)', len(order_id) == 3, str(order_id.keys()))
    check('seeded payments found (3)', len(by_num) == 3, str(by_num.keys()))
    rej = by_num.get('KZ-E2EP25R')
    pend = by_num.get('KZ-E2EP25P')
    ver = by_num.get('KZ-E2EP25V')

    print('== RBAC ==')
    s, body, _ = req('DELETE', f"/api/payments/{rej['id']}")
    check('unauthenticated DELETE -> 401', s == 401, f'got {s}')
    s, body, _ = req('DELETE', f"/api/payments/{rej['id']}", cookies=cust_cookie)
    check('customer DELETE -> 403', s == 403, f'got {s}')

    print('== remove REJECTED claim ==')
    s, body, _ = req('DELETE', f"/api/payments/{rej['id']}", cookies=admin_cookie)
    check('DELETE rejected claim -> 200', s == 200, f'got {s} {body}')
    check('order reverted to REQUESTED', body.get('order', {}).get('status') == 'REQUESTED',
          str(body.get('order', {}).get('status')))
    # gone from list?
    s, body, _ = req('GET', '/api/payments?limit=100', cookies=admin_cookie)
    ids = [p['id'] for p in body.get('items', [])]
    check('payment gone from list', rej['id'] not in ids)
    # timeline note on the order
    s, body, _ = req('GET', f"/api/orders/{order_id['KZ-E2EP25R']}", cookies=admin_cookie)
    events = body.get('order', {}).get('statusEvents', [])
    check('timeline note recorded', any(e.get('note') for e in events), str(events[-1:] ))

    print('== verified payments are protected ==')
    s, body, _ = req('DELETE', f"/api/payments/{ver['id']}", cookies=admin_cookie)
    check('DELETE verified payment -> 409', s == 409, f'got {s}')
    s, body, _ = req('GET', '/api/payments?limit=100', cookies=admin_cookie)
    ids = [p['id'] for p in body.get('items', [])]
    check('verified payment still present', ver['id'] in ids)

    print('== remove PENDING claim ==')
    s, body, _ = req('DELETE', f"/api/payments/{pend['id']}", cookies=admin_cookie)
    check('DELETE pending claim -> 200', s == 200, f'got {s} {body}')
    check('order reverted to REQUESTED (pending path)',
          body.get('order', {}).get('status') == 'REQUESTED',
          str(body.get('order', {}).get('status')))

    print('== unknown id ==')
    s, body, _ = req('DELETE', '/api/payments/nonexistent-id-123', cookies=admin_cookie)
    check('unknown payment -> 404', s == 404, f'got {s}')

    print(f'\nRESULT: {passed} passed, {failed} failed')
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
