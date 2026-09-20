import json, urllib.request
KEY = "REDACTED_SECRET"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
DOMID = "6aad2810051c28824204b13f"
def call(method, path, body=None):
    req = urllib.request.Request(f"https://api.brevo.com{path}",
        data=json.dumps(body).encode() if body is not None else None,
        headers={"api-key": KEY, "accept": "application/json", "content-type": "application/json", "User-Agent": UA}, method=method)
    try:
        with urllib.request.urlopen(req) as r: return r.status, r.read().decode()[:400]
    except urllib.error.HTTPError as e: return e.code, e.read().decode()[:400]
for method in ("GET", "PUT"):
    code, body = call(method, f"/v3/senders/domains/{DOMID}/authenticate", {} if method == "PUT" else None)
    print(f"{method} /authenticate -> HTTP {code} :: {body[:250]}")
# also try the domain-level authenticate with domain name in path
code, body = call("POST", "/v3/senders/domains/kozycare.ng/authenticate", {})
print(f"POST /senders/domains/kozycare.ng/authenticate -> HTTP {code} :: {body[:250]}")
