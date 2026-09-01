#!/usr/bin/env python3
"""Time a raw PATCH /api/payments/[id] with an admin session (no browser)."""
import json
import re
import sys
import time

from playwright.sync_api import sync_playwright

BASE = "http://localhost:3100"
ADMIN_EMAIL = "e2e-admin@kozy-test.example"
ADMIN_PASSWORD = "E2e-Admin-Pw-7261!"
ORDER = sys.argv[1] if len(sys.argv) > 1 else "KZ-E2EB4595"

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context()
    page = ctx.new_page()

    # Login to get the session cookie in the shared context
    page.goto(f"{BASE}/login")
    page.wait_for_load_state("networkidle")
    page.fill('input[type="email"], #email', ADMIN_EMAIL)
    page.fill('input[type="password"], #password', ADMIN_PASSWORD)
    page.click('button[type="submit"]')
    page.wait_for_timeout(3500)

    # Find the order + payment id via the admin orders API
    resp = ctx.request.get(f"{BASE}/api/orders?limit=100")
    data = resp.json()
    order = next((o for o in data["items"] if o["orderNumber"] == ORDER), None)
    if not order:
        print("ORDER NOT FOUND")
        sys.exit(1)
    payment = next((pp for pp in order.get("payments", []) if pp["status"] == "PENDING"), None)
    if not payment:
        print("NO PENDING PAYMENT — order status:", order["status"],
              "payments:", [(pp["status"]) for pp in order.get("payments", [])])
        sys.exit(0)
    print(f"order {ORDER} status={order['status']} payment={payment['id']} ({payment['status']})")

    t0 = time.time()
    r = ctx.request.patch(
        f"{BASE}/api/payments/{payment['id']}",
        data=json.dumps({"status": "VERIFIED"}),
        headers={"Content-Type": "application/json"},
        timeout=30000,
    )
    dt = time.time() - t0
    body = ""
    try:
        body = r.text()[:300]
    except Exception as e:
        body = f"<body read error: {e}>"
    print(f"PATCH status={r.status} in {dt:.2f}s")
    print("body:", body)
    browser.close()
