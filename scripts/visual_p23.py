"""Visual QA screenshots for phase-23 changes (local prod build)."""
import os
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3100"
SHOT = "/home/z/my-project/work/e2e-p23"
os.makedirs(SHOT, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1500, "height": 950})
    page = ctx.new_page()
    page.goto(f"{BASE}/login")
    page.fill('input[type="email"], #email', "e2e-admin22@kozy-test.example")
    page.fill('input[type="password"], #password', "E2e-Admin-Pw-7261!")
    page.click('button[type="submit"]')
    page.wait_for_url("**/admin", timeout=60_000)
    page.wait_for_timeout(3500)
    page.screenshot(path=f"{SHOT}/admin-overview.png")

    # Settings pricing tab (server-backed per-kg)
    page.get_by_role("button", name="Settings").first.click()
    page.wait_for_timeout(2500)
    page.locator('button[role="tab"]:has-text("Pricing")').click()
    page.wait_for_timeout(1500)
    page.screenshot(path=f"{SHOT}/settings-pricing.png")

    # Landing pricing section (customer view of per-kg + paystack copy)
    page2 = ctx.new_page()
    page2.goto(BASE, wait_until="load")
    page2.wait_for_timeout(2000)
    page2.screenshot(path=f"{SHOT}/landing-top.png")

    browser.close()
    print("screenshots done:", os.listdir(SHOT))
