#!/usr/bin/env python3
"""Recover Kozy-Dryclean source from Vercel production deployment (phase-20, 3de3f4a)."""
import json, os, urllib.request, sys

VT = os.environ.get("VERCEL_TOKEN", "")
TEAM = "team_RJD4xe4C4h3TiJ3M3iEa8idV"
DPL = "dpl_BtP4sYJAUc8k4wwdKWWUa39VvVVm"
OUT = "/home/z/Kozy-Dryclean"

with open("/home/z/my-project/work/dpl_files.json") as f:
    tree = json.load(f)

files = []  # (relpath, uid)
SKIP_DIRS = {".git", "node_modules", ".next", ".turbo", ".vercel", ".zscripts",
             "tool-results", "tests", "download", "examples", "mini-services"}

def strip_prefix(rel):
    # deployment tree nests the repo root under "src/"
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
            files.append((strip_prefix(path), child["uid"]))

walk(tree, "")
print(f"Total files to download: {len(files)}")

# Filter: only track src, prisma, public (text/asset sources we need) + config files
def wanted(rel):
    top = rel.split("/")[0]
    if top in ("src", "prisma", "public", "scripts"):
        return True
    # root-level config files
    return "/" not in rel and rel in (
        "package.json", "package-lock.json", "tsconfig.json", "next.config.ts",
        "tailwind.config.ts", "postcss.config.mjs", "components.json",
        "prisma.schema", "README.md", "middleware.ts", ".env.example", ".gitignore",
    )

targets = [(p, u) for p, u in files if wanted(p)]
print(f"Filtered targets: {len(targets)}")
for p, _ in targets[:200]:
    print(" ", p)

ok, fail = 0, 0
for i, (rel, uid) in enumerate(targets):
    dest = os.path.join(OUT, rel)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    url = f"https://api.vercel.com/v8/deployments/{DPL}/files/{uid}?teamId={TEAM}"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {VT}"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            payload = json.load(r)
        import base64
        data = base64.b64decode(payload["data"])
        with open(dest, "wb") as f:
            f.write(data)
        ok += 1
        if (i + 1) % 50 == 0:
            print(f"[{i+1}/{len(targets)}] downloaded...", flush=True)
    except Exception as e:
        fail += 1
        print(f"FAIL {rel}: {e}")

print(f"\nDone. ok={ok} fail={fail}")
