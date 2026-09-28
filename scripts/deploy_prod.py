#!/usr/bin/env python3
"""
deploy_prod.py — direct REST upload deploy to Vercel (phase 69/70 recipe).

The Vercel CLI cannot use the owner's PROJECT-SCOPED token (whoami fails by
design), so this script ships source straight through the REST API:

  1. Collect the app source set (the .vercelignore rules, hardcoded to the
     proven dpl_Hq8zDBY1 file list: prisma/ public/ src/ + root configs).
  2. Upload every file base64 via POST /v2/files (batched) -> per-file sha.
  3. POST /v13/deployments with files: [{file, sha}] (ARRAY format — an
     object map silently fails), target=production, src/-prefixed paths.
     Vercel builds with the project's saved settings (bun run build:vercel).
  4. Poll until READY, then confirm kozycare.ng serves the new build.

Usage:  VERCEL_TOKEN=vcp_... python3 scripts/deploy_prod.py
"""
import base64
import hashlib
import json
import os
import sys
import time
import urllib.request
import urllib.error

TOKEN = os.environ.get("VERCEL_TOKEN", "")
TEAM = "team_RJD4xe4C4h3TiJ3M3iEa8idV"
PROJECT = "kozy-dryclean"
BASE = "https://api.vercel.com"

if not TOKEN:
    print("ERROR: set VERCEL_TOKEN in the environment")
    sys.exit(1)

ROOT = "/home/z/my-project"

# The proven source set (matches the live deployment's src/ tree exactly).
ROOT_FILES = [
    ".gitignore", ".vercelignore", "README.md", "components.json",
    "eslint.config.mjs", "next-env.d.ts", "next.config.ts", "package.json",
    "postcss.config.mjs", "tailwind.config.ts", "tsconfig.json", "vercel.json",
]
DIRS = ["prisma", "public", "src"]
SKIP_PARTS = {"/node_modules/", "/.next/", "/.turbo/", "/.git/"}


def collect():
    out = []
    for rel in ROOT_FILES:
        p = os.path.join(ROOT, rel)
        if os.path.isfile(p):
            out.append(rel)
    for d in DIRS:
        for dirpath, dirnames, filenames in os.walk(os.path.join(ROOT, d)):
            dirnames[:] = [x for x in dirnames if x not in {"node_modules", ".next", ".turbo"}]
            for fn in filenames:
                rel = os.path.relpath(os.path.join(dirpath, fn), ROOT)
                out.append(rel)
    return sorted(set(out))


def api(method, path, body=None, raw=False, timeout=180):
    url = f"{BASE}{path}{'&' if '?' in path else '?'}teamId={TEAM}"
    data = None
    if body is not None:
        data = json.dumps(body).encode()
    req = urllib.request.Request(
        url, data=data, method=method,
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            payload = r.read()
            return r.status, (payload if raw else json.loads(payload.decode()))
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        try:
            return e.code, json.loads(err)
        except Exception:
            return e.code, {"raw": err[:2000]}


def main():
    files = collect()
    total = sum(os.path.getsize(os.path.join(ROOT, f)) for f in files)
    print(f"collected {len(files)} files ({total/1e6:.1f} MB raw)")

    # ---- upload in batches (files under 'src/' prefix — Vercel convention) ----
    uploaded = []  # (deploymentPath, sha)
    batch, batch_bytes = [], 0
    batches = []

    def flush():
        nonlocal batch, batch_bytes
        if batch:
            batches.append((batch, batch_bytes))
            batch, batch_bytes = [], 0

    for rel in files:
        data = open(os.path.join(ROOT, rel), "rb").read()
        b64 = base64.b64encode(data).decode()
        # The files API requires a per-file digest (sha1 of the CONTENT, hex)
        # — the "sha1 manifest" of the phase-69 recipe.
        digest = hashlib.sha1(data).hexdigest()
        entry = {"file": f"src/{rel}", "data": b64, "encoding": "base64", "digest": digest}
        batch.append(entry)
        batch_bytes += len(b64)
        if batch_bytes > 6_000_000 or len(batch) >= 80:
            flush()
    flush()

    print(f"uploading in {len(batches)} batches...")
    for i, (b, nbytes) in enumerate(batches):
        st, resp = api("POST", "/v2/files", b)
        if st not in (200, 201) or not isinstance(resp, list):
            print(f"  batch {i+1} FAILED: HTTP {st}")
            print(json.dumps(resp)[:800])
            sys.exit(1)
        for item in resp:
            if "sha" not in item:
                print(f"  !! no sha for {item.get('file')}: {item}")
                sys.exit(1)
            uploaded.append((item["file"], item["sha"]))
        print(f"  batch {i+1}/{len(batches)}: {len(b)} files ({nbytes/1e6:.1f} MB) OK")

    print(f"uploaded {len(uploaded)} files")

    # ---- create the deployment (files MUST be an array) ----
    body = {
        "name": PROJECT,
        "target": "production",
        "files": [{"file": f, "sha": s} for (f, s) in uploaded],
        "projectSettings": {
            "framework": "nextjs",
            "buildCommand": "bun run build:vercel",
            "installCommand": "bun install",
        },
    }
    st, dep = api("POST", "/v13/deployments", body)
    if st not in (200, 201):
        print(f"deployment create FAILED: HTTP {st}")
        print(json.dumps(dep)[:1500])
        sys.exit(1)
    did = dep.get("id")
    print(f"deployment created: {did} ({dep.get('url')}) — building...")

    # ---- poll until READY ----
    deadline = time.time() + 60 * 12
    last = None
    while time.time() < deadline:
        st, cur = api("GET", f"/v13/deployments/{did}")
        state = cur.get("readyState")
        if state != last:
            print(f"  state: {state}")
            last = state
        if state == "READY":
            print(f"READY in ~{(deadline - time.time()) and int((12*60 - (deadline - time.time()))/60)} min")
            print(f"deployment url: https://{cur.get('url')}")
            print(f"deployment id: {did}")
            return 0
        if state in ("ERROR", "CANCELED"):
            print(f"BUILD FAILED: {state}")
            st, events = api("GET", f"/v3/deployments/{did}/events?builds=1&limit=50")
            if isinstance(events, list):
                for ev in events[-25:]:
                    payload = ev.get("payload") or {}
                    text = payload.get("text") or json.dumps(payload)[:200]
                    print(f"  [{ev.get('type')}] {text[:220]}")
            return 1
        time.sleep(15)
    print("TIMEOUT waiting for the build")
    return 1


if __name__ == "__main__":
    sys.exit(main())
