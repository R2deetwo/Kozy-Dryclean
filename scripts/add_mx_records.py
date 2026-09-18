import json, urllib.request
TOKEN = "REDACTED_OLD_VERCEL_TOKEN"
TEAM = "team_RJD4xe4C4h3TiJ3M3iEa8idV"
def api(method, path, body=None):
    req = urllib.request.Request(f"https://api.vercel.com{path}", data=json.dumps(body).encode() if body else None,
        headers={"Authorization": f"Bearer {TOKEN}", "content-type": "application/json"}, method=method)
    try:
        with urllib.request.urlopen(req) as r: return r.status, json.load(r)
    except urllib.error.HTTPError as e: return e.code, e.read().decode()[:300]
for host, prio in [("mx1.forwardemail.net", 10), ("mx2.forwardemail.net", 20)]:
    code, resp = api("POST", f"/v4/domains/kozycare.ng/records?teamId={TEAM}", {"type": "MX", "name": "", "value": host, "mxPriority": prio, "ttl": 60})
    print(f"Create MX {host} prio {prio} -> HTTP {code} {str(resp)[:140]}")
