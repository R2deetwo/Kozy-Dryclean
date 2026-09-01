"""Debug: login as e2e admin, screenshot /admin — check sidebar renders."""
import os
from playwright.sync_api import sync_playwright

BASE = os.environ.get("E2E_BASE", "http://localhost:3100")
SHOT = "/home/z/my-project/work/e2e-p23"
os.makedirs(SHOT, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1500, "height": 950})
    page = ctx.new_page()
    # Replicate the E2E sequence exactly
    page.goto(f"{BASE}/login")
    page.wait_for_load_state("networkidle")
    page.fill('input[type="email"], #email', "e2e-admin22@kozy-test.example")
    page.fill('input[type="password"], #password', "E2e-Admin-Pw-7261!")
    page.click('button[type="submit"]')
    page.wait_for_timeout(4000)
    page.screenshot(path=f"{SHOT}/debug-before-goto-admin.png")
    print("URL before goto/admin:", page.url)
    page.goto(f"{BASE}/admin")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)
    print("URL after goto/admin:", page.url)
    page.screenshot(path=f"{SHOT}/debug-after-goto-admin.png")
    print("Orders buttons:", page.get_by_role("button", name="Orders").count())
    print("body:", page.locator("body").inner_text()[:250].replace("\n", " | "))
    browser.close()
