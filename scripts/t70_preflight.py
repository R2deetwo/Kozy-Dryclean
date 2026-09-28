#!/usr/bin/env python3
"""Task 70 preflight: verify tokens, find current prod deployment, confirm task-69 code is live."""
import json, os, urllib.request

TEAM = "team_RJD4xe4C4h3TiJ3M3iEa8idV"
PROJ = "prj_BUv0ZqDMzsONFBQXXCgBJfmIN43e"

TOKENS = [
    ("worklog-0gMi", "REDACTED_INVALID_PASTED_TOKEN"),
    ("scripts-8ACI", "REDACTED_OLD_VERCEL_TOKEN"),
]

def api(url, token):
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        return e.code, {}
    except Exception as e:
        return -1, {"err": str(e)}

good = None
for name, tok in TOKENS:
    st, data = api(f"https://api.vercel.com/v2/projects/{PROJ}?teamId={TEAM}", tok)
    print(f"token {name}: project GET -> {st}")
    if st == 200:
        good = (name, tok)
        # latest deployments
        st2, deps = api(f"https://api.vercel.com/v6/deployments?projectId={PROJ}&teamId={TEAM}&limit=6&target=production", tok)
        if st2 == 200:
            print(f"  prod deployments ({len(deps.get('deployments', []))}):")
            for d in deps.get("deployments", []):
                print(f"    {d['uid'][:22]}  state={d.get('readyState')}  created={d.get('createdAt')}  url={d.get('url')}")
        break

if not good:
    print("NO VALID TOKEN — need owner to supply fresh token")
else:
    name, tok = good
    # which deployment is serving kozycare.ng right now
    st, al = api(f"https://api.vercel.com/v4/deployments/getByUrl?url=kozycare.ng&teamId={TEAM}", tok)
    print(f"kozycare.ng resolves -> {st}")
    if st == 200:
        print(f"  live deployment id: {al.get('id')}  ready={al.get('readyState')}")
        print(f"  created: {al.get('createdAt')}")
    with open("/home/z/my-project/work/t70_preflight.json", "w") as f:
        json.dump({"token_name": name}, f)
