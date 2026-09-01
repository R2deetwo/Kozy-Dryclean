#!/usr/bin/env python3
"""Debug: click Verify in the admin modal, capture network + console."""
import re
import sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3100"
ADMIN_EMAIL = "e2e-admin@kozy-test.example"
ADMIN_PASSWORD = "E2e-Admin-Pw-7261!"
ORDER = sys.argv[1] if len(sys.argv) > 1 else "KZ-E2EA5502"

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1500, "height": 950})
    page = ctx.new_page()

    page.on("console", lambda m: print(f"[console:{m.type}] {m.text[:300]}") if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: print(f"[pageerror] {str(e)[:500]}"))

    def on_response(r):
        if "/api/payments/" in r.url and r.request.method == "PATCH":
            try:
                body = r.text()[:400]
            except Exception as e:
                body = f"<body error: {e}>"
            print(f"[PATCH {r.status}] {r.url}\n  body: {body}")
    page.on("response", on_response)

    page.goto(f"{BASE}/login")
    page.wait_for_load_state("networkidle")
    page.fill('input[type="email"], #email', ADMIN_EMAIL)
    page.fill('input[type="password"], #password', ADMIN_PASSWORD)
    page.click('button[type="submit"]')
    page.wait_for_timeout(4000)
    page.goto(f"{BASE}/admin")
    page.wait_for_load_state("networkidle")
    page.get_by_role("button", name="Orders").first.click()
    page.wait_for_selector("text=Drag order cards", timeout=10000)
    page.wait_for_timeout(1500)

    # Open the modal for the order
    page.locator(f"div.w-72", has_text=ORDER).first.locator(f"text={ORDER}").first.click()
    page.wait_for_selector(f'[role="dialog"]:has-text("{ORDER}")', timeout=10000)
    page.wait_for_timeout(500)
    print("--- modal open, clicking Verify payment ---")

    btn = page.locator('[role="dialog"] button', has_text="Verify payment")
    print("EXACT verify button count:", btn.count())
    page.on("request", lambda r: print(f"[REQ {r.method}] {r.url}") if "/api/payments/" in r.url else None)
    btn.first.click()
    page.wait_for_timeout(5000)

    dt = page.locator('[role="dialog"]').inner_text()
    print("--- modal text after 5s (first 600 chars) ---")
    print(dt[:600])
    print("--- body has toast? ---", "Payment verified" in page.inner_text("body"))
    page.screenshot(path="/home/z/my-project/work/e2e-kanban/debug-after-verify.png")
    browser.close()
