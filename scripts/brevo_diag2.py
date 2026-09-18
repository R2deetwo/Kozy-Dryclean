import json, urllib.request
KEY = "REDACTED_SECRET"
def get(path):
    req = urllib.request.Request(f"https://api.brevo.com{path}", headers={"api-key": KEY, "accept": "application/json"})
    try:
        with urllib.request.urlopen(req) as r: return json.load(r)
    except urllib.error.HTTPError as e:
        return {"_http_error": e.code, "_body": e.read().decode()[:800]}
print("=== RAW SENDERS RESPONSE ===")
print(json.dumps(get("/v3/senders?limit=100"), indent=2)[:2000])
print("\n=== FULL REJECTION REASON ===")
ev = get("/v3/smtp/statistics/events?limit=3&days=2&email=practiceprosystems@gmail.com&sort=desc&event=error")
for e in (ev.get("events") or []):
    print(json.dumps(e, indent=2)[:1200])
