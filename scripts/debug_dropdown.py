#!/usr/bin/env python3
"""Debug: open modal, click the status combobox, screenshot the dropdown."""
import sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3100"
ORDER = sys.argv[1] if len(sys.argv) > 1 else "KZ-E2EA4562"

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1500, "height": 950})
    page = ctx.new_page()
    page.goto(f"{BASE}/login")
    page.wait_for_load_state("networkidle")
    page.fill('input[type="email"], #email', "e2e-admin@kozy-test.example")
    page.fill('input[type="password"], #password', "E2e-Admin-Pw-7261!")
    page.click('button[type="submit"]')
    page.wait_for_timeout(4000)
    page.goto(f"{BASE}/admin")
    page.wait_for_load_state("networkidle")
    page.get_by_role("button", name="Orders").first.click()
    page.wait_for_selector("text=Drag order cards", timeout=20000)
    page.wait_for_timeout(2000)

    page.locator("div.w-72", has_text=ORDER).first.locator(f"text={ORDER}").first.click(timeout=20000)
    page.wait_for_selector(f'[role="dialog"]:has-text("{ORDER}")', timeout=20000)
    page.wait_for_timeout(1000)

    combos = page.locator('[role="dialog"] button[role="combobox"]')
    print("combobox count in dialog:", combos.count())
    # Also count ALL comboboxes on the page (portals included)
    print("combobox count on page:", page.locator('button[role="combobox"]').count())

    combos.first.click()
    page.wait_for_timeout(800)

    opts = page.locator('[role="option"]')
    print("option count:", opts.count())
    for i in range(min(opts.count(), 12)):
        print(f"  option[{i}]: {opts.nth(i).inner_text()!r} visible={opts.nth(i).is_visible()}")

    page.screenshot(path="/home/z/my-project/work/e2e-kanban/debug-dropdown-open.png", full_page=False)
    # bounding boxes of the PICKED UP option and the dialog
    pu = page.locator('[role="option"]:has-text("PICKED UP")')
    if pu.count():
        print("PICKED UP option bbox:", pu.first.bounding_box())
        print("dialog bbox:", page.locator('[role="dialog"]').bounding_box())
        try:
            pu.first.click(timeout=4000)
            print("OPTION CLICK OK")
        except Exception as e:
            print("OPTION CLICK FAILED:", str(e)[:200])
    page.wait_for_timeout(1500)
    print("dialog text has 'Picked Up':", "Goods received by rider" in page.locator('[role="dialog"]').inner_text())
    browser.close()
