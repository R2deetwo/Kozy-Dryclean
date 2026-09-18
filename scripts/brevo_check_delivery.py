import json, urllib.request, time
KEY = "REDACTED_SECRET"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"
def get(path):
    req = urllib.request.Request(f"https://api.brevo.com{path}", headers={"api-key": KEY, "accept": "application/json", "User-Agent": UA})
    try:
        with urllib.request.urlopen(req) as r: return json.load(r)
    except urllib.error.HTTPError as e:
        return {"_err": e.code, "_body": e.read().decode()[:300]}
ev = get("/v3/smtp/statistics/events?limit=10&days=1&email=practiceprosystems@gmail.com&sort=desc")
for e in (ev.get("events") or []):
    print(f"  {e.get('date','')[:19]} {e.get('event'):10s} from={e.get('from','?'):28s} subj={(e.get('subject') or '')[:52]}")
    if e.get('event') == 'error': print(f"     reason: {e.get('reason')}")
