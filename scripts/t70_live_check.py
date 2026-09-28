#!/usr/bin/env python3
"""Check which deployment serves kozycare.ng + details of the newest deployments."""
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
        return e.code, {}
    except Exception as e:
        return -1, {"err": str(e)}

# 1. aliases of kozycare.ng
st, al = api(f"https://api.vercel.com/v4/domains/kozycare.ng/aliases?teamId={TEAM}&limit=20")
print(f"domain aliases -> {st}")
if st == 200:
    for a in al.get("aliases", []):
        print(f"  {a.get('alias')} -> {a.get('deployment', {}).get('id')} ({a.get('deployment', {}).get('url')})")

# 2. deployment details for the two newest
for did in ["dpl_Hq8zDBY1vSCUXwMgn7", "dpl_7m4TZjdFdPDq4bkorU", "dpl_CFFiQLB6qR4a7c4DQy"]:
    # need full id — list deployments to get full ids
    pass

st, deps = api(f"https://api.vercel.com/v6/deployments?projectId={PROJ}&teamId={TEAM}&limit=8&target=production")
if st == 200:
    for d in deps.get("deployments", []):
        did = d["uid"]
        st2, det = api(f"https://api.vercel.com/v13/deployments/{did}?teamId={TEAM}")
        meta = det.get("meta", {}) if st2 == 200 else {}
        aliases = det.get("alias", []) if st2 == 200 else []
        print(f"\n{did}")
        print(f"  state={det.get('readyState')} target={det.get('target')} created={det.get('createdAt')}")
        print(f"  aliases={aliases}")
        print(f"  commit={meta.get('githubCommitSha', 'n/a')[:10]} msg={meta.get('githubCommitMessage', 'n/a')[:80]}")
        print(f"  sha_in_msg={meta.get('githubCommitMessage', '')[:60]}")
