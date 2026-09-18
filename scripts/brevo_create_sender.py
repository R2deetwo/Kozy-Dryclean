import json, urllib.request
KEY = "REDACTED_SECRET"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
def call(method, path, body=None):
    req = urllib.request.Request(f"https://api.brevo.com{path}",
        data=json.dumps(body).encode() if body is not None else None,
        headers={"api-key": KEY, "accept": "application/json", "content-type": "application/json", "User-Agent": UA}, method=method)
    try:
        with urllib.request.urlopen(req) as r: return r.status, r.read().decode()[:500]
    except urllib.error.HTTPError as e: return e.code, e.read().decode()[:500]
code, body = call("POST", "/v3/senders", {"name": "Kozy Care", "email": "concierge@kozycare.ng"})
print(f"POST /v3/senders concierge@kozycare.ng -> HTTP {code}")
print(body)
code, body = call("GET", "/v3/senders?limit=100")
print("\nSenders now:")
for s in json.loads(body).get("senders", []):
    print(f"  id={s.get('id')} {s.get('email'):30s} name={s.get('name')!r} active={s.get('active')}")
