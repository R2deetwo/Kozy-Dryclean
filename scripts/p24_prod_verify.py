import json
import os
import sys
import urllib.request

from playwright.sync_api import sync_playwright

BASE = os.environ.get("E2E_BASE", "https://kozycare.ng")
EMAIL = "p24-probe@kozy-test.example"
PASSWORD = "P24-Probe-Pw-9917!"
PASS, FAIL = 0, []


def check(name, ok, detail=""):
    global PASS
    if ok:
        PASS += 1
        print(f"  PASS  {name}")
    else:
        FAIL.append(name)
        print(f"  FAIL  {name}  {detail}")


def api(method, path, body=None, cookie=None):
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(body).encode() if body is not None else None,
        method=method,
        headers={
            "Content-Type": "application/json",
            **({"Cookie": cookie} if cookie else {}),
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode() or "{}")
        except Exception:
            return e.code, {}


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context()
        page = ctx.new_page()
        page.goto(f"{BASE}/login")
        page.fill('input[type="email"], #email', EMAIL)
        page.fill('input[type="password"], #password', PASSWORD)
        page.click('button[type="submit"]')
        try:
            page.wait_for_url("**/admin**", timeout=60_000)
        except Exception:
            page.wait_for_timeout(4000)
        cookie = "; ".join(f"{c['name']}={c['value']}" for c in ctx.cookies(BASE))
        check("Probe admin login on production", "/admin" in page.url, f"url={page.url}")
        browser.close()

    st, body = api("GET", "/api/settings/app", cookie=cookie)
    alerts = (body.get("settings") or {}).get("adminAlertsEmail", "")
    check("Admin settings list BOTH alert inboxes",
          "kozygarmentcare@gmail.com" in alerts and "practiceprosystems@gmail.com" in alerts,
          f"adminAlertsEmail={alerts}")

    st, body = api("GET", "/api/admin/notifications?take=10", cookie=cookie)
    check("Notifications feed works on production", st == 200 and "events" in body, f"status={st}")

    st, body = api("POST", "/api/admin/notifications/test", cookie=cookie)
    check("Test alert sent on production", st == 200, f"status={st} body={body}")
    recips = body.get("recipients") or []
    results = body.get("results") or []
    check("Both owners are recipients",
          "kozygarmentcare@gmail.com" in recips and "practiceprosystems@gmail.com" in recips,
          f"recipients={recips}")
    check("Provider accepted BOTH sends",
          len(results) == 2 and all(r.get("ok") for r in results), f"results={results}")

    st, body = api("GET", "/api/admin/notifications?take=5", cookie=cookie)
    evs = body.get("events") or []
    test_ev = next((e for e in evs if e["type"] == "TEST"), None)
    check("TEST event recorded in the production feed", test_ev is not None)
    if test_ev:
        check("TEST event emailStatus SENT", test_ev.get("emailStatus") == "SENT",
              f"status={test_ev.get('emailStatus')}")

    print(f"\n{PASS}/{PASS + len(FAIL)} passed")
    if FAIL:
        print("FAILED:", FAIL)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
