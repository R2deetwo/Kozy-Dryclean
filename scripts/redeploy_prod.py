import json, urllib.request, time
TOKEN = "REDACTED_OLD_VERCEL_TOKEN"
TEAM = "team_RJD4xe4C4h3TiJ3M3iEa8idV"
def api(method, path, body=None):
    req = urllib.request.Request(f"https://api.vercel.com{path}",
        data=json.dumps(body).encode() if body else None,
        headers={"Authorization": f"Bearer {TOKEN}", "content-type": "application/json"}, method=method)
    try:
        with urllib.request.urlopen(req) as r: return r.status, json.load(r)
    except urllib.error.HTTPError as e: return e.code, e.read().decode()[:400]
# redeploy the CURRENT production deployment (same source, fresh env vars)
code, resp = api("POST", f"/v13/deployments?teamId={TEAM}",
                 {"name": "kozy-dryclean", "url": "kozy-dryclean-blcr95u30-anthony-ubahs-projects.vercel.app", "target": "production"})
print(f"Create redeploy -> HTTP {code}")
uid = resp.get("id") or resp.get("uid") if isinstance(resp, dict) else None
print(f"  deployment: {uid} readyState={resp.get('readyState') if isinstance(resp,dict) else resp}")
if code in (200, 201) and uid:
    for i in range(24):
        time.sleep(15)
        c, d = api("GET", f"/v13/deployments/{uid}?teamId={TEAM}")
        state = d.get("readyState")
        print(f"  [{i*15+15}s] readyState={state}")
        if state == "READY": break
        if state in ("ERROR", "CANCELED"): print("  ", json.dumps(d)[:500]); break
