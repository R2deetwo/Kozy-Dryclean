"""Trigger Vercel deployment via API and configure kozycare.ng domain."""
import os
import json
import urllib.request
import urllib.error

TOKEN = os.environ.get("VERCEL_TOKEN", "")
TEAM_QUERY = "?teamId=team_RJD4xe4C4h3TiJ3M3iEa8idV"  # from project info above
PROJECT_ID = "prj_BUv0ZqDMzsONFBQXXCgBJfmIN43e"
PROJECT_NAME = "kozy-dryclean"
BASE = "https://api.vercel.com"

def api_call(method, path, body=None, expected=(200, 201, 202)):
    url = f"{BASE}{path}{TEAM_QUERY}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        try:
            err_json = json.loads(err)
        except Exception:
            err_json = {"raw": err}
        return e.code, err_json


# --- Step 1: Update NEXTAUTH_URL and NEXT_PUBLIC_APP_URL env vars to kozycare.ng ---
print("=" * 60)
print("STEP 1: Update Vercel env vars to kozycare.ng")
print("=" * 60)

# Find existing env var IDs by listing them
status, env_data = api_call("GET", f"/v9/projects/{PROJECT_NAME}/env")
if status != 200:
    print(f"ERROR listing env vars: HTTP {status}")
    print(json.dumps(env_data, indent=2)[:500])
    exit(1)

env_ids = {}
for env in env_data.get("envs", []):
    env_ids[env["key"]] = env["id"]

print(f"Found {len(env_ids)} existing env vars")
for key in ["NEXTAUTH_URL", "NEXT_PUBLIC_APP_URL"]:
    if key in env_ids:
        print(f"  - {key}: id={env_ids[key]}")

# Update each URL env var to kozycare.ng
for key in ["NEXTAUTH_URL", "NEXT_PUBLIC_APP_URL"]:
    eid = env_ids.get(key)
    if not eid:
        print(f"  ! {key} not found, skipping")
        continue
    # Remove existing, then recreate (Vercel API doesn't support in-place edit of value via simple PATCH on encrypted vars; the safest path is delete+create)
    print(f"  Deleting {key} (id={eid})...")
    status, body = api_call("DELETE", f"/v9/projects/{PROJECT_NAME}/env/{eid}")
    if status != 200:
        print(f"    Delete failed: HTTP {status}")
        print(json.dumps(body, indent=2)[:300])
        continue

    print(f"  Creating {key} = https://kozycare.ng...")
    create_body = {
        "key": key,
        "value": "https://kozycare.ng",
        "type": "plain",
        "target": ["production", "preview", "development"],
    }
    status, body = api_call("POST", f"/v10/projects/{PROJECT_NAME}/env", create_body)
    if status in (200, 201):
        print(f"    OK {key} set to https://kozycare.ng (new id={body.get('id')})")
    else:
        print(f"    Create failed: HTTP {status}")
        print(json.dumps(body, indent=2)[:300])


# --- Step 2: Add kozycare.ng + www.kozycare.ng as project domains ---
print()
print("=" * 60)
print("STEP 2: Add kozycare.ng + www.kozycare.ng domains to Vercel project")
print("=" * 60)

for domain in ["kozycare.ng", "www.kozycare.ng"]:
    # First check if it's already added
    status, body = api_call("GET", f"/v9/projects/{PROJECT_NAME}/domains/{domain}")
    if status == 200:
        print(f"  - {domain} already added to project")
        # Show verification config
        cfg = body.get("verification", {})
        print(f"      verification: {json.dumps(cfg)}")
        continue

    print(f"  Adding {domain}...")
    add_body = {
        "name": domain,
        "gitBranch": "main",
    }
    status, body = api_call("POST", f"/v9/projects/{PROJECT_NAME}/domains", add_body)
    if status in (200, 201):
        print(f"    OK {domain} added")
        cfg = body.get("verification", {})
        print(f"      verification config: {json.dumps(cfg, indent=2)}")
    else:
        print(f"    Failed: HTTP {status}")
        print(json.dumps(body, indent=2)[:500])


# --- Step 3: List project domains to get DNS verification records ---
print()
print("=" * 60)
print("STEP 3: List all project domains + DNS records needed")
print("=" * 60)

status, body = api_call("GET", f"/v9/projects/{PROJECT_NAME}/domains")
if status == 200:
    domains = body.get("domains", [])
    print(f"\nFound {len(domains)} domain(s) on the project:")
    for d in domains:
        print(f"\n  Domain: {d.get('name')}")
        print(f"    status:          {d.get('verified', 'unknown')}")
        print(f"    verification:    {json.dumps(d.get('verification', {}))}")
        intended = d.get("verification", {}).get("name", "")
        value = d.get("verification", {}).get("value", "")
        if intended and value:
            print(f"    To verify, add DNS record:")
            print(f"      Type:  TXT")
            print(f"      Name:  {intended}")
            print(f"      Value: {value}")
else:
    print(f"ERROR: HTTP {status}")
    print(json.dumps(body, indent=2)[:500])


# --- Step 4: Trigger a fresh production deployment from main branch ---
print()
print("=" * 60)
print("STEP 4: Trigger fresh production deployment from GitHub main")
print("=" * 60)

deploy_body = {
    "name": PROJECT_NAME,
    "target": "production",
    "gitSource": {
        "type": "github",
        "org": "R2deetwo",
        "repo": "Kozy-Dryclean",
        "ref": "main",
        "sha": None,  # let Vercel fetch latest main HEAD
    },
}
status, body = api_call("POST", "/v13/deployments", deploy_body)
if status in (200, 201, 202):
    deploy_id = body.get("id")
    deploy_url = body.get("url")
    print(f"\n  OK deployment triggered")
    print(f"    deployment ID: {deploy_id}")
    print(f"    build URL:      https://vercel.com/anthony-ubahs-projects/kozy-dryclean/{deploy_id}")
    print(f"    preview URL:    https://{deploy_url}" if deploy_url else "")
else:
    print(f"  Failed: HTTP {status}")
    print(json.dumps(body, indent=2)[:1000])
