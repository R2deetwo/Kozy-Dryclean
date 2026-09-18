"""Wire real inbound email routing for kozycare.ng via ForwardEmail:
   MX 10 mx1.forwardemail.net / MX 20 mx2.forwardemail.net
   TXT "forward-email=practiceprosystems@gmail.com,kozygarmentcare@gmail.com" (catch-all)
Every address @kozycare.ng (concierge@, support@, anything@) then forwards
to both owner inboxes. Pure DNS setup - no third-party account required.
"""
import json, urllib.request

TOKEN = "REDACTED_OLD_VERCEL_TOKEN"
TEAM = "team_RJD4xe4C4h3TiJ3M3iEa8idV"
DOMAIN = "kozycare.ng"

def api(method, path, body=None):
    req = urllib.request.Request(
        f"https://api.vercel.com{path}",
        data=json.dumps(body).encode() if body else None,
        headers={"Authorization": f"Bearer {TOKEN}", "content-type": "application/json"},
        method=method,
    )
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:400]

# sanity: no existing MX records (confirmed via dig, but check API state too)
code, recs = api("GET", f"/v4/domains/{DOMAIN}/records?teamId={TEAM}&limit=100")
mx = [r for r in recs.get("records", []) if r.get("type") == "MX"]
fwd = [r for r in recs.get("records", []) if "forward-email" in (r.get("value") or "")]
print(f"Existing MX records: {len(mx)}, existing forward-email TXT: {len(fwd)}")

if mx or fwd:
    print("Something already exists - NOT adding duplicates. Aborting.")
    raise SystemExit(1)

new_records = [
    {"type": "MX", "name": "", "value": "mx1.forwardemail.net", "priority": 10, "ttl": 60},
    {"type": "MX", "name": "", "value": "mx2.forwardemail.net", "priority": 20, "ttl": 60},
    {"type": "TXT", "name": "", "value": "forward-email=practiceprosystems@gmail.com,kozygarmentcare@gmail.com", "ttl": 60},
]
for rec in new_records:
    code, resp = api("POST", f"/v4/domains/{DOMAIN}/records?teamId={TEAM}", rec)
    print(f"Create {rec['type']} {rec['value'][:60]} -> HTTP {code} {str(resp)[:120]}")

# verify
code, recs = api("GET", f"/v4/domains/{DOMAIN}/records?teamId={TEAM}&limit=100")
for r in recs.get("records", []):
    if r.get("type") in ("MX",) or "forward-email" in (r.get("value") or ""):
        print(f"  NOW LIVE IN API: {r['type']:4s} {r.get('name') or '@':4s} -> {r.get('value')} (prio {r.get('priority','-')})")
