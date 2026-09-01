#!/usr/bin/env python3
"""Debug: admin login through the /login UI."""
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3100"

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_context(viewport={"width": 1400, "height": 950}).new_page()
    msgs = []
    page.on("console", lambda m: msgs.append(f"{m.type}: {m.text}"))
    page.on("response", lambda r: msgs.append(f"HTTP {r.status} {r.url}") if "/api/auth" in r.url else None)

    page.goto(f"{BASE}/login")
    page.wait_for_load_state("networkidle")
    page.fill("#email", "e2e-admin@kozy-test.example")
    page.fill("#password", "E2e-Admin-Pw-7261!")
    page.click('button[type="submit"]')
    page.wait_for_timeout(6000)
    print("URL after submit:", page.url)
    print("Body has 'Invalid':", "Invalid" in page.inner_text("body"))
    print("Body has 'E2E Admin':", "E2E Admin" in page.inner_text("body"))
    for m in msgs[-12:]:
        print(" ", m[:150])
    sess = page.evaluate("async () => { const r = await fetch('/api/auth/session'); return {status: r.status, body: await r.text()} }")
    print("Session after login:", sess["body"][:200])
    cookies = page.context.cookies()
    print("Cookies:", [(c["name"], c["domain"][:25], "secure" if c["secure"] else "insecure") for c in cookies])
    page.screenshot(path="/home/z/my-project/work/e2e-transfer/debug-admin-login.png", full_page=True)
    browser.close()
