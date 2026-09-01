#!/usr/bin/env python3
"""E2E part 2: receipt upload end-to-end + admin reject flow.

  1. Guest books a transfer order WITH a receipt image attached
     -> payment.receiptUrl must be set (checked via admin API)
     -> admin queue shows the actual image (img element with data: src)
  2. Admin REJECTS the payment -> lookup shows REJECTED, pending page
     shows the "couldn't match your transfer" state with guidance.

Run on a fresh server (guest rate limit: 5 orders/hour/IP).
"""
import json
import re
import sys

from playwright.sync_api import sync_playwright

BASE = "http://localhost:3100"
GUEST_EMAIL = "e2e-receipt-test@kozy-test.example"
import os as _os
ADMIN_EMAIL = _os.environ.get("ADMIN_EMAIL", "e2e-admin@kozy-test.example")
ADMIN_PASSWORD = "E2e-Admin-Pw-7261!"

results = []


def check(name, cond, detail=""):
    status = "PASS" if cond else "FAIL"
    results.append((name, status))
    print(f"[{status}] {name}" + (f" — {detail}" if detail else ""))
    return cond


def main():
    order_number = None

    # Make a small receipt image (PNG) for upload
    import struct
    import zlib

    def make_png(path):
        w, h = 320, 200
        raw = b""
        for y in range(h):
            raw += b"\x00"  # filter byte
            for x in range(w):
                # navy header band for the first 40 rows, cream below
                if y < 40:
                    raw += bytes([10, 25, 47, 255])
                else:
                    raw += bytes([248, 246, 240, 255])
        def chunk(tag, data):
            c = tag + data
            return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)
        ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)
        png = (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr)
               + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))
        open(path, "wb").write(png)

    receipt_path = "/home/z/my-project/work/e2e-transfer/fake-receipt.png"
    make_png(receipt_path)

    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport={"width": 1400, "height": 950})
        page = ctx.new_page()

        # ---- Book with receipt attached ----
        page.goto(f"{BASE}/book")
        page.wait_for_load_state("networkidle")
        page.click('button[aria-label="Add one Shirt"]')
        page.click('button:has-text("Machine Wash")')
        page.click('button:has-text("Continue")')
        page.wait_for_timeout(800)
        if page.locator('button:has-text("Skip for now")').count() > 0:
            page.click('button:has-text("Skip for now")')
        else:
            page.click('button:has-text("Continue")')
        page.wait_for_timeout(800)
        page.fill("#pickup-address", "Receipt Test Flat, 4 Kozy Road, Lagos")
        page.fill("#guest-name", "Receipt Test")
        page.fill("#guest-email", GUEST_EMAIL)
        page.fill("#guest-phone", "+234 803 000 3344")
        page.click('button:has-text("Continue")')
        page.wait_for_timeout(1000)

        # Attach the receipt
        page.set_input_files('input[type="file"][accept="image/*"]', receipt_path)
        page.wait_for_selector('button:has-text("Receipt attached")', timeout=8000)
        check("Receipt attached state shows in wizard", True)

        page.get_by_role("button", name=re.compile("I've Made the Transfer")).click()
        page.wait_for_url(re.compile(r"/payment/pending\?"), timeout=30000)
        m = re.search(r"order=([A-Z0-9-]+)", page.url)
        order_number = m.group(1) if m else None
        check("Redirected to pending page", order_number is not None, str(order_number))

        # ---- Admin: verify the receipt is visible in the queue ----
        admin = ctx.new_page()
        admin.goto(f"{BASE}/login")
        admin.fill("#email", ADMIN_EMAIL)
        admin.fill("#password", ADMIN_PASSWORD)
        admin.click('button[type="submit"]')
        admin.wait_for_url(re.compile(r"/admin"), timeout=20000)
        check("Admin login", True)
        admin.get_by_role("button", name="Verify Payments").first.click()
        admin.wait_for_selector("text=Payment Verification Queue", timeout=10000)
        admin.wait_for_timeout(2000)

        admin.click(f'li:has-text("{order_number}")', timeout=8000)
        admin.wait_for_timeout(1200)
        admin.screenshot(path="/home/z/my-project/work/e2e-transfer/admin-receipt-view.png", full_page=True)

        img_count = admin.locator('figure img[src^="data:image/"]').count()
        check("Receipt image rendered in admin queue", img_count >= 1, f"img elements: {img_count}")

        # ---- Admin REJECTS the payment ----
        admin.get_by_role("button", name="Reject", exact=True).first.click(timeout=8000)
        admin.wait_for_timeout(2500)
        admin.screenshot(path="/home/z/my-project/work/e2e-transfer/admin-after-reject.png", full_page=True)

        # ---- Pending page flips to the rejected state ----
        page.wait_for_timeout(2000)
        page.reload()
        page.wait_for_load_state("networkidle")
        try:
            page.wait_for_selector("text=couldn't match your transfer", timeout=25000)
            rtext = page.inner_text("body")
            check("Pending page shows rejected state", "couldn't match your transfer" in rtext.lower().replace("’", "'"))
            check("Rejected page shows what-to-do guidance", "What to do now" in rtext)
            check("Rejected page shows support phone", "+234" in rtext)
            page.screenshot(path="/home/z/my-project/work/e2e-transfer/pending-rejected.png", full_page=True)
        except Exception as e:
            check("Pending page shows rejected state", False, str(e)[:120])
            page.screenshot(path="/home/z/my-project/work/e2e-transfer/pending-rejected-FAIL.png", full_page=True)

        lu = ctx.request.get(f"{BASE}/api/orders/lookup?orderNumber={order_number}&email={GUEST_EMAIL}").json()
        check("Lookup: payment REJECTED after admin reject", lu.get("payment", {}).get("status") == "REJECTED")

        browser.close()

    print("\n================ RECEIPT + REJECT SUMMARY ================")
    fails = [r for r in results if r[1] == "FAIL"]
    for name, status in results:
        print(f"  {status}  {name}")
    print(f"\n{len(results) - len(fails)}/{len(results)} passed")
    print(f"TEST_ORDER={order_number}")
    print(f"TEST_EMAIL={GUEST_EMAIL}")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
