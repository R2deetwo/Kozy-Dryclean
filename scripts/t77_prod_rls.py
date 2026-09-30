#!/usr/bin/env python3
"""Task 77 — IMMEDIATE prod Supabase RLS lockdown (the "tables are public"
security-advisor email). Decrypts DIRECT_URL from Vercel env (t73 pattern),
then enables Row Level Security on every table that actually exists in the
prod public schema + strips the anon/authenticated direct grants.

Why this is safe for the running app: Prisma connects as the table OWNER
(the postgres role) — owners bypass RLS (tables are not FORCEd). The exposed
PostgREST roles (anon / authenticated) get zero rows from this moment on.
The RLS statements are idempotent, so the 20260930100000_store_rls_security
migration re-applying them at the next deploy is harmless."""
import json
import os
import subprocess
import sys
import urllib.request

ROOT = "/home/z/my-project"
PROJ = "prj_BUv0ZqDMzsONFBQXXCgBJfmIN43e"
TEAM = "team_RJD4xe4C4h3TiJ3M3iEa8idV"
DIRECT_URL_ENV_ID = "1ACj5gEPmRXfWwbW"  # DIRECT_URL (t73-verified)


def token() -> str:
    with open(f"{ROOT}/.env") as f:
        for line in f:
            if line.startswith("VERCEL_TOKEN="):
                return line.split("=", 1)[1].strip()
    raise SystemExit("VERCEL_TOKEN missing from .env")


def api(path: str) -> dict:
    req = urllib.request.Request(
        f"https://api.vercel.com{path}",
        headers={"Authorization": f"Bearer {token()}"},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def main() -> None:
    # 1) Decrypt the direct URL (also proves the token works).
    env = api(
        f"/v9/projects/{PROJ}/env/{DIRECT_URL_ENV_ID}?decrypt=true&teamId={TEAM}"
    )
    url = (env.get("value") or "").strip().strip('"')
    if not url.startswith("postgres"):
        raise SystemExit(f"could not decrypt DIRECT_URL: {json.dumps(env)[:300]}")
    print("decrypted DIRECT_URL OK (len", len(url), ")")

    # 2) Run the RLS lockdown through Prisma (the embedded psql has no SSL
    #    support, so Prisma's engine is the reliable channel).
    res = subprocess.run(
        ["bunx", "tsx", "scripts/t77_prod_rls.ts"],
        cwd=ROOT,
        env={**os.environ, "DATABASE_URL": url, "DIRECT_URL": url},
        capture_output=True,
        text=True,
        timeout=180,
    )
    print(res.stdout)
    if res.returncode != 0:
        print(res.stderr[-1500:])
        raise SystemExit(1)
    print("PROD RLS LOCKDOWN COMPLETE")


if __name__ == "__main__":
    sys.exit(main())
