#!/usr/bin/env python3
"""Phase 37 E2E — layman-friendly campaign emails + accident guards.

Runs against the LOCAL dev server (port 3000, embedded Postgres, NO
BREVO_API_KEY — emails are physically impossible here; sendEmail logs
a warning and skips). Verifies:

 1. Composer preview: plain text with **bold**, *italic*, pasted links,
    multiple paragraphs and a <script> injection attempt -> rendered as
    safe HTML in the exact email wrapper (escaped script, friendly footer)
 2. Campaign creation from plain text -> stored as converted HTML
 3. ACCIDENT GUARD: live send before any test -> 409 TEST_FIRST
 4. Test send -> 200 (owner's inbox only) and testSentAt recorded
 5. Audience count endpoint -> 3 customers + 1 subscriber = 4
 6. Live send after test -> 200, SENT, 4 recipients
 7. Saved-campaign preview -> exact email HTML with test-copy banner
 8. NewsletterCampaign list exposes testSentAt (drives the Tested chip)
"""
import json
import sys
import urllib.request
import urllib.error

BASE = 'http://localhost:3000'
ADMIN = ('admin37@kozy-test.example', 'Phase37!Admin2026')

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


def req(method: str, path: str, body=None, cookies=None, csrf=None, raw=False):
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
        resp = urllib.request.urlopen(r, timeout=60)
        raw_text = resp.read().decode()
        if raw:
            return resp.status, raw_text, resp.headers
        return resp.status, (json.loads(raw_text) if raw_text else {}), resp.headers
    except urllib.error.HTTPError as e:
        raw_text = e.read().decode()
        if raw:
            return e.code, raw_text, e.headers
        try:
            return e.code, json.loads(raw_text), e.headers
        except Exception:
            return e.code, {}, e.headers


def login(email, password):
    s, body, h = req('GET', '/api/auth/csrf')
    csrf = body['csrfToken']
    cookie = h.get('Set-Cookie', '').split(';')[0]
    s2, body2, h2 = req(
        'POST', '/api/auth/callback/credentials',
        {'email': email, 'password': password, 'csrfToken': csrf, 'json': 'true'},
        cookies=cookie, csrf=csrf,
    )
    set_cookies = h2.get_all('Set-Cookie') or []
    session = None
    for sc in set_cookies:
        if 'authjs.session-token' in sc or 'next-auth.session-token' in sc:
            session = sc.split(';')[0]
    return session, csrf


def main():
    session, csrf = login(*ADMIN)
    check('admin login', session is not None)

    message = (
        'Hello Kozy family,\n\n'
        'This weekend only: **12% off every suit** and *free delivery* for orders above 20,000.\n\n'
        'Tap here to book: https://kozycare.ng/book\n\n'
        'We take good care of your clothes — <script>alert(1)</script> never stands a chance.\n\n'
        '— The Kozy Care team'
    )

    # 1) Composer preview renders plain text as safe, pretty email HTML
    s, html, _ = req('POST', '/api/marketing/preview', {'bodyText': message}, cookies=session, raw=True)
    check('preview 200', s == 200, f'status={s}')
    check('preview bold', '<strong>12% off every suit</strong>' in html)
    check('preview italic', '<em>free delivery</em>' in html)
    check('preview paragraphs', html.count('<p style="margin: 0 0 16px 0;">') == 5, f'paras={html.count("<p")}')
    check('preview link tracked', 'url=https%3A%2F%2Fkozycare.ng%2Fbook' in html and '/api/marketing/track/click?' in html)
    check('preview script escaped', '<script>alert(1)</script>' not in html and '&lt;script&gt;' in html)
    check('preview banner', 'Test copy' in html)
    check('preview friendly footer', 'order emails' in html.replace('&#x27;', "'").replace('&rsquo;', "'") or 'keep coming as normal' in html)
    check('preview unsubscribe', '/api/marketing/unsubscribe?token=' in html)
    check('preview tracking pixel', '/api/marketing/track/open' in html)

    # 2) Create a campaign from the plain message
    s, body, _ = req(
        'POST', '/api/marketing/campaigns',
        {
            'name': 'Phase 37 verify',
            'subject': 'A friendly weekend note',
            'bodyText': message,
            'segment': 'ALL',
        },
        cookies=session,
    )
    check('create 201', s == 201, f'status={s} body={body}')
    campaign_id = body.get('campaign', {}).get('id')
    stored_html = body.get('campaign', {}).get('htmlContent', '')
    check('stored as converted HTML', '<strong>12% off every suit</strong>' in stored_html and stored_html.count('<p') == 5)
    check('stored script escaped', '&lt;script&gt;' in stored_html)
    check('testSentAt starts null', body.get('campaign', {}).get('testSentAt') is None)

    # 3) ACCIDENT GUARD: live send refused before any test
    s, body, _ = req('POST', f'/api/marketing/campaigns/{campaign_id}/send', {}, cookies=session)
    check('live send refused (TEST_FIRST)', s == 409 and body.get('code') == 'TEST_FIRST', f'status={s} body={body}')

    # 4) Test send (goes only to the admin's own inbox; skipped locally — no key)
    s, body, _ = req('POST', f'/api/marketing/campaigns/{campaign_id}/send', {'test': True}, cookies=session)
    check('test send 200', s == 200, f'status={s} body={body}')
    s, body, _ = req('GET', '/api/marketing/campaigns', cookies=session)
    camp = next((c for c in body.get('campaigns', []) if c['id'] == campaign_id), {})
    check('testSentAt recorded', camp.get('testSentAt') is not None)

    # 5) Audience count = 3 customers + 1 subscriber
    s, body, _ = req('GET', f'/api/marketing/campaigns/{campaign_id}/audience', cookies=session)
    check('audience count 4', s == 200 and body.get('count') == 4, f'status={s} body={body}')
    check('audience tested flag', body.get('tested') is True)

    # 6) Live send now allowed
    s, body, _ = req('POST', f'/api/marketing/campaigns/{campaign_id}/send', {}, cookies=session)
    check('live send 200', s == 200, f'status={s} body={body}')
    check('live sent to 4', body.get('sentCount') == 4, f'body={body}')
    s, body, _ = req('GET', '/api/marketing/campaigns', cookies=session)
    camp = next((c for c in body.get('campaigns', []) if c['id'] == campaign_id), {})
    check('campaign SENT + delivered 4', camp.get('status') == 'SENT' and camp.get('deliveredCount') == 4)

    # 7) Saved-campaign preview (exact email as customers saw it)
    s, html, _ = req('GET', f'/api/marketing/campaigns/{campaign_id}/preview', cookies=session, raw=True)
    check('saved preview 200', s == 200)
    check('saved preview has subject content', '12% off every suit' in html)
    check('saved preview banner', 'Test copy' in html)

    # 8) RBAC: anonymous can't preview
    s, _, _ = req('GET', f'/api/marketing/campaigns/{campaign_id}/preview', raw=True)
    check('preview requires admin', s == 401 or s == 403, f'status={s}')

    print(f'\nRESULT: {passed} passed, {failed} failed')
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
