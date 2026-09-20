import json, urllib.request
TOKEN = "REDACTED_OLD_VERCEL_TOKEN"
TEAM = "team_RJD4xe4C4h3TiJ3M3iEa8idV"
PROJ = "prj_BUv0ZqDMzsONFBQXXCgBJfmIN43e"
envs = json.load(open('/home/z/my-project/work/vercel-envs.json')).get('envs', [])
sid = next(e['id'] for e in envs if e['key'] == 'BREVO_SENDER_EMAIL')
print(f"BREVO_SENDER_EMAIL env id: {sid}, current targets: {next(e['target'] for e in envs if e['key']=='BREVO_SENDER_EMAIL')}")
req = urllib.request.Request(
    f"https://api.vercel.com/v10/projects/{PROJ}/env/{sid}?teamId={TEAM}",
    data=json.dumps({"value": "chigozieubahesq@gmail.com", "target": ["production", "preview", "development"]}).encode(),
    headers={"Authorization": f"Bearer {TOKEN}", "content-type": "application/json"}, method="PATCH")
try:
    with urllib.request.urlopen(req) as r:
        resp = json.load(r)
        print(f"PATCH -> HTTP {r.status}: value={resp.get('value')}, targets={resp.get('target')}")
except urllib.error.HTTPError as e:
    print("PATCH FAILED:", e.code, e.read().decode()[:300])
