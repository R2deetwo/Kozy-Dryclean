#!/usr/bin/env python3
"""Task 80 — check which deployment is currently live on kozycare.ng."""
import json
import urllib.request

ROOT = "/home/z/my-project"
PROJ = "prj_BUv0ZqDMzsONFBQXXCgBJfmIN43e"
TEAM = "team_RJD4xe4C4h3TiJ3M3iEa8idV"


def token() -> str:
    with open(f"{ROOT}/.env") as f:
        for line in f:
            if line.startswith("VERCEL_TOKEN="):
                return line.split("=", 1)[1].strip()
    raise SystemExit("VERCEL_TOKEN missing from .env")


def api(path: str):
    req = urllib.request.Request(
        f"https://api.vercel.com{path}",
        headers={"Authorization": f"Bearer {token()}"},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


deploys = api(f"/v6/deployments?projectId={PROJ}&teamId={TEAM}&limit=8&target=production&state=READY")
for d in deploys.get("deployments", []):
    print(d.get("uid"), "|", d.get("url"), "|", d.get("createdAt"), "|",
          "target:", d.get("target"), "| meta:", json.dumps({k: v for k, v in (d.get("meta") or {}).items() if k in ("githubCommitSha", "githubCommitMessage", "cliCommitSha")}))

# env vars (handle pagination shape differences)
try:
    envs = api(f"/v9/projects/{PROJ}/env?teamId={TEAM}")
    if isinstance(envs, dict):
        envs = envs.get("envs", [])
    names = sorted(set(e.get("key") for e in envs if isinstance(e, dict)))
    print("\nENV VARS:", names)
    print("PAYSTACK_SECRET_KEY present:", "PAYSTACK_SECRET_KEY" in names)
except Exception as e:
    print("env listing failed:", repr(e))
