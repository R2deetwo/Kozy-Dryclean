import json, urllib.request, sys

KEY = "REDACTED_SECRET"
def get(path):
    req = urllib.request.Request(f"https://api.brevo.com{path}", headers={"api-key": KEY, "accept": "application/json"})
    try:
        with urllib.request.urlopen(req) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        return {"_http_error": e.code, "_body": e.read().decode()[:500]}

print("=== SENDERS ===")
s = get("/v3/senders?limit=50")
for snd in (s.get("senders") if isinstance(s, dict) else s) or []:
    print(f"  {snd.get('email'):35s} name={snd.get('name')!r:20s} active={snd.get('active')}")

print("\n=== RECENT TRANSACTIONAL EMAILS (last 60) ===")
t = get("/v3/smtp/transactional-emails?limit=60&sort=desc")
em = t.get("transactionalEmails", []) if isinstance(t, dict) else []
if not em: print("  (none or error:)", str(t)[:300])
for m in em:
    print(f"  {m.get('date','')[:19]} to={m.get('email'):35s} subj={(m.get('subject') or '')[:38]:38s} ev={m.get('event')} reason={str(m.get('reason'))[:60]} tags={m.get('tags')}")

print("\n=== EVENTS for practiceprosystems@gmail.com ===")
ev = get("/v3/smtp/statistics/events?limit=60&offset=0&days=40&email=practiceprosystems@gmail.com&sort=desc")
for e in (ev.get("events") or []):
    print(f"  {e.get('date','')[:19]} {e.get('event'):12s} subj={(e.get('subject') or '')[:40]:40s} reason={str(e.get('reason'))[:70]}")
if not (ev.get("events") or []): print("  (no events in last 40 days)")

print("\n=== ACCOUNT ===")
a = get("/v3/account")
print("  ", {k: a.get(k) for k in ("email","companyName","plan",)} if isinstance(a, dict) else a)
