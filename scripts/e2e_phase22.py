#!/usr/bin/env python3
"""E2E test for phase 22 — client-requested features.

Against the local production build (localhost:3100, production DB).

Covers:
  1. Email-shape validation: "name@gmail" (no .com) rejected by the signup API
     with INVALID_EMAIL, and blocked client-side on the /signup form.
  2. Signup success screen offers the wrong-email rescue flow, and
     POST /api/auth/update-unverified-email actually fixes the address.
  3. resend-verification validates the email shape too.
  4. Admin Settings → Notifications tab renders and saves the alert email +
     toggles (server-backed AppSetting rows).
  5. CRM: fresh customers get a gold NEW badge; unverified accounts get an
     "unverified" chip; the delete-user flow (type DELETE to confirm) removes
     the customer entirely.
  6. Admin alert wiring: with the alert email pointed at a test address, a
     signup + a guest bank-transfer order run the notifyAdmin* path without
     error (Brevo accepted — no 'failed' line in the server log).
"""

import json
import os
import re
import sys
import time
import urllib.request

from playwright.sync_api import sync_playwright

BASE = os.environ.get("E2E_BASE", "http://localhost:3100")
ADMIN_EMAIL = "e2e-admin22@kozy-test.example"
ADMIN_PASSWORD = "E2e-Admin-Pw-7261!"
LOG = "/home/z/my-project/work/serve-prod22.log"
SHOT_DIR = "/home/z/my-project/work/e2e-phase22"
LONG = 30_000

TYPO_EMAIL = "e2e-typo-user@kozy-test.example"
FIXED_EMAIL = "e2e-fixed-user@kozy-test.example"
FORM_EMAIL = "e2e-form-user@kozy-test.example"
GUEST_EMAIL = "e2e-guest22@kozy-test.example"
ALERTS_TEST_EMAIL = "e2e-alerts@kozy-test.example"

results = []


def check(name, cond, detail=""):
    status = "PASS" if cond else "FAIL"
    results.append((name, status, detail))
    print(f"[{status}] {name}" + (f" — {detail}" if detail else ""))
    return cond


def api(method, path, body=None, headers=None):
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(body).encode() if body is not None else None,
        method=method,
        headers={"Content-Type": "application/json", **(headers or {})},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode() or "{}")
        except Exception:
            return e.code, {}


def log_error_lines():
    """notify* failure lines currently in the server log (binary-safe read)."""
    try:
        raw = open(LOG, "rb").read().decode("utf-8", "replace")
        return [ln for ln in raw.splitlines() if "notifyAdmin" in ln and "failed" in ln]
    except FileNotFoundError:
        return []


def main():
    os.makedirs(SHOT_DIR, exist_ok=True)

    # =====================================================
    # 1. API-level email validation
    # =====================================================
    print("\n--- 1. Email-shape validation (API) ---")
    status, body = api("POST", "/api/auth/signup", {
        "email": "e2e.typo@gmail", "password": "Passw0rd!xyz",
        "name": "E2E Typo", "phone": "+2347000000099",
    })
    check("Signup rejects missing-.com email (400)", status == 400, f"got {status}")
    check("Rejection carries INVALID_EMAIL code", body.get("error") == "INVALID_EMAIL")

    status, body = api("POST", "/api/auth/signup", {
        "email": TYPO_EMAIL, "password": "Passw0rd!xyz",
        "name": "E2E Typo User", "phone": "+2347000000099",
    })
    check("Signup accepts a complete email (201)", status == 201, f"got {status}")

    status, body = api("POST", "/api/auth/resend-verification", {"email": "nope@gmail"})
    check("Resend rejects mistyped email (400)", status == 400, f"got {status}")

    status, body = api("POST", "/api/auth/update-unverified-email", {
        "currentEmail": TYPO_EMAIL, "newEmail": "still-wrong",
    })
    check("Email-fix rejects invalid new address (400)", status == 400, f"got {status}")

    # =====================================================
    # 2. UI: signup form validation + rescue panel
    # =====================================================
    print("\n--- 2. Signup UI (validation + rescue) ---")
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport={"width": 1280, "height": 900})
        page = ctx.new_page()

        page.goto(f"{BASE}/signup")
        page.wait_for_load_state("networkidle")
        page.fill("#name", "E2E Form User")
        page.fill("#email", "form-typo@gmail")
        page.fill("#phone", "+2347000000098")
        page.fill("#password", "Passw0rd!xyz")
        page.click('button[type="submit"]')
        page.wait_for_timeout(600)
        check("Client blocks missing-.com email inline",
              page.locator("text=complete email address").count() > 0)
        check("Still on the form (no success screen)",
              page.locator("text=Check your email").count() == 0)
        page.screenshot(path=f"{SHOT_DIR}/01-signup-invalid-email.png", full_page=False)

        # Fix the email and submit for real — success screen must offer the
        # wrong-email rescue panel. (FORM_EMAIL is fresh — TYPO_EMAIL was
        # already created by the API tests above.)
        page.fill("#email", FORM_EMAIL)
        page.click('button[type="submit"]')
        page.wait_for_selector("text=Check your email", timeout=LONG)
        check("Success screen shows after valid signup", True)
        check("Rescue panel ('Wrong email address?') present",
              page.locator("text=Wrong email address").count() > 0)
        check("'Fix my email address' action present",
              page.locator("text=Fix my email address").count() > 0)
        page.screenshot(path=f"{SHOT_DIR}/02-signup-success-rescue.png", full_page=False)

        # Use the rescue flow from the UI: correct the address.
        page.click("text=Fix my email address")
        page.wait_for_selector("input[placeholder*='correct.email']", timeout=10_000)
        page.fill("input[placeholder*='correct.email']", FIXED_EMAIL)
        page.click("button:has-text('Save & resend link')")
        page.wait_for_selector(f"text={FIXED_EMAIL}", timeout=LONG)
        check("Rescue flow updated the email on-screen", True)
        page.screenshot(path=f"{SHOT_DIR}/03-signup-email-fixed.png", full_page=False)

        # =====================================================
        # 3. Admin: login → Settings → Notifications tab
        # =====================================================
        print("\n--- 3. Settings → Notifications ---")
        page.goto(f"{BASE}/login")
        page.wait_for_load_state("networkidle")
        page.fill('input[type="email"], #email', ADMIN_EMAIL)
        page.fill('input[type="password"], #password', ADMIN_PASSWORD)
        page.click('button[type="submit"]')
        page.wait_for_timeout(4000)
        page.goto(f"{BASE}/admin")
        page.wait_for_load_state("networkidle")
        page.get_by_role("button", name="Settings").first.click()
        page.wait_for_selector("text=Bank Account", timeout=LONG)
        page.locator('button[role="tab"]:has-text("Notifications")').click()
        page.wait_for_selector("text=Admin Alert Emails", timeout=LONG)
        check("Notifications tab renders", True)
        _expected_alert = os.environ.get(
            "ALERT_EXPECTED", "kozygarmentcare@gmail.com")
        check("Alert email field prefilled with owner inbox",
              page.locator("#alerts-email").input_value() == _expected_alert,
              page.locator("#alerts-email").input_value())
        check("Three alert toggles listed",
              page.locator("text=New customer signup").count() > 0
              and page.locator("text=New order").count() > 0
              and page.locator("text=Customer says they've paid").count() > 0)
        page.screenshot(path=f"{SHOT_DIR}/04-notifications-tab.png", full_page=False)

        # Point alerts at the test address, toggle one off + on, save.
        page.fill("#alerts-email", ALERTS_TEST_EMAIL)
        page.locator("label:has-text('New customer signup') input[type=checkbox]").check()
        page.locator("label:has-text('New order') input[type=checkbox]").check()
        page.locator("label:has-text(\"Customer says they've paid\") input[type=checkbox]").check()
        page.click("button:has-text('Save changes')")
        # The toast title is "Settings saved" — NOT the generic text=Saved,
        # which substring-matches the tab's own static copy and races the PUT.
        page.wait_for_selector('[data-slot="toast-title"]:has-text("Settings saved"), [role="status"]:has-text("Settings saved")', timeout=LONG)
        check("Alert settings save without error", True)

        # Confirm server-side (retry: the PUT commits before the toast, but
        # sandbox->Supabase latency can lag a beat).
        seen = None
        for _ in range(10):
            status, body = api("GET", "/api/settings/app")
            s = body.get("settings", {})
            seen = s.get("adminAlertsEmail")
            if seen is None:
                break
            time.sleep(1)
        s = body.get("settings", {})
        # Phase 23 security fix: the PUBLIC GET must NOT expose the admin
        # alert config (destination inbox + toggles) — it is admin-only now.
        check("Public settings GET hides admin alert config (no inbox harvesting)",
              seen is None and "adminAlertsEmail" not in s,
              f"adminAlertsEmail={'present (LEAK)' if seen is not None else 'stripped'}")

        # =====================================================
        # 4. CRM: NEW badge, unverified chip, delete user
        # =====================================================
        print("\n--- 4. CRM: NEW badge + delete ---")
        page.get_by_role("button", name="Customers").first.click()
        page.wait_for_selector("text=Customers (CRM)", timeout=LONG)
        page.wait_for_timeout(2500)

        row = page.locator(f"tr:has-text('{FIXED_EMAIL}')")
        row.wait_for(timeout=LONG)
        check("Rescued customer visible in CRM", True)
        check("NEW badge on the fresh customer",
              row.locator("text=new").count() > 0)
        check("'unverified' chip on email-unverified customer",
              row.locator("text=unverified").count() > 0)
        page.screenshot(path=f"{SHOT_DIR}/05-crm-new-badge.png", full_page=False)

        # Open detail → danger zone → delete (type DELETE)
        row.click()
        page.wait_for_selector(f'[role="dialog"]:has-text("{FIXED_EMAIL}")', timeout=LONG)
        check("Danger zone present for non-admin customer",
              page.locator("text=Danger zone").count() > 0)
        page.click("button:has-text('Delete customer')")
        page.wait_for_selector("text=Delete permanently", timeout=LONG)
        check("Confirm dialog demands typing DELETE",
              page.locator("text=Type DELETE to confirm").count() > 0)
        # Button stays disabled until DELETE is typed
        disabled_before = page.locator("button:has-text('Delete permanently')").is_disabled()
        check("Delete button disabled before typing DELETE", disabled_before)
        page.screenshot(path=f"{SHOT_DIR}/06-delete-confirm.png", full_page=False)

        page.fill('input[placeholder="DELETE"]', "DELETE")
        page.click("button:has-text('Delete permanently')")
        page.wait_for_selector("text=Customer deleted", timeout=LONG)
        check("Deletion toast fired", True)
        page.wait_for_timeout(2500)
        check("Customer gone from the CRM list",
              page.locator(f"tr:has-text('{FIXED_EMAIL}')").count() == 0)
        page.screenshot(path=f"{SHOT_DIR}/07-crm-after-delete.png", full_page=False)

        browser.close()

    # =====================================================
    # 5. Admin alert wiring (log-verified)
    # =====================================================
    print("\n--- 5. Admin alert wiring ---")
    before = set(log_error_lines())

    # A fresh signup fires notifyAdminNewCustomer
    status, _ = api("POST", "/api/auth/signup", {
        "email": "e2e-alert-signup@kozy-test.example", "password": "Passw0rd!xyz",
        "name": "E2E Alert Signup", "phone": "+2347000000097",
    })
    check("Alert-check signup created (201)", status == 201, f"got {status}")

    # A guest bank-transfer order fires notifyAdminTransferPending
    status, body = api("POST", "/api/orders", {
        "type": "ITEM",
        "items": [{"id": "shirt", "name": "Shirt", "quantity": 2}],
        "pickupAddress": "5 E2E Alert Road, Ikoyi",
        "pickupDate": "2026-09-05",
        "pickupTimeSlot": "09:00 – 11:00",
        "modeOfWash": "MACHINE",
        "paymentMethod": "BANK_TRANSFER",
        "guest": {"name": "E2E Alert Guest", "email": GUEST_EMAIL, "phone": "+2347000000096"},
    })
    check("Guest bank-transfer order created (201)", status == 201, f"got {status}")
    order_number = body.get("order", {}).get("orderNumber", "")

    # Duplicate-submission guard (phase-20 regression): same basket again
    status2, body2 = api("POST", "/api/orders", {
        "type": "ITEM",
        "items": [{"id": "shirt", "name": "Shirt", "quantity": 2}],
        "pickupAddress": "5 E2E Alert Road, Ikoyi",
        "pickupDate": "2026-09-05",
        "pickupTimeSlot": "09:00 – 11:00",
        "modeOfWash": "MACHINE",
        "paymentMethod": "BANK_TRANSFER",
        "guest": {"name": "E2E Alert Guest", "email": GUEST_EMAIL, "phone": "+2347000000096"},
    })
    check("Duplicate guard returns the SAME order",
          status2 == 201 and body2.get("duplicate") is True
          and body2.get("order", {}).get("orderNumber") == order_number,
          f"{status2}/{body2.get('order', {}).get('orderNumber')} vs {order_number}")

    time.sleep(8)  # after() sends happen post-response — give Brevo a beat
    if BASE.startswith("http://localhost"):
        new_failures = set(log_error_lines()) - before
        check("No notifyAdmin* failures in server log (Brevo accepted both alerts)",
              len(new_failures) == 0, "; ".join(list(new_failures)[:2]))
    else:
        print("[SKIP] notifyAdmin* log check — production run (no local server log access)")

    # ---------------- SUMMARY ----------------
    print("\n================ SUMMARY ================")
    fails = [r for r in results if r[1] == "FAIL"]
    for name, status, detail in results:
        print(f"  {status}  {name}")
    print(f"\n{len(results) - len(fails)}/{len(results)} passed")
    if fails:
        print("FAILED:", [f[0] for f in fails])
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
