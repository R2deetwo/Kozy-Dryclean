import json, urllib.request
KEY = "REDACTED_SECRET"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
DOMID = "6aad2810051c28824204b13f"
def call(method, path, body=None):
    req = urllib.request.Request(f"https://api.brevo.com{path}",
        data=json.dumps(body).encode() if body else None,
        headers={"api-key": KEY, "accept": "application/json", "content-type": "application/json", "User-Agent": UA}, method=method)
    try:
        with urllib.request.urlopen(req) as r: return r.status, r.read().decode()[:300]
    except urllib.error.HTTPError as e: return e.code, e.read().decode()[:300]
for method, path in [("POST", f"/v3/senders/domains/{DOMID}/validate"),
                     ("POST", f"/v3/senders/domains/{DOMID}/authenticate"),
                     ("POST", f"/v3/senders/domains/{DOMID}/check-dns"),
                     ("PATCH", f"/v3/senders/domains/{DOMID}")]:
    code, body = call(method, path, {} if method != "PATCH" else {"authenticated": True})
    print(f"{method} {path.split('/v3/senders/domains/')[1]:28s} -> HTTP {code} :: {body[:180]}")
