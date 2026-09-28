#!/usr/bin/env python3
"""Task 70: recover live prod source (dpl_Hq8zDBY1...) into work/prod-recovery/."""
import json, os, base64, urllib.request, sys

TEAM = "team_RJD4xe4C4h3TiJ3M3iEa8idV"
DPL = "dpl_Hq8zDBY1vSCUXwMgn7wvzrd9xsQc"
TOK = "REDACTED_INVALID_PASTED_TOKEN"
OUT = "/home/z/my-project/work/prod-recovery"

def api(url):
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {TOK}"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)

# 1. file tree
tree = api(f"https://api.vercel.com/v13/deployments/{DPL}/files?teamId={TEAM}&mode=resolved")
with open("/home/z/my-project/work/t70_dpl_files.json", "w") as f:
    json.dump(tree, f)

files = []  # (relpath, uid, size)
SKIP_DIRS = {".git", "node_modules", ".next", ".turbo", ".vercel", ".zscripts",
             "tool-results", "tests", "download", "examples", "mini-services", "work", "scripts"}

def strip_prefix(rel):
    return rel[4:] if rel.startswith("src/") else rel

def walk(node, prefix):
    for child in node:
        name = child["name"]
        path = f"{prefix}/{name}" if prefix else name
        if child["type"] == "directory":
            if name in SKIP_DIRS:
                continue
            walk(child.get("children", []), path)
        else:
            files.append((strip_prefix(path), child["uid"], child.get("size", 0)))

walk(tree, [])
print(f"Total files in deployment (filtered): {len(files)}")

# 2. filter to what we need to restore the repo
def wanted(rel):
    top = rel.split("/")[0]
    if top in ("src", "prisma", "public"):
        return True
    return "/" not in rel and rel in (
        "package.json", "bun.lock", "tsconfig.json", "next.config.ts",
        "tailwind.config.ts", "postcss.config.mjs", "components.json",
        "eslint.config.mjs", "README.md", "vercel.json", "middleware.ts",
        ".env.example", ".gitignore", "DEPLOYMENT.md", "ARCHITECTURE.md",
        "Caddyfile", "HANDOVER.md", "worklog.md",
    )

targets = [(p, u) for p, u, s in files if wanted(p)]
print(f"Targets to download: {len(targets)}")

ok, fail = 0, 0
for i, (rel, uid) in enumerate(targets):
    dest = os.path.join(OUT, rel)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    url = f"https://api.vercel.com/v8/deployments/{DPL}/files/{uid}?teamId={TEAM}"
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"Authorization": f"Bearer {TOK}"}), timeout=90) as r:
            payload = json.load(r)
        data = payload.get("data", "")
        enc = payload.get("encoding", "base64")
        if enc == "base64":
            content = base64.b64decode(data)
        else:
            content = data.encode() if isinstance(data, str) else data
        with open(dest, "wb") as f:
            f.write(content)
        ok += 1
    except Exception as e:
        fail += 1
        print(f"  FAIL {rel}: {e}")
    if (i + 1) % 200 == 0:
        print(f"  ...{i+1}/{len(targets)} (ok={ok} fail={fail})")

print(f"DONE ok={ok} fail={fail}")
