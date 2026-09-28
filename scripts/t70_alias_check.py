#!/usr/bin/env python3
"""Find the deployment currently aliased to kozycare.ng."""
import json, urllib.request

TEAM = "team_RJD4xe4C4h3TiJ3M3iEa8idV"
PROJ = "prj_BUv0ZqDMzsONFBQXXCgBJfmIN43e"
TOK = "REDACTED_INVALID_PASTED_TOKEN"

def api(url):
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {TOK}"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.load(e)
        except Exception:
            return e.code, {}
    except Exception as e:
        return -1, {"err": str(e)}

for endpoint in [
    f"https://api.vercel.com/v4/aliases?teamId={TEAM}&domain=kozycare.ng&limit=20",
    f"https://api.vercel.com/v4/aliases?teamId={TEAM}&projectId={PROJ}&limit=30",
]:
    st, data = api(endpoint)
    print(f"{endpoint.split('?')[1][:40]}... -> {st}")
    if st == 200:
        for a in data.get("aliases", []):
            dep = a.get("deployment") or {}
            print(f"  alias={a.get('alias')}  dep={dep.get('id')}  created={a.get('createdAt')}  target={dep.get('target')}")
    print()
