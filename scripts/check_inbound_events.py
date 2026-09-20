import json, urllib.request
KEY = "REDACTED_SECRET"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
req = urllib.request.Request("https://api.brevo.com/v3/smtp/statistics/events?limit=8&days=1&email=concierge@kozycare.ng&sort=desc",
    headers={"api-key": KEY, "accept": "application/json", "User-Agent": UA})
with urllib.request.urlopen(req) as r:
    ev = json.load(r)
events = ev.get("events") or []
if not events:
    print("No events yet for concierge@kozycare.ng (check again shortly)")
for e in events:
    print(f"  {e.get('date','')[:19]} {e.get('event'):10s} subj={(e.get('subject') or '')[:60]}")
    if e.get('reason'): print(f"     reason: {str(e.get('reason'))[:120]}")
