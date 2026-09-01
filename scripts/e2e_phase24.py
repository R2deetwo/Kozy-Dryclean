"""Phase-24 E2E — admin visibility + stage-email dedup + multi-recipient alerts.
Against the local production build (localhost:3100, production DB), with the
admin alert address temporarily pointed at e2e-alerts@kozy-test.example:
  1. /api/admin/notifications: admin GET works (events + unread), B2C gets 403
  2. Signup -> NEW_SIGNUP event in the feed with emailStatus SENT to the
     configured test recipient (alerts no longer depend on the owner's inbox)
  3. payments POST ("I have made the payment") -> TRANSFER_PENDING event,
     exactly ONE per order (duplicate submission adds no second event)
  4. Stage-email dedup: orders PATCH moves E: PICKED_UP(2) -> PROCESSING(4)
     -> back to PAYMENT_VERIFIED (stays 4) -> FINISHING(5) -> back to
     PROCESSING (stays 5): lastNotifiedStage is monotonic — a stage email can
     never repeat and backwards moves are silent
  5. Payment verify dedup: order F verify -> REJECT -> re-verify ends VERIFIED,
     order still PAYMENT_VERIFIED, lastNotifiedStage never exceeds 1 (the
     "Payment confirmed" email can only ever send once)
  6. Test-alert endpoint: POST /api/admin/notifications/test returns the
     recipient list + per-address result, and records a TEST event
  7. UI: Notifications tab with unread badge, feed rows with delivery chips,
     Mark-all-read clears the badge; Settings -> Notifications shows the
     comma-separated list + Send-test button
  8. Public settings GET still hides adminAlertsEmail
Artifacts use .example emails and are cleaned up afterwards.
"""

import json
import os
import sys
import time
import urllib.request

from playwright.sync_api import sync_playwright
BASE = os.environ.get("E2E_BASE", "http://localhost:3100")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "e2e-admin22@kozy-test.example")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "E2e-Admin-Pw-7261!")
ALERT_TEST_ADDRESS = "e2e-alerts@kozy-test.example"

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
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, json.loads(r.read().decode() or "{}"), r.headers.get("Set-Cookie")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode() or "{}"), None
        except Exception:
            return e.code, {}, None


def wait_for_event(cookie, predicate, timeout_s=45, take=100):
    """Poll the feed until an event matches; then wait for its emailStatus to
    settle (the row is created before the per-recipient sends complete)."""
    deadline = time.time() + timeout_s
    found = None
    while time.time() < deadline:
        st, body, _ = api("GET", "/api/admin/notifications?take=100", cookie=cookie)
        if st == 200:
            for e in body.get("events", []):
                if predicate(e):
                    found = e
                    break
        if found:
            break
        time.sleep(2)
    if not found:
        return None
    settle = time.time() + 20
    while time.time() < settle:
        st, body, _ = api("GET", "/api/admin/notifications?take=100", cookie=cookie)
        if st == 200:
            for e in body.get("events", []):
                if e["id"] == found["id"] and e.get("emailStatus") != "NONE":
                    return e
        time.sleep(2)
    return found


def main():
    seed = json.loads(os.environ["P24_SEED"])
    user_email, user_pw = seed["email"], seed["password"]
    order_e, order_f = seed["orderE"], seed["orderF"]

    with sync_playwright() as p:
        browser = p.chromium.launch()

        # ----- admin + customer sessions (via the real login page) -----
        def login(email, password):
            ctx = browser.new_context()
            pg = ctx.new_page()
            pg.goto(f"{BASE}/login")
            pg.fill('input[type="email"], #email', email)
            pg.fill('input[type="password"], #password', password)
            pg.click('button[type="submit"]')
            try:
                pg.wait_for_url("**/admin**", timeout=30_000)
            except Exception:
                pg.wait_for_timeout(2500)
            return ctx, pg

        admin_ctx, admin_pg = login(ADMIN_EMAIL, ADMIN_PASSWORD)
        admin_cookie = "; ".join(
            f"{c['name']}={c['value']}" for c in admin_ctx.cookies(BASE)
        )
        check("Admin login works", "/admin" in admin_pg.url or "Dashboard" in admin_pg.inner_text("body"),
              f"url={admin_pg.url}")

        user_ctx, user_pg = login(user_email, user_pw)
        user_cookie = "; ".join(
            f"{c['name']}={c['value']}" for c in user_ctx.cookies(BASE)
        )
        check("Customer login works", user_cookie != "")

        # ---------------- 1. Notifications API RBAC ----------------
        print("\n--- 1. Notifications API ---")
        st, body, _ = api("GET", "/api/admin/notifications?take=10", cookie=admin_cookie)
        check("Admin GET /api/admin/notifications works",
              st == 200 and "events" in body and "unread" in body, f"status={st}")
        st, body, _ = api("GET", "/api/admin/notifications?take=10", cookie=user_cookie)
        check("Customer GET is rejected (403)", st == 403, f"status={st}")

        # ---------------- 2. Signup alert -> feed event ----------------
        print("\n--- 2. Signup alert event ---")
        signup_email = user_email.replace("p24-user", "p24-signup-new")
        st, body, _ = api("POST", "/api/auth/signup", {
            "email": signup_email, "password": "Passw0rd!xyz",
            "name": "P24 Signup Alert", "phone": "+2347000000243",
        })
        check("Signup accepted (201)", st == 201, f"status={st} body={body}")

        ev = wait_for_event(admin_cookie, lambda e: e["type"] == "NEW_SIGNUP" and signup_email in (e.get("data") or ""))
        check("NEW_SIGNUP event lands in the feed", ev is not None)
        if ev:
            check("Signup event emailStatus is SENT (provider accepted)",
                  ev["emailStatus"] == "SENT", f"status={ev['emailStatus']}")
            recips = json.loads(ev.get("recipients") or "[]")
            check("Signup event records the test recipient",
                  ALERT_TEST_ADDRESS in recips, f"recipients={recips}")

        # ---------------- 3. Transfer-confirm alert event ----------------
        print("\n--- 3. Transfer-pending alert event ---")
        # order E has no payment yet: customer confirms a transfer
        order_id_e = None
        st, body, _ = api("GET", "/api/orders?take=100", cookie=admin_cookie)
        for o in body.get("items", []):
            if o.get("orderNumber") == order_e:
                order_id_e = o["id"]
        check("Order E located", order_id_e is not None)

        if order_id_e:
            st, body, _ = api("POST", "/api/payments", {
                "orderId": order_id_e, "amount": 12500,
                "method": "BANK_TRANSFER",
                "receiptUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            }, cookie=user_cookie)
            check("Customer payment confirmation accepted (201)", st in (200, 201), f"status={st} body={body}")

            ev = wait_for_event(admin_cookie, lambda e: e["type"] == "TRANSFER_PENDING" and order_e in (e.get("data") or ""))
            check("TRANSFER_PENDING event lands in the feed", ev is not None)
            if ev:
                check("Transfer event emailStatus is SENT", ev["emailStatus"] == "SENT",
                      f"status={ev['emailStatus']}")

            # duplicate submission must NOT create a second event
            st, body, _ = api("GET", "/api/admin/notifications?take=100", cookie=admin_cookie)
            before_count = sum(
                1 for e in body["events"]
                if e["type"] == "TRANSFER_PENDING" and order_e in (e.get("data") or "")
            )
            st, body, _ = api("POST", "/api/payments", {
                "orderId": order_id_e, "amount": 12500, "method": "BANK_TRANSFER",
            }, cookie=user_cookie)
            check("Duplicate confirmation flagged", st in (200, 201) and body.get("duplicate") is True,
                  f"status={st} body={body}")
            time.sleep(6)
            st, body, _ = api("GET", "/api/admin/notifications?take=100", cookie=admin_cookie)
            after_count = sum(
                1 for e in body["events"]
                if e["type"] == "TRANSFER_PENDING" and order_e in (e.get("data") or "")
            )
            check("Duplicate confirmation adds NO second event", after_count == before_count,
                  f"before={before_count} after={after_count}")

        # ---------------- 4. Stage-email dedup on order E ----------------
        print("\n--- 4. Stage-email dedup ---")
        def patch_order(oid, data):
            return api("PATCH", f"/api/orders/{oid}", data, cookie=admin_cookie)

        def lns(order_json):
            return order_json.get("lastNotifiedStage")

        if order_id_e:
            st, body, _ = patch_order(order_id_e, {"status": "PICKED_UP"})
            check("Move -> PICKED_UP sets lastNotifiedStage=2",
                  st == 200 and lns(body.get("order") or body) == 2,
                  f"status={st} body-lns={lns(body.get('order') or body)}")

            st, body, _ = patch_order(order_id_e, {"status": "PROCESSING"})
            check("Move -> PROCESSING sets lastNotifiedStage=4",
                  st == 200 and lns(body.get("order") or body) == 4,
                  f"lns={lns(body.get('order') or body)}")

            st, body, _ = patch_order(order_id_e, {"status": "PAYMENT_VERIFIED"})
            check("Backwards move to PAYMENT_VERIFIED is SILENT (lns stays 4)",
                  st == 200 and lns(body.get("order") or body) == 4,
                  f"lns={lns(body.get('order') or body)}")

            st, body, _ = patch_order(order_id_e, {"status": "FINISHING"})
            check("Forward again -> FINISHING advances lns to 5",
                  st == 200 and lns(body.get("order") or body) == 5,
                  f"lns={lns(body.get('order') or body)}")

            st, body, _ = patch_order(order_id_e, {"status": "PROCESSING"})
            check("Backwards to PROCESSING keeps lns=5 (no repeat email)",
                  st == 200 and lns(body.get("order") or body) == 5,
                  f"lns={lns(body.get('order') or body)}")

            st, body, _ = patch_order(order_id_e, {"status": "PROCESSING"})
            check("Same-status PATCH keeps lns=5",
                  st == 200 and lns(body.get("order") or body) == 5,
                  f"lns={lns(body.get('order') or body)}")

        # ---------------- 5. Payment verify + reject/re-approve dedup ----------------
        print("\n--- 5. Verify / reject / re-approve dedup ---")
        # order F: REQUESTED + PENDING payment
        payment_id_f = None
        order_id_f = None
        st, body, _ = api("GET", "/api/orders?take=100", cookie=admin_cookie)
        for o in body.get("items", []):
            if o.get("orderNumber") == order_f:
                order_id_f = o["id"]
                pays = o.get("payments") or []
                if pays:
                    payment_id_f = pays[0]["id"]
        check("Order F + payment located", payment_id_f is not None)

        if payment_id_f:
            st, body, _ = api("PATCH", f"/api/payments/{payment_id_f}", {"status": "VERIFIED"}, cookie=admin_cookie)
            ordj = body.get("order") or {}
            check("Verify advances order to PAYMENT_VERIFIED",
                  ordj.get("status") == "PAYMENT_VERIFIED", f"status={ordj.get('status')}")
            check("Verify claims stage 1 (lns=1)", ordj.get("lastNotifiedStage") == 1,
                  f"lns={ordj.get('lastNotifiedStage')}")

            st, body, _ = api("PATCH", f"/api/payments/{payment_id_f}", {"status": "REJECTED"}, cookie=admin_cookie)
            check("Reject after verify accepted", st == 200, f"status={st}")

            st, body, _ = api("PATCH", f"/api/payments/{payment_id_f}", {"status": "VERIFIED"}, cookie=admin_cookie)
            ordj = body.get("order") or {}
            payj = body.get("payment") or {}
            check("Re-approve ends VERIFIED", payj.get("status") == "VERIFIED", f"{payj}")
            check("Re-approve keeps order at PAYMENT_VERIFIED (no regression)",
                  ordj.get("status") == "PAYMENT_VERIFIED", f"status={ordj.get('status')}")
            check("Re-approve does NOT raise lns past 1 (no repeat email)",
                  ordj.get("lastNotifiedStage") == 1, f"lns={ordj.get('lastNotifiedStage')}")

        # ---------------- 6. Test-alert endpoint ----------------
        print("\n--- 6. Test alert endpoint ---")
        st, body, _ = api("POST", "/api/admin/notifications/test", cookie=admin_cookie)
        check("Test send returns recipient list",
              st == 200 and body.get("recipients") == [ALERT_TEST_ADDRESS], f"status={st} body={body}")
        results = body.get("results") or []
        check("Test send accepted by provider for the test address",
              len(results) == 1 and results[0].get("ok") is True, f"results={results}")
        ev = wait_for_event(admin_cookie, lambda e: e["type"] == "TEST")
        check("TEST event recorded in the feed", ev is not None)

        # ---------------- 7. UI: Notifications tab ----------------
        print("\n--- 7. Notifications UI ---")
        admin_pg.goto(f"{BASE}/admin")
        admin_pg.wait_for_timeout(1500)
        # click the Notifications nav entry
        admin_pg.click('aside button:has-text("Notifications")')
        admin_pg.wait_for_timeout(1200)
        feed_text = admin_pg.inner_text("main")
        check("Feed shows the signup event", signup_email in feed_text)
        check("Feed shows the transfer event", order_e in feed_text)
        check("Feed shows delivery-status chips", "Emails sent" in feed_text)

        # mark all read -> unread clears (verified via the API — the UI badge
        # refreshes on the next poll)
        admin_pg.click('button:has-text("Mark all read")')
        admin_pg.wait_for_timeout(2000)
        st, body, _ = api("GET", "/api/admin/notifications?take=5", cookie=admin_cookie)
        check("Mark-all-read clears the unread count", st == 200 and body.get("unread") == 0,
              f"unread={body.get('unread')}")

        # Settings -> Notifications tab: list input + test button
        admin_pg.click('aside button:has-text("Settings")')
        admin_pg.wait_for_timeout(1200)
        admin_pg.click('[role="tab"]:has-text("Notifications")')
        admin_pg.wait_for_timeout(1000)
        alerts_value = admin_pg.locator("#alerts-email").input_value()
        check("Settings show comma-separated alert list field",
              ALERT_TEST_ADDRESS in alerts_value, f"value={alerts_value}")
        check("Settings show the Send-test button",
              admin_pg.locator('button:has-text("Send test email now")').count() == 1)

        # ---------------- 8. Public settings privacy ----------------
        print("\n--- 8. Public settings privacy ---")
        st, body, _ = api("GET", "/api/settings/app")
        s = body.get("settings", {})
        check("Public GET still hides adminAlertsEmail", "adminAlertsEmail" not in s)

        admin_ctx.close()
        user_ctx.close()
        browser.close()

    print(f"\n{PASS}/{PASS + len(FAIL)} passed")
    if FAIL:
        print("FAILED:", FAIL)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
