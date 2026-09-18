import json, urllib.request
KEY = "REDACTED_SECRET"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
req = urllib.request.Request("https://api.brevo.com/v3/smtp/statistics/events?limit=3&days=1&email=concierge@kozycare.ng&sort=desc&event=deferred",
    headers={"api-key": KEY, "accept": "application/json", "User-Agent": UA})
with urllib.request.urlopen(req) as r:
    ev = json.load(r)
for e in ev.get("events") or []:
    print(json.dumps(e, indent=2))
