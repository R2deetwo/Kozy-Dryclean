#!/usr/bin/env python3
"""E2E test for the admin Kanban / order pipeline overhaul (phase 21).

Against the local production build (localhost:3100). NOTE: the sandbox has
multi-second latency to the remote Supabase DB (~2-5s per write), so every
wait here is STATE-BASED with generous timeouts — we wait for the UI to reach
the expected state, never a fixed sleep.

Requires seeded orders (scripts/e2e-seed-phase21.ts):
  A) PAYMENT_PENDING_VERIFICATION + PENDING transfer (receipt attached)
  B) PAYMENT_PENDING_VERIFICATION + PENDING transfer (no receipt)
  C) PICKED_UP + PENDING transfer (late payment — must NOT regress)
  D) PAYMENT_PENDING_VERIFICATION + PENDING transfer (for dropdown auto-verify)

Covers:
  1. Verify from modal -> payment badge flips, progress advances to stage 2,
     status select syncs, card moves to "Ready to Pick Up"
  2. "Set status" dropdown moves the order + progress bar follows
  3. Reject -> rejected state in modal + card indicator
  4. Payment queue Rejected tab -> "Approve payment now" (late landing money)
  5. Verifying a payment on an order already PICKED_UP does NOT regress it
  6. Setting status to PAYMENT_VERIFIED auto-verifies the payment record
"""

import os
import sys

from playwright.sync_api import sync_playwright

BASE = os.environ.get("E2E_BASE", "http://localhost:3100")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "e2e-admin@kozy-test.example")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "E2e-Admin-Pw-7261!")
ORDER_A = os.environ.get("ORDER_A", "KZ-E2EA4589")
ORDER_B = os.environ.get("ORDER_B", "KZ-E2EB7415")
ORDER_C = os.environ.get("ORDER_C", "KZ-E2EC5048")
ORDER_D = os.environ.get("ORDER_D", "KZ-E2ED6336")
SHOT_DIR = "/home/z/my-project/work/e2e-kanban"
LONG = 30_000  # generous — sandbox DB latency is multi-second

results = []


def check(name, cond, detail=""):
    status = "PASS" if cond else "FAIL"
    results.append((name, status, detail))
    print(f"[{status}] {name}" + (f" — {detail}" if detail else ""))
    return cond


def column_with(page, *texts):
    """The Kanban column (div.w-72) containing ALL given texts."""
    loc = page.locator("div.w-72")
    for t in texts:
        loc = loc.filter(has_text=t)
    return loc


def open_card(page, order_number, column_label):
    """Click an order card inside a named column to open the detail modal."""
    card = column_with(page, column_label, order_number).first.locator(
        f"text={order_number}"
    )
    card.first.click(timeout=LONG)
    page.wait_for_selector(f'[role="dialog"]:has-text("{order_number}")', timeout=LONG)
    # wait for the payment section to hydrate
    page.wait_for_selector('[role="dialog"] :has-text("Payment")', timeout=LONG)


def close_modal(page):
    """Close via the dialog's built-in X button (Escape can be swallowed while
    React Query toasts/mutations are in flight)."""
    x = page.locator('[role="dialog"] [data-slot="dialog-close"]')
    if x.count() > 0:
        x.first.click()
    else:
        page.keyboard.press("Escape")
    page.wait_for_selector('[role="dialog"]', state="detached", timeout=10000)


def select_status(page, option_text, expected_caption):
    """Open the Set-status select and pick an option — retried up to 3x
    because a just-landed refetch can remount the Select mid-click."""
    import time
    for attempt in range(3):
        try:
            combo = page.locator('[role="dialog"] button[role="combobox"]').first
            combo.click(timeout=10_000)
            page.wait_for_selector('[role="option"]', state="visible", timeout=10_000)
            page.locator(f'[role="option"]:has-text("{option_text}")').first.click(timeout=10_000)
            page.wait_for_selector(
                f'[role="dialog"] :text("{expected_caption}")',
                timeout=LONG, state="attached",
            )
            return True
        except Exception as e:
            print(f"  [select retry {attempt + 1}] {str(e)[:120]}")
            page.keyboard.press("Escape")  # close any dangling dropdown
            page.wait_for_timeout(1200)
    return False


def dialog_wait_text(page, text, timeout=LONG):
    """Wait until the open modal contains the given text."""
    page.wait_for_selector(
        f'[role="dialog"] :text("{text}")', timeout=timeout, state="attached"
    )


def main():
    os.makedirs(SHOT_DIR, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport={"width": 1500, "height": 950})
        page = ctx.new_page()

        # ---------------- LOGIN ----------------
        page.goto(f"{BASE}/login")
        page.wait_for_load_state("networkidle")
        page.fill('input[type="email"], #email', ADMIN_EMAIL)
        page.fill('input[type="password"], #password', ADMIN_PASSWORD)
        page.click('button[type="submit"]')
        page.wait_for_timeout(4000)
        page.goto(f"{BASE}/admin")
        page.wait_for_load_state("networkidle")
        page.get_by_role("button", name="Orders").first.click()
        page.wait_for_selector("text=Drag order cards", timeout=LONG)
        page.wait_for_timeout(2000)
        check("Admin login + Kanban loaded", True)

        # =====================================================
        # 1. MAIN FLOW — verify from the modal, everything moves
        # =====================================================
        print("\n--- 1. Verify from modal (order A) ---")
        open_card(page, ORDER_A, "Awaiting Payment")
        dialog = page.locator('[role="dialog"]')
        check("Modal shows awaiting-payment banner",
              "Awaiting payment verification" in dialog.inner_text())
        check("Modal shows Verify payment button",
              dialog.locator('button', has_text="Verify payment").count() == 1)
        check("Modal shows receipt thumbnail",
              dialog.locator('img[alt="Transfer receipt"]').count() == 1)
        page.screenshot(path=f"{SHOT_DIR}/01-modal-pending.png", full_page=False)

        # Click VERIFY — then wait for the state to flip (slow DB path)
        dialog.locator('button', has_text="Verify payment").first.click()
        try:
            dialog_wait_text(page, "Payment received & verified")
            check("Progress bar advanced to Payment Confirmed", True)
        except Exception:
            check("Progress bar advanced to Payment Confirmed", False,
                  "stage-2 caption never appeared")
        try:
            page.wait_for_selector("text=Payment verified", timeout=8_000)
            check("Toast: Payment verified", True)
        except Exception:
            check("Toast: Payment verified", False, "toast never appeared")

        dialog_text = dialog.inner_text()
        check("Payment badge flips to Verified (no buttons left)",
              "Verified" in dialog_text
              and dialog.locator('button', has_text="Verify payment").count() == 0
              and dialog.locator('button', has_text="Reject").count() == 0)
        check("Awaiting banner gone", "Awaiting payment verification" not in dialog_text)
        trigger = dialog.locator('button[role="combobox"]').first
        check("Set-status select synced to PAYMENT VERIFIED",
              "PAYMENT VERIFIED" in trigger.inner_text())
        page.screenshot(path=f"{SHOT_DIR}/02-modal-verified.png", full_page=False)
        dialog.locator("text=Order progress").screenshot(
            path=f"{SHOT_DIR}/03-stepper-alignment.png"
        )
        close_modal(page)

        try:
            column_with(page, "Ready to Pick Up", ORDER_A).first.wait_for(timeout=LONG)
            check("Card moved to Ready to Pick Up column", True)
        except Exception:
            check("Card moved to Ready to Pick Up column", False)
        check("Card no longer in Awaiting Payment",
              column_with(page, "Awaiting Payment", ORDER_A).count() == 0)
        page.screenshot(path=f"{SHOT_DIR}/04-board-after-verify.png", full_page=False)

        # =====================================================
        # 2. SET STATUS DROPDOWN moves order + progress follows
        # =====================================================
        print("\n--- 2. Set status dropdown (order A -> PICKED UP) ---")
        page.wait_for_timeout(2500)  # let step-1's refetch settle first
        open_card(page, ORDER_A, "Ready to Pick Up")
        dialog = page.locator('[role="dialog"]')
        check("Progress moved to Picked Up stage",
              select_status(page, "PICKED UP", "Goods received by rider"))
        close_modal(page)
        try:
            column_with(page, "Picked Up", ORDER_A).first.wait_for(timeout=LONG)
            check("Card moved to Picked Up column", True)
        except Exception:
            check("Card moved to Picked Up column", False)

        # =====================================================
        # 3. REJECT flow — modal state + card indicator
        # =====================================================
        print("\n--- 3. Reject from modal (order B) ---")
        open_card(page, ORDER_B, "Awaiting Payment")
        dialog = page.locator('[role="dialog"]')
        dialog.locator('button', has_text="Reject").first.click()
        try:
            dialog_wait_text(page, "Approve payment")
            check("Approve-payment panel appears (late money)", True)
        except Exception:
            check("Approve-payment panel appears (late money)", False)
        check("Rejected badge shows", "Rejected" in dialog.inner_text())
        page.screenshot(path=f"{SHOT_DIR}/05-modal-rejected.png", full_page=False)
        close_modal(page)
        try:
            column_with(page, "Awaiting Payment", ORDER_B, "Transfer rejected").first.wait_for(timeout=LONG)
            check("Card shows rejected indicator", True)
        except Exception:
            check("Card shows rejected indicator", False)
        page.screenshot(path=f"{SHOT_DIR}/06-card-rejected.png", full_page=False)

        # =====================================================
        # 4. QUEUE — Rejected tab, Approve payment now
        # =====================================================
        print("\n--- 4. Payment queue Rejected tab (order B) ---")
        page.get_by_role("button", name="Verify Payments").first.click()
        page.wait_for_selector("text=Payment Verification Queue", timeout=LONG)
        page.wait_for_timeout(2500)
        page.locator('button', has_text="Rejected").first.click()
        page.wait_for_timeout(800)
        try:
            page.locator(f"li:has-text('{ORDER_B}')").first.wait_for(timeout=LONG)
            check("Rejected tab lists order B", True)
        except Exception:
            check("Rejected tab lists order B", False)
        page.locator(f"li:has-text('{ORDER_B}')").first.click()
        page.wait_for_timeout(600)
        page.screenshot(path=f"{SHOT_DIR}/07-queue-rejected.png", full_page=False)
        page.locator('button:has-text("Approve payment now")').click()
        try:
            page.wait_for_selector("text=Payment verified", timeout=LONG)
            check("Approve toast fired", True)
        except Exception:
            check("Approve toast fired", False)
        # back to the board — B should now be Ready to Pick Up
        page.get_by_role("button", name="Orders").first.click()
        page.wait_for_selector("text=Drag order cards", timeout=LONG)
        try:
            column_with(page, "Ready to Pick Up", ORDER_B).first.wait_for(timeout=LONG)
            check("Order B moved to Ready to Pick Up", True)
        except Exception:
            check("Order B moved to Ready to Pick Up", False)

        # =====================================================
        # 5. NO REGRESSION — verify late payment on PICKED_UP order
        # =====================================================
        print("\n--- 5. Late payment must not regress (order C) ---")
        open_card(page, ORDER_C, "Picked Up")
        dialog = page.locator('[role="dialog"]')
        check("Order C still shows PENDING payment in modal",
              "Pending" in dialog.inner_text())
        dialog.locator('button', has_text="Verify payment").first.click()
        try:
            dialog_wait_text(page, "Verified")
            check("Payment becomes Verified", True)
        except Exception:
            check("Payment becomes Verified", False)
        dialog_text = dialog.inner_text()
        check("Order stays at Picked Up (no regression)",
              "Goods received by rider" in dialog_text
              and "Payment received & verified" not in dialog_text)
        page.screenshot(path=f"{SHOT_DIR}/08-modal-late-verify.png", full_page=False)
        close_modal(page)
        check("Order C card still in Picked Up column",
              column_with(page, "Picked Up", ORDER_C).count() == 1)

        # =====================================================
        # 6. DROPDOWN AUTO-VERIFY — status -> PAYMENT_VERIFIED
        # =====================================================
        print("\n--- 6. Dropdown auto-verify (order D) ---")
        open_card(page, ORDER_D, "Awaiting Payment")
        dialog = page.locator('[role="dialog"]')
        check("Order D payment Pending before", "Pending" in dialog.inner_text())
        check("Progress advanced to Payment Confirmed",
              select_status(page, "PAYMENT VERIFIED", "Payment received & verified"))
        try:
            # payment section flips to Verified WITHOUT any manual verify click
            dialog_wait_text(page, "Verified")
            check("Payment auto-verified by status change (no manual click)", True)
        except Exception:
            check("Payment auto-verified by status change (no manual click)", False)
        check("No Approve panel left after auto-verify",
              dialog.locator('button', has_text="Approve payment").count() == 0)
        page.screenshot(path=f"{SHOT_DIR}/09-dropdown-autoverify.png", full_page=False)
        close_modal(page)
        try:
            column_with(page, "Ready to Pick Up", ORDER_D).first.wait_for(timeout=LONG)
            check("Order D card in Ready to Pick Up (flag cleared)", True)
        except Exception:
            check("Order D card in Ready to Pick Up (flag cleared)", False)

        page.screenshot(path=f"{SHOT_DIR}/10-final-board.png", full_page=False)
        browser.close()

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
