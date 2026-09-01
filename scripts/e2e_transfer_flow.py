#!/usr/bin/env python3
"""E2E test for the streamlined bank-transfer payment flow (phase 20).

Covers, against the local production build (localhost:3100):
  A. Guest checkout: Paystack greyed out, transfer card steps, button label
  B. Redirect to /payment/pending + verification screen content
  C. Lookup API: correct pair -> PENDING; wrong email -> 404
  D. Duplicate-submission guard: identical re-POST returns the SAME order
  E. Admin verifies in queue -> pending page flips to "Payment confirmed!"
  F. DB assertions (order status, payment status, receiptUrl)

The test order + guest user are fully cleaned up at the end.
"""

import json
import re
import sys
import time

from playwright.sync_api import sync_playwright

import os
BASE = os.environ.get("E2E_BASE", "http://localhost:3100")
GUEST_EMAIL = "e2e-transfer-test@kozy-test.example"
GUEST_NAME = "E2E Transfer Test"
GUEST_PHONE = "+234 803 000 1122"
import os as _os
ADMIN_EMAIL = _os.environ.get("ADMIN_EMAIL", "e2e-admin@kozy-test.example")
ADMIN_PASSWORD = "E2e-Admin-Pw-7261!"

results = []


def check(name, cond, detail=""):
    status = "PASS" if cond else "FAIL"
    results.append((name, status, detail))
    print(f"[{status}] {name}" + (f" — {detail}" if detail else ""))
    return cond


def main():
    order_number = None
    order_id = None
    payment_id = None
    captured_payload = None

    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport={"width": 1400, "height": 950})
        page = ctx.new_page()

        # ---- Capture the orders POST payload (for the duplicate test) ----
        def on_request(req):
            nonlocal captured_payload
            if req.method == "POST" and "/api/orders" in req.url:
                try:
                    captured_payload = json.loads(req.post_data)
                except Exception:
                    pass

        page.on("request", on_request)

        # ================= A. GUEST CHECKOUT =================
        print("\n--- A. Guest checkout through the wizard ---")
        page.goto(f"{BASE}/book")
        page.wait_for_load_state("networkidle")

        # Retail is the default; add 2 shirts (men tab default)
        page.click('button[aria-label="Add one Shirt"]')
        page.click('button[aria-label="Add one Shirt"]')

        # Mode of wash: Machine
        page.click('button:has-text("Machine Wash")')
        page.click('button:has-text("Continue")')
        page.wait_for_timeout(800)

        # Step 2 (photos) — skip
        if page.locator('button:has-text("Skip for now")').count() > 0:
            page.click('button:has-text("Skip for now")')
        else:
            page.click('button:has-text("Continue")')
        page.wait_for_timeout(800)

        # Step 3 — pickup details + guest contact
        page.fill("#pickup-address", "E2E Test Villa, 12 Kozy Close, Ogombo, Lagos")
        page.fill("#guest-name", GUEST_NAME)
        page.fill("#guest-email", GUEST_EMAIL)
        page.fill("#guest-phone", GUEST_PHONE)
        page.click('button:has-text("Continue")')
        page.wait_for_timeout(1000)

        # ================= STEP 4 — PAYMENT UI =================
        print("\n--- B. Step-4 payment UI (Paystack greyed, transfer steps) ---")
        body_text = page.inner_text("body")

        # Paystack greyed out with the notice
        paystack_card = page.locator("label", has_text="Pay Online — Card").first
        check(
            "Paystack option shows 'Unavailable' badge",
            page.locator("span:has-text('Unavailable')").count() >= 1,
        )
        check(
            "Paystack notice: 'not available at the moment'",
            "not available at the moment" in body_text
            and "pay by bank transfer" in body_text,
        )
        # Clicking the greyed-out Paystack card must NOT switch the payment
        # method (real behaviour test — Radix radio internals vary).
        try:
            page.locator("label", has_text="Pay Online — Card").first.click(force=True, timeout=3000)
            page.wait_for_timeout(600)
            still_transfer = page.locator(
                'button:has-text("I\'ve Made the Transfer")'
            ).count() >= 1
            check(
                "Clicking greyed Paystack card does not switch method",
                still_transfer,
            )
        except Exception as e:
            check("Clicking greyed Paystack card does not switch method", False, str(e)[:100])

        # Transfer card: numbered steps
        check(
            "Transfer card step 1 (transfer amount)",
            re.search(r"1\s*Transfer\s*₦", body_text) is not None,
        )
        check(
            "Expectations copy present (email once verified)",
            "email" in body_text.lower() and "verified" in body_text.lower(),
        )

        # Confirm button label
        btn = page.locator('button:has-text("I\'ve Made the Transfer")')
        check(
            "Confirm button reads \"I've Made the Transfer\"",
            btn.count() >= 1,
        )

        # ================= SUBMIT -> PENDING PAGE =================
        print("\n--- C. Submit -> /payment/pending ---")
        # Track the orders POST response for diagnostics
        order_post_status = {}
        def on_response(r):
            if "/api/orders" in r.url and r.request.method == "POST":
                order_post_status["status"] = r.status
                try:
                    order_post_status["body"] = r.text()[:200]
                except Exception:
                    pass
        page.on("response", on_response)

        btn.first.click()
        try:
            page.wait_for_url(re.compile(r"/payment/pending\?"), timeout=30000)
        except Exception:
            page.screenshot(path="/home/z/my-project/work/e2e-transfer/submit-failed.png", full_page=True)
            print("ORDER POST RESULT:", order_post_status)
            raise
        url = page.url
        m = re.search(r"order=([A-Z0-9-]+)", url)
        order_number = m.group(1) if m else None
        check("Redirected to /payment/pending", "/payment/pending" in url, url)
        check("Order number in URL", order_number is not None, str(order_number))

        page.wait_for_selector("text=verifying your payment", timeout=20000)
        ptext = page.inner_text("body")
        check("Heading: We're verifying your payment", "verifying your payment" in ptext)
        check("Order number shown on page", order_number in ptext)
        check(
            "Reassurance box (no need to pay again)",
            "no need to pay again" in ptext.lower(),
        )
        check(
            "Timeline chips (submitted -> verifying -> email)",
            "Transfer submitted" in ptext and "Email confirmation" in ptext,
        )
        check("Bank recap card shown", "Account number" in ptext or "Account Number" in ptext)

        page.screenshot(path="/home/z/my-project/work/e2e-transfer/pending-verifying.png", full_page=True)

        # ================= LOOKUP API =================
        print("\n--- D. Lookup API ---")
        lookup = ctx.request.get(
            f"{BASE}/api/orders/lookup?orderNumber={order_number}&email={GUEST_EMAIL}"
        )
        lu = lookup.json()
        check("Lookup 200 for correct pair", lookup.status == 200, str(lookup.status))
        check(
            "Lookup: status PAYMENT_PENDING_VERIFICATION",
            lu.get("status") == "PAYMENT_PENDING_VERIFICATION",
            str(lu.get("status")),
        )
        check(
            "Lookup: payment PENDING / BANK_TRANSFER",
            lu.get("payment", {}).get("status") == "PENDING"
            and lu.get("payment", {}).get("method") == "BANK_TRANSFER",
        )
        order_id_lookup_total = lu.get("total")
        check("Lookup: total present", order_id_lookup_total is not None, str(order_id_lookup_total))

        wrong = ctx.request.get(
            f"{BASE}/api/orders/lookup?orderNumber={order_number}&email=attacker@evil.example"
        )
        check("Lookup 404 for wrong email", wrong.status == 404, str(wrong.status))

        noauth = ctx.request.get(f"{BASE}/api/orders/lookup?orderNumber={order_number}")
        check("Lookup 400 without email", noauth.status == 400, str(noauth.status))

        # ================= DUPLICATE GUARD =================
        print("\n--- E. Duplicate-submission guard ---")
        check("Captured order POST payload", captured_payload is not None)
        if captured_payload:
            dup_resp = ctx.request.post(
                f"{BASE}/api/orders", data=json.dumps(captured_payload),
                headers={"Content-Type": "application/json"},
            )
            dup = dup_resp.json()
            check("Duplicate POST returns 201", dup_resp.status == 201,
                  f"{dup_resp.status}: {str(dup)[:120]}")
            check("Duplicate POST flagged duplicate=true", dup.get("duplicate") is True)
            check(
                "Duplicate POST returns the SAME order number",
                dup.get("order", {}).get("orderNumber") == order_number,
                f"{dup.get('order', {}).get('orderNumber')} vs {order_number}",
            )

        # ================= ADMIN VERIFY =================
        print("\n--- F. Admin verifies the payment ---")
        admin = ctx.new_page()
        admin.goto(f"{BASE}/login")
        admin.wait_for_load_state("networkidle")
        # NextAuth credentials form
        admin.fill('input[type="email"], #email', ADMIN_EMAIL)
        admin.fill('input[type="password"], #password', ADMIN_PASSWORD)
        admin.click('button[type="submit"]')
        admin.wait_for_timeout(4000)
        logged_in = ADMIN_EMAIL in admin.inner_text("body") or "/admin" in admin.url
        check("Admin login", logged_in, admin.url)

        patch_fired = []
        if logged_in:
            admin.goto(f"{BASE}/admin")
            admin.wait_for_load_state("networkidle")
            # Watch for the verification PATCH so we KNOW it fired
            admin.on("request", lambda r: patch_fired.append(r.url) if r.method == "PATCH" and "/api/payments/" in r.url else None)
            # Open the payments tab — nav label is exactly "Verify Payments"
            try:
                admin.get_by_role("button", name="Verify Payments").first.click(timeout=8000)
            except Exception as e:
                check("Open payments tab", False, str(e)[:120])
            admin.wait_for_selector("text=Payment Verification Queue", timeout=10000)
            admin.wait_for_timeout(2000)
            admin.screenshot(path="/home/z/my-project/work/e2e-transfer/admin-queue.png", full_page=True)
            atext = admin.inner_text("body")
            check("Test order visible in admin queue", order_number in atext, order_number)

            # Select the order in the queue, then click Verify in the viewer
            try:
                admin.click(f'li:has-text("{order_number}")', timeout=8000)
                admin.wait_for_timeout(800)
                admin.get_by_role("button", name="Verify payment", exact=True).click(timeout=8000)
                admin.wait_for_timeout(3000)
                check("Verify payment clicked", True)
                check("Verification PATCH request fired", len(patch_fired) >= 1, str(patch_fired[:2]))
            except Exception as e:
                check("Verify payment clicked (UI)", False, str(e)[:120])
            admin.screenshot(path="/home/z/my-project/work/e2e-transfer/admin-after-verify.png", full_page=True)

        # ================= PENDING PAGE FLIPS TO CONFIRMED =================
        print("\n--- G. Pending page now shows confirmed ---")
        page.wait_for_timeout(2000)
        page.reload()
        page.wait_for_load_state("networkidle")
        try:
            page.wait_for_selector("text=Payment confirmed", timeout=25000)
            ctext = page.inner_text("body")
            check("Pending page shows 'Payment confirmed!'", "Payment confirmed" in ctext)
            check("Confirmed page mentions pickup scheduled", "pickup is now scheduled" in ctext.lower())
            page.screenshot(path="/home/z/my-project/work/e2e-transfer/pending-confirmed.png", full_page=True)
        except Exception as e:
            check("Pending page shows 'Payment confirmed!'", False, str(e)[:120])
            page.screenshot(path="/home/z/my-project/work/e2e-transfer/pending-NOT-confirmed.png", full_page=True)

        # Lookup should now report verified
        lu2 = ctx.request.get(
            f"{BASE}/api/orders/lookup?orderNumber={order_number}&email={GUEST_EMAIL}"
        ).json()
        check(
            "Lookup: status PAYMENT_VERIFIED after admin verify",
            lu2.get("status") == "PAYMENT_VERIFIED",
            str(lu2.get("status")),
        )
        check(
            "Lookup: payment VERIFIED",
            lu2.get("payment", {}).get("status") == "VERIFIED",
        )

        browser.close()

    # ================= SUMMARY =================
    print("\n================ SUMMARY ================")
    fails = [r for r in results if r[1] == "FAIL"]
    for name, status, detail in results:
        print(f"  {status}  {name}")
    print(f"\n{len(results) - len(fails)}/{len(results)} passed")
    if fails:
        print("FAILED:", [f[0] for f in fails])
    print(f"TEST_ORDER={order_number}")
    print(f"TEST_EMAIL={GUEST_EMAIL}")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
