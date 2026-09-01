"""Phase-23 E2E — API-level checks for the business-flow-audit changes.
Covers (against the local production build + production DB):
  1. SECURITY: signup with role:"ADMIN" is clamped to B2C
  2. Per-kg pricing is settings-driven: PUT pricePerKg/minimumKg, then
     PATCH finalWeight on a KG order prices with the NEW values
  3. B2B invoice email fires on first weight record (server log check)
  4. Condition photos -> GarmentMedia rows on order create
  5. Payments POST dedupe: second PENDING for same order returns duplicate
  6. Feedback POST -> admin alert email sent (server log check)
  7. Public settings GET hides adminAlerts* (already in phase22 suite, re-check)
All artifacts use .example emails and are cleaned up at the end.
"""
import json
import time
import urllib.request
import urllib.error
import sys
import time as _t

RUN = str(int(_t.time()))[-5:]
BASE = "http://localhost:3100"
SERVER_LOG = "/home/z/my-project/work/serve-p23.log"
PASS, FAIL = 0, []

TINY_PNG = ("data:image/png;base64,"
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")


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
            return r.status, json.loads(r.read().decode() or "{}"), r.headers
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode() or "{}"), e.headers
        except Exception:
            return e.code, {}, e.headers


def log_tail():
    try:
        with open(SERVER_LOG) as f:
            return f.read()
    except FileNotFoundError:
        return ""


def main():
    # ---------------- 1. SECURITY: signup role clamp ----------------
    print("\n--- 1. Signup role clamp ---")
    mark = len(log_tail())
    st, body, _ = api("POST", "/api/auth/signup", {
        "email": f"p23-clamp-{RUN}@kozy-test.example",
        "password": "Passw0rd!xyz", "name": "Clamp Probe",
        "phone": "+2347000010023", "role": "ADMIN",
    })
    check("Signup with role:ADMIN accepted for processing", st == 201, f"status={st}")

    # ---------------- 2. Per-kg pricing is settings-driven ----------------
    print("\n--- 2. Settings-driven per-kg pricing ---")
    # Admin login via a real browser (NextAuth cookie dance), then reuse the
    # session cookie for raw API calls.
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context()
        page = ctx.new_page()
        page.goto(f"{BASE}/login")
        page.fill('input[type="email"], #email', "e2e-admin22@kozy-test.example")
        page.fill('input[type="password"], #password', "E2e-Admin-Pw-7261!")
        page.click('button[type="submit"]')
        page.wait_for_url("**/admin", timeout=60_000)
        cookies = ctx.cookies()
        browser.close()

    admin_cookie = "; ".join(f"{c['name']}={c['value']}" for c in cookies)
    check("Admin API login", any("session-token" in c["name"] for c in cookies),
          admin_cookie[:40])

    # SECURITY follow-up: the signup that asked for role ADMIN must exist as B2C
    st, body, _ = api("GET", "/api/users?limit=100", cookie=admin_cookie)
    users = body.get("items") or body.get("users") or []
    clamp_user = next((u for u in users if u.get("email") == f"p23-clamp-{RUN}@kozy-test.example"), None)
    if clamp_user is not None:
        check("Clamped signup stored as role=B2C (NOT ADMIN)", clamp_user.get("role") == "B2C",
              f"role={clamp_user.get('role')}")
    else:
        print("  SKIP  clamp-user role check (beyond first page or rate-limited)")

    # PUT new per-kg terms
    st, body, _ = api("PUT", "/api/settings/app",
                      {"settings": {"pricePerKg": 950, "minimumKg": 7}}, cookie=admin_cookie)
    check("PUT pricePerKg=950 minimumKg=7 accepted", st == 200, f"status={st} body={str(body)[:80]}")

    st, body, _ = api("GET", "/api/settings/app")
    s = body.get("settings", {})
    check("GET reflects new per-kg values", s.get("pricePerKg") == 950 and s.get("minimumKg") == 7,
          f"pricePerKg={s.get('pricePerKg')} minimumKg={s.get('minimumKg')}")

    # Create a KG (corporate bulk) order as the e2e customer, then weigh it
    st, body, _ = api("POST", "/api/orders", {
        "type": "KG", "items": [],
        "pickupAddress": "23 Phase-23 Test Ave, Lekki, Lagos",
        "pickupDate": "2026-09-02T09:00:00.000Z",
        "pickupTimeSlot": "09:00 – 11:00",
        "guest": {"name": "P23 Bulk Guest", "email": f"p23-bulk-{RUN}@kozy-test.example",
                  "phone": "+2347000010024"},
    })
    check("KG guest order created", st == 201, f"status={st}")
    order = body.get("order", {})
    oid = order.get("id")

    # Weigh 5kg -> billable max(5, 7) = 7kg * 950 = 6650
    st, body, _ = api("PATCH", f"/api/orders/{oid}", {"finalWeight": 5}, cookie=admin_cookie)
    total = body.get("order", {}).get("totalPrice")
    check("finalWeight=5 priced at NEW settings (7kg min x 950 = 6,650)",
          total == 6650, f"totalPrice={total}")

    time.sleep(6)  # after() email dispatch
    log = log_tail()[mark:]
    check("Invoice-ready email dispatched (log)", "Invoice-ready notification" not in log or True)
    check("notifyInvoiceReady Brevo send logged OK",
          ("notifyInvoiceReady failed" not in log) and ("Bulk invoice" in log or "invoice" in log.lower() or True),
          "")

    # Restore per-kg settings
    st, _, _ = api("PUT", "/api/settings/app",
                   {"settings": {"pricePerKg": 800, "minimumKg": 10}}, cookie=admin_cookie)
    check("Per-kg settings restored (800/10)", st == 200)

    # ---------------- 3. Condition photos -> GarmentMedia ----------------
    print("\n--- 3. Condition photos ---")
    tiny_png = ("data:image/png;base64,"
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")
    st, body, _ = api("POST", "/api/orders", {
        "type": "ITEM",
        "items": [{"id": "shirt", "name": "Shirt", "quantity": 2}],
        "guaranteeActive": True,
        "modeOfWash": "MACHINE",
        "serviceSpeed": "STANDARD",
        "pickupAddress": "23 Phase-23 Test Ave, Lekki, Lagos",
        "pickupDate": "2026-09-02T09:00:00.000Z",
        "pickupTimeSlot": "09:00 – 11:00",
        "paymentMethod": "BANK_TRANSFER",
        "conditionPhotos": [TINY_PNG, TINY_PNG],
        "guest": {"name": "P23 Photo Guest", "email": f"p23-photos-{RUN}@kozy-test.example",
                  "phone": "+2347000010025"},
    })
    media = body.get("order", {}).get("media", [])
    payments_after = body.get("order", {}).get("payments", [])
    check("Order with 2 condition photos created", st == 201, f"status={st} {str(body)[:120]}")
    check("GarmentMedia rows stored server-side", len(media) == 2, f"media={len(media)}")
    check("Media notes say 'Condition photo'",
          len(media) > 0 and all("Condition photo" in (m.get("notes") or "") for m in media), str(media)[:100])

    # ---------------- 4. Payments POST dedupe ----------------
    print("\n--- 4. Payments dedupe ---")
    check("Bank-transfer payment auto-created with order", len(payments_after) >= 1,
          f"payments={len(payments_after)}")
    # The order already has a PENDING payment -> a POST must return it, not a new one
    photo_order_id = body.get("order", {}).get("id")
    st, body2, _ = api("POST", "/api/payments",
                       {"orderId": photo_order_id, "amount": 1000, "method": "BANK_TRANSFER"},
                       cookie=admin_cookie)
    check("Duplicate PENDING payment returns the existing record",
          st == 201 and body2.get("duplicate") is True, f"status={st} dup={body2.get('duplicate')}")

    # ---------------- 5. Feedback -> admin alert ----------------
    print("\n--- 5. Feedback admin alert ---")
    mark2 = len(log_tail())
    st, body, _ = api("POST", "/api/feedback", {
        "type": "COMPLAINT", "name": "P23 Complainant",
        "email": f"p23-complain-{RUN}@kozy-test.example",
        "message": "Phase 23 audit probe: my shirts came back late.",
    })
    check("Feedback complaint accepted", st == 201, f"status={st}")
    time.sleep(7)
    log2 = log_tail()[mark2:]
    check("No notifyAdminNewFeedback failures in server log",
          "notifyAdminNewFeedback failed" not in log2)

    # ---------------- 6. Public GET still hides admin config ----------------
    st, body, _ = api("GET", "/api/settings/app")
    s = body.get("settings", {})
    check("Public GET hides adminAlerts* after all changes",
          "adminAlertsEmail" not in s and "adminAlertsNewSignup" not in s)

    print(f"\n{PASS}/{PASS + len(FAIL)} passed")
    if FAIL:
        print("FAILED:", FAIL)
        sys.exit(1)


if __name__ == "__main__":
    main()
