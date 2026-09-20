import json, urllib.request, time
KEY = "REDACTED_SECRET"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
def send(to):
    body = json.dumps({
        "sender": {"name": "Kozy Care", "email": "chigozieubahesq@gmail.com"},
        "to": [{"email": to}],
        "subject": "[Kozy Care] Rerouting test - email sent TO concierge@kozycare.ng",
        "htmlContent": "<div style='font-family:Georgia,serif;padding:20px;'><h2 style='color:#0A192F;margin:0 0 8px;'>Kozy Care</h2>"
          "<p style='color:#333;line-height:1.6;'>This email was sent to <b>concierge@kozycare.ng</b>. "
          "If you are reading it in your Gmail, the domain's email rerouting (MX -> forwarding) is working.</p>"
          "<p style='color:#888;font-size:12px;'>Forwarding target: practiceprosystems@gmail.com + kozygarmentcare@gmail.com</p></div>",
        "tags": ["kozy-transactional", "rerouting-check"],
    }).encode()
    req = urllib.request.Request("https://api.brevo.com/v3/smtp/email", data=body,
        headers={"api-key": KEY, "accept": "application/json", "content-type": "application/json", "User-Agent": UA})
    try:
        with urllib.request.urlopen(req) as r: return r.status, json.load(r)
    except urllib.error.HTTPError as e: return e.code, e.read().decode()[:300]
code, resp = send("concierge@kozycare.ng")
print(f"Send TO concierge@kozycare.ng -> HTTP {code} {str(resp)[:150]}")
