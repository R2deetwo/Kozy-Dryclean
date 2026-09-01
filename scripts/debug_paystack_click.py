#!/usr/bin/env python3
"""Debug: click the greyed Paystack label, inspect state changes."""
import re
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3100"

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_context(viewport={"width": 1400, "height": 950}).new_page()
    errors = []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
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
    page.fill("#pickup-address", "Debug Villa, Lagos")
    page.fill("#guest-name", "Debug User")
    page.fill("#guest-email", "debug@kozy-test.example")
    page.fill("#guest-phone", "+234 803 000 9999")
    page.click('button:has-text("Continue")')
    page.wait_for_timeout(1000)

    # settings loaded?
    settings_state = page.evaluate("""async () => {
      const r = await fetch('/api/settings/app'); const d = await r.json();
      return d.settings.paystackAvailable;
    }""")
    print("API paystackAvailable:", settings_state)

    btn_text = page.get_by_role("button", name=re.compile(r"Made the Transfer|Pay & Confirm")).inner_text()
    print("Button BEFORE:", repr(btn_text))

    label = page.locator("label", has_text="Pay Online — Card").first
    label.click(force=True, timeout=3000)
    page.wait_for_timeout(1200)
    btn_text2 = page.get_by_role("button", name=re.compile(r"Made the Transfer|Pay & Confirm")).inner_text()
    print("Button AFTER click:", repr(btn_text2))

    # inspect the radio element state
    radio_state = page.evaluate("""() => {
      const els = document.querySelectorAll('[role=radio]');
      return Array.from(els).map(e => ({value: e.getAttribute('value') ?? e.dataset.value ?? '?', disabled: e.disabled, ariaDisabled: e.getAttribute('aria-disabled'), tabIndex: e.tabIndex}));
    }""")
    print("Radio states:", radio_state)

    # click again more precisely on the card (not label) — try clicking the text
    page.get_by_text("Pay Online — Card", exact=False).first.click(force=True, timeout=3000)
    page.wait_for_timeout(1200)
    print("Button AFTER 2nd click:", repr(page.get_by_role("button", name=re.compile(r"Made the Transfer|Pay & Confirm")).inner_text()))

    page.screenshot(path="/home/z/my-project/work/e2e-transfer/debug-paystack-click.png", full_page=True)
    if errors:
        print("Console errors:", errors[:5])
    browser.close()
