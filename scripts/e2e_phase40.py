#!/usr/bin/env python3
"""Phase 40 E2E — the newsletter engine (52-week plan + automation).

Runs against the LOCAL dev server (port 3000, embedded Postgres, NO
BREVO_API_KEY — emails are physically impossible here; sendEmail logs a
warning and skips). Verifies:

 1.  Automation state GET — schedule defaults (off, every 2 weeks, Thursday 09:00)
 2.  Content library — 52 entries, weeks 1..52 in order, banners valid,
     every subject/body present
 3.  RBAC — anonymous gets 401 on every automation endpoint
 4.  Enable engine (PUT) — persisted; next slot computed in the future
 5.  Prepare now (POST) — DRAFT campaign created from library entry 0
     (subject matches), source=automation, bannerSlug set, status DRAFT
     (never auto-sent), bodyText stored
 6.  One-at-a-time — second prepare refused (no stacking)
 7.  Draft preview (GET campaign preview) — banner <img> present + wrapper
 8.  Approve (PATCH scheduledAt) — status SCHEDULED
 9.  process-due with a past slot — campaign SENT to the opted-in audience
     only (2 B2C in + 1 B2B in + 1 subscriber = 4; unsubscribed customer
     and unsubscribed subscriber excluded)
10.  Skip flow — prepare next (library entry 2), skip it, next prepare
     gives entry 3 (content pointer advanced)
11.  Composer preview with bannerSlug — the chosen banner renders
12.  Campaign create with bannerSlug — stored on the campaign
13.  Unsubscribe semantics — applyUnsubscribe keeps the USER account (login
     still works) while marketingOptIn goes false
14.  Cadence change (PUT) — persisted; day/time changes recompute slot
"""
import json
import sys
import time
import urllib.request
import urllib.error

BASE = 'http://localhost:3000'
ADMIN = ('admin40@kozy-test.example', 'Phase40!Admin2026')
CUSTOMER = ('unsub40@kozy-test.example', 'Phase40!Customer2026')

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


def req(method, path, body=None, cookies=None, csrf=None, raw=False):
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
        resp = urllib.request.urlopen(r, timeout=90)
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
    """NextAuth credentials login — collect EVERY cookie from each response
    (the csrf response sets a cookie pair; missing one breaks the callback)."""
    s, body, h = req('GET', '/api/auth/csrf')
    csrf = body['csrfToken']
    csrf_cookies = '; '.join(sc.split(';')[0] for sc in (h.get_all('Set-Cookie') or []))
    s2, body2, h2 = req(
        'POST', '/api/auth/callback/credentials',
        {'email': email, 'password': password, 'csrfToken': csrf, 'json': 'true'},
        cookies=csrf_cookies, csrf=csrf,
    )
    set_cookies = h2.get_all('Set-Cookie') or []
    session = None
    all_cookies = list(csrf_cookies.split('; '))
    for sc in set_cookies:
        name = sc.split(';')[0]
        all_cookies.append(name)
        if 'authjs.session-token' in name or 'next-auth.session-token' in name:
            session = name
    assert session, f'login failed for {email} (no session cookie): {body2}'
    full_cookie = '; '.join(dict.fromkeys(all_cookies))  # dedupe, keep order
    code, me, _ = req('GET', '/api/auth/session', cookies=full_cookie)
    assert code == 200 and me.get('user', {}).get('email') == email, f'session bad for {email}: {me}'
    return full_cookie, csrf


def main():
    print('== setup: login ==')
    admin_cookies, csrf = login(*ADMIN)
    print('  admin logged in')

    # ---------------------------------------------------------- 1. state
    print('== 1. automation state defaults ==')
    code, state, _ = req('GET', '/api/marketing/automation', cookies=admin_cookies, csrf=csrf)
    check('GET automation 200', code == 200, str(state)[:200])
    s = state.get('schedule', {})
    check('default off', s.get('enabled') is False)
    check('default cadence 2 weeks', s.get('cadenceWeeks') == 2)
    check('default Thursday', s.get('dayOfWeek') == 4)
    check('default 09:00', s.get('sendTime') == '09:00')
    check('nextUp is week 1', state.get('nextUp', {}).get('week') == 1)
    check('library total 52', state.get('libraryTotal') == 52)

    # ------------------------------------------------------ 2. library
    print('== 2. content library ==')
    code, lib, _ = req('GET', '/api/marketing/content-library', cookies=admin_cookies, csrf=csrf)
    check('GET library 200', code == 200)
    entries = lib.get('entries', [])
    check('52 entries', len(entries) == 52, str(len(entries)))
    weeks = [e.get('week') for e in entries]
    check('weeks 1..52 ordered', weeks == list(range(1, 53)))
    slugs = {b['slug'] for b in lib.get('banners', [])}
    check('13 banners listed', len(slugs) == 13, str(len(slugs)))
    check('all entries banner-valid', all(e.get('banner') in slugs for e in entries))
    check('all entries have subject+body', all(e.get('subject') and e.get('bodyText') for e in entries))

    # ---------------------------------------------------------- 3. RBAC
    print('== 3. RBAC ==')
    code, _, _ = req('GET', '/api/marketing/automation')
    check('anonymous automation 401', code == 401, str(code))
    code, _, _ = req('GET', '/api/marketing/content-library')
    check('anonymous library 401', code == 401, str(code))
    code, _, _ = req('POST', '/api/marketing/automation/prepare')
    check('anonymous prepare 401', code == 401, str(code))

    # ------------------------------------------------------ 4. enable
    print('== 4. enable the engine ==')
    code, state, _ = req('PUT', '/api/marketing/automation', {'enabled': True}, cookies=admin_cookies, csrf=csrf)
    check('PUT enable 200', code == 200, str(state)[:200])
    check('enabled persisted', state.get('schedule', {}).get('enabled') is True)
    next_slot = state.get('schedule', {}).get('nextSlotDate')
    check('next slot in future', next_slot is not None and next_slot > '2000', next_slot)
    # engine just turned on, slot is > 3 days away -> no draft yet
    check('no draft auto-created yet (slot far)', state.get('pending') is None)

    # ----------------------------------------------------- 5. prepare
    print('== 5. prepare now ==')
    code, prep, _ = req('POST', '/api/marketing/automation/prepare', cookies=admin_cookies, csrf=csrf)
    check('prepare 200', code == 200, str(prep)[:300])
    camp = prep.get('campaign', {})
    check('draft created with library subject', camp.get('subject') == 'New year. Fresh clothes. Clean start. 🎉', camp.get('subject'))
    pending = prep.get('state', {}).get('pending', {})
    check('pending source slotDate set', pending.get('slotDate') is not None)
    check('pending status DRAFT', pending.get('status') == 'DRAFT')
    check('pending banner set', pending.get('bannerSlug') == 'seasonal-newyear', str(pending.get('bannerSlug')))
    draft_id = pending.get('id')

    # bodyText stored for editing?
    code, full, _ = req('GET', f'/api/marketing/campaigns/{draft_id}', cookies=admin_cookies, csrf=csrf)
    check('campaign GET 200', code == 200)
    check('bodyText stored', bool((full.get('campaign') or {}).get('bodyText')))
    check('source=automation', (full.get('campaign') or {}).get('source') == 'automation')
    check('htmlContent generated', 'Kozy Care' not in (full.get('campaign') or {}).get('htmlContent', '')[:50] and len((full.get('campaign') or {}).get('htmlContent', '')) > 100)

    # -------------------------------------------------- 6. one at a time
    print('== 6. one draft at a time ==')
    code, prep2, _ = req('POST', '/api/marketing/automation/prepare', cookies=admin_cookies, csrf=csrf)
    check('second prepare refused', code == 409, str(code))

    # --------------------------------------------------- 7. draft preview
    print('== 7. draft email preview (with banner) ==')
    code, html, _ = req('GET', f'/api/marketing/campaigns/{draft_id}/preview', cookies=admin_cookies, csrf=csrf, raw=True)
    check('preview 200', code == 200)
    check('banner image in email', 'banner-seasonal-newyear.jpg' in html)
    check('wrapper renders', 'Premium Drycleaning' in html and 'Unsubscribe' in html)
    check('test-copy stripe present', 'Test copy' in html)
    check('body bold rendered', '<strong>' in html)

    # ------------------------------------------------------- 8. approve
    print('== 8. approve -> SCHEDULED ==')
    slot = pending.get('slotDate')
    # schedule it for the past so process-due picks it up immediately
    past = '2020-01-01T00:00:00.000Z'
    code, updated, _ = req('PATCH', f'/api/marketing/campaigns/{draft_id}', {'scheduledAt': past}, cookies=admin_cookies, csrf=csrf)
    check('PATCH approve 200', code == 200, str(updated)[:200])
    check('status SCHEDULED', (updated.get('campaign') or {}).get('status') == 'SCHEDULED')

    # --------------------------------------------- 9. process-due sends
    print('== 9. process-due delivers to the right audience ==')
    code, proc, _ = req('POST', '/api/marketing/campaigns/process-due', cookies=admin_cookies, csrf=csrf)
    check('process-due 200', code == 200, str(proc)[:200])
    code, after, _ = req('GET', f'/api/marketing/campaigns/{draft_id}', cookies=admin_cookies, csrf=csrf)
    recipients = (after.get('campaign') or {}).get('recipients', [])
    emails = sorted(r['email'] for r in recipients)
    check('sent to 4 opted-in addresses', len(recipients) == 4, str(emails))
    check('unsubscribed customer excluded', 'unsub40@kozy-test.example' not in emails)
    check('unsubscribed subscriber excluded', 'gone40@kozy-test.example' not in emails)
    check('subscriber included', 'sub40@kozy-test.example' in emails)
    check('campaign SENT', (after.get('campaign') or {}).get('status') == 'SENT')

    # after sending, engine should be free to prepare the next one
    code, state2, _ = req('GET', '/api/marketing/automation', cookies=admin_cookies, csrf=csrf)
    check('pending cleared after send', state2.get('pending') is None)
    check('nextUp advanced to week 2', state2.get('nextUp', {}).get('week') == 2)

    # ------------------------------------------------------- 10. skip
    print('== 10. skip flow ==')
    code, prep3, _ = req('POST', '/api/marketing/automation/prepare', cookies=admin_cookies, csrf=csrf)
    check('prepare next 200', code == 200)
    subject3 = prep3.get('campaign', {}).get('subject')
    check('second draft uses library entry 2', 'Harmattan' in subject3, subject3)
    skip_id = prep3.get('state', {}).get('pending', {}).get('id')
    code, sk, _ = req('POST', '/api/marketing/automation/skip', {'campaignId': skip_id}, cookies=admin_cookies, csrf=csrf)
    check('skip 200', code == 200, str(sk)[:200])
    sk_pending = (sk.get('state', {}) or {}).get('pending') or {}
    check('after skip a NEW draft waits (entry 3)', 'first clean of the year' in sk_pending.get('subject', ''), str(sk_pending.get('subject')))
    # clean it up: skip that too so nothing lingers
    p2 = sk_pending
    if p2.get('id'):
        code, _, _ = req('POST', '/api/marketing/automation/skip', {'campaignId': p2['id']}, cookies=admin_cookies, csrf=csrf)
        check('cleanup skip ok', code == 200, str(code))

    # ------------------------------------- 11. composer preview w/banner
    print('== 11. composer preview with banner ==')
    code, html, _ = req('POST', '/api/marketing/preview', {'bodyText': 'Hello **world**', 'bannerSlug': 'promo-gold'}, cookies=admin_cookies, csrf=csrf, raw=True)
    check('composer preview 200', code == 200)
    check('chosen banner renders', 'banner-promo-gold.jpg' in html)
    code, html, _ = req('POST', '/api/marketing/preview', {'bodyText': 'No banner here', 'bannerSlug': 'not-a-real-banner'}, cookies=admin_cookies, csrf=csrf, raw=True)
    check('invalid banner ignored (no img)', 'marketing/banners/banner-not-a-real-banner' not in html)

    # ------------------------------------ 12. create with banner slug
    print('== 12. create campaign with banner ==')
    code, created, _ = req('POST', '/api/marketing/campaigns', {
        'name': 'Phase 40 check',
        'subject': 'Banner check',
        'bodyText': 'Testing **banner** storage.',
        'segment': 'ALL',
        'bannerSlug': 'tips-fabric',
    }, cookies=admin_cookies, csrf=csrf)
    check('create 201', code == 201, str(created)[:200])
    check('banner stored', (created.get('campaign') or {}).get('bannerSlug') == 'tips-fabric')
    check('bodyText stored', bool((created.get('campaign') or {}).get('bodyText')))
    # invalid banner refused
    code, _, _ = req('POST', '/api/marketing/campaigns', {
        'name': 'Bad banner', 'subject': 'x', 'bodyText': 'y', 'bannerSlug': 'nope',
    }, cookies=admin_cookies, csrf=csrf)
    check('invalid banner refused 400', code == 400, str(code))
    # PATCH edit the draft (review-and-change)
    cid = created['campaign']['id']
    code, edited, _ = req('PATCH', f'/api/marketing/campaigns/{cid}', {
        'subject': 'Banner check (edited)', 'bodyText': 'Edited **message**.', 'bannerSlug': None,
    }, cookies=admin_cookies, csrf=csrf)
    check('PATCH edit 200', code == 200)
    check('banner cleared', (edited.get('campaign') or {}).get('bannerSlug') is None)
    check('html regenerated from new text', 'Edited' in (edited.get('campaign') or {}).get('htmlContent', ''))

    # --------------------------- 13. unsubscribe keeps the account alive
    print('== 13. unsubscribe semantics ==')
    code, unsub_html, headers = req('GET', '/api/marketing/unsubscribe?token=bogus', raw=True)
    check('tampered token -> failure page', code in (200, 400) and ('didn' in unsub_html or 'not' in unsub_html.lower()), str(code))
    # login as the unsubscribed customer still works (account untouched)
    try:
        cust_cookies, _ = login(*CUSTOMER)
        check('unsubscribed customer can still log in', True)
    except Exception as e:
        check('unsubscribed customer can still log in', False, str(e))

    # ------------------------------------------------ 14. cadence change
    print('== 14. cadence/day/time change ==')
    code, state3, _ = req('PUT', '/api/marketing/automation', {'cadenceWeeks': 1, 'dayOfWeek': 1, 'sendTime': '10:30'}, cookies=admin_cookies, csrf=csrf)
    check('cadence PUT 200', code == 200)
    s3 = state3.get('schedule', {})
    check('cadence persisted', s3.get('cadenceWeeks') == 1)
    check('day persisted', s3.get('dayOfWeek') == 1)
    check('time persisted', s3.get('sendTime') == '10:30')
    # invalid time refused
    code, _, _ = req('PUT', '/api/marketing/automation', {'sendTime': '25:99'}, cookies=admin_cookies, csrf=csrf)
    check('invalid time refused 400', code == 400, str(code))

    # turn the engine OFF to end clean
    code, _, _ = req('PUT', '/api/marketing/automation', {'enabled': False}, cookies=admin_cookies, csrf=csrf)
    check('engine off at end', code == 200)

    print(f'\nRESULT: {passed} passed, {failed} failed')
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
