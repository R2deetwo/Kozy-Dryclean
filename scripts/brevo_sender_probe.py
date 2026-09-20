"""Probe Brevo: is concierge@kozycare.ng accepted as a sender yet?
Tries the domain sender first; only sends ONE real email per accepted path.
"""
import json, urllib.request, sys

KEY = "REDACTED_SECRET"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"

def send(sender_email, sender_name, to, subject, html):
    body = json.dumps({
        "sender": {"name": sender_name, "email": sender_email},
        "to": [{"email": to}],
        "subject": subject,
        "htmlContent": html,
        "tags": ["kozy-transactional", "deliverability-check"],
    }).encode()
    req = urllib.request.Request(
        "https://api.brevo.com/v3/smtp/email",
        data=body,
        headers={"api-key": KEY, "accept": "application/json",
                 "content-type": "application/json", "User-Agent": UA,
                 "brevo-url": "https://api.brevo.com"},
    )
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:400]

# 1) domain sender probe
code, resp = send(
    "concierge@kozycare.ng", "Kozy Care", "practiceprosystems@gmail.com",
    "[Kozy Care] Email system check - domain sender test",
    "<p>Delivery-path probe: sent from <b>concierge@kozycare.ng</b> (domain-sender test). "
    "If you can read this in your inbox, the branded sender is now valid in Brevo.</p>",
)
print(f"DOMAIN SENDER (concierge@kozycare.ng) -> HTTP {code}")
print(f"  {resp}")
domain_ok = code == 200

if not domain_ok:
    # 2) verified gmail sender probe (the last-known-good config)
    code2, resp2 = send(
        "chigozieubahesq@gmail.com", "Kozy Care", "practiceprosystems@gmail.com",
        "[Kozy Care] Test email - sending is fixed",
        "<div style='font-family:Georgia,serif;background:#F8F9FA;padding:24px;'>"
        "<h2 style='color:#0A192F;margin:0 0 8px;'>Kozy Care</h2>"
        "<p style='color:#333;line-height:1.6;'>This is the delivery-verification email after the fix. "
        "If you are reading this in <b>practiceprosystems@gmail.com</b>, transactional and test emails are flowing again.</p>"
        "<p style='color:#888;font-size:12px;'>Sent via Brevo from the verified sender, exactly as the app sends.</p></div>",
    )
    print(f"\nVERIFIED SENDER (chigozieubahesq@gmail.com) -> HTTP {code2}")
    print(f"  {resp2}")

print(f"\nVERDICT: domain sender {'ACCEPTED - keep it' if domain_ok else 'STILL REJECTED - revert env to verified sender'}")
