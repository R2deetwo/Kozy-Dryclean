#!/usr/bin/env python3
"""
Kozy Care — production backup + RESTORE REHEARSAL (audit P1, phase 71).

Why pure Python: the sandbox's pg_dump (16.2, no SSL) cannot dump Supabase's
PG 17.6. psycopg2 (SSL-capable) exports every table via COPY; the schema
comes from the committed Prisma migrations — so a restore also validates the
migration baseline. A backup that has never been restored is a hope, not a
backup.

What this does (read-only against prod; restores only into a LOCAL scratch
DB it creates and drops):
  1. Decrypts DIRECT_URL from the Vercel project env (never written to disk).
  2. Exports every public table's rows (COPY text format) into ONE timestamped
     .sql file: work/backups/kozy-prod-<stamp>.sql (with a restore header).
     _prisma_migrations is skipped — the scratch side gets its own from
     `prisma migrate deploy`.
  3. Rehearses the restore: scratch DB -> migrate deploy (schema) ->
     psql -f backup.sql (data, FK checks deferred via session_replication_role).
  4. Verifies row counts table-by-table (prod vs restored).
  5. Drops the scratch DB; the .sql file stays for the owner.

Usage:
  python3 scripts/backup_rehearsal.py          # full rehearsal
  python3 scripts/backup_rehearsal.py dump     # dump only (weekly ritual)

Owner ritual: run weekly (or before risky changes); keep the .sql files in
cloud storage. Supabase also keeps platform backups — this is the independent
copy that survives a Supabase account problem.

Restore recipe (the real thing, if prod ever needs it):
  1. Point DATABASE_URL/DIRECT_URL at a fresh empty database.
  2. npx prisma migrate deploy        (schema + migration history)
  3. psql "$DIRECT_URL" -f kozy-prod-<stamp>.sql   (data)
"""
import io
import json
import os
import subprocess
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import psycopg2

ROOT = Path("/home/z/my-project")
TOK = os.environ.get(
    "VERCEL_TOKEN",
    "REDACTED_INVALID_PASTED_TOKEN",
)
TEAM = "team_RJD4xe4C4h3TiJ3M3iEa8idV"
PROJ = "prj_BUv0ZqDMzsONFBQXXCgBJfmIN43e"
DIRECT_ENV_ID = "1ACj5gEPmRXfWwbW"  # DIRECT_URL (non-pooled 5432)

PSQL = str(
    ROOT
    / "work/pgvenv/lib/python3.12/site-packages/pgserver/pginstall/bin/psql"
)


def fail(msg):
    print(f"FATAL: {msg}", file=sys.stderr)
    sys.exit(1)


# ---------------------------------------------------------------- 1. URL
req = urllib.request.Request(
    f"https://api.vercel.com/v9/projects/{PROJ}/env/{DIRECT_ENV_ID}"
    f"?decrypt=true&teamId={TEAM}",
    headers={"Authorization": f"Bearer {TOK}"},
)
with urllib.request.urlopen(req, timeout=30) as r:
    url = (json.load(r).get("value") or "").strip().strip('"')
if not url.startswith("postgres"):
    fail("could not decrypt DIRECT_URL")
print(f"[1/5] DIRECT_URL decrypted (len {len(url)})")

conn = psycopg2.connect(url)
conn.set_session(readonly=True, autocommit=True)


def table_names(c):
    with c.cursor() as cur:
        cur.execute(
            """SELECT table_name FROM information_schema.tables
               WHERE table_schema='public' AND table_type='BASE TABLE'
                 AND table_name != '_prisma_migrations'
               ORDER BY table_name"""
        )
        return [row[0] for row in cur.fetchall()]


def column_list(c, table):
    """Column names in the SOURCE's physical order. Explicit column lists
    make the COPY import immune to physical-order drift between a db-push
    era database and the migration-baseline schema."""
    with c.cursor() as cur:
        cur.execute(
            """SELECT column_name FROM information_schema.columns
               WHERE table_schema='public' AND table_name=%s
               ORDER BY ordinal_position""",
            (table,),
        )
        return [row[0] for row in cur.fetchall()]


def row_count(c, table):
    with c.cursor() as cur:
        cur.execute(f'SELECT count(*) FROM "{table}"')
        return cur.fetchone()[0]


tables = table_names(conn)
prod_counts = {t: row_count(conn, t) for t in tables}
columns = {t: column_list(conn, t) for t in tables}

# ---------------------------------------------------------------- 2. dump
stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
backup_dir = ROOT / "work/backups"
backup_dir.mkdir(parents=True, exist_ok=True)
out_path = backup_dir / f"kozy-prod-{stamp}.sql"

header = (
    "-- Kozy Care production data backup\n"
    f"-- taken: {datetime.now(timezone.utc).isoformat()}Z\n"
    f"-- tables: {len(tables)} | rows: {sum(prod_counts.values())}\n"
    "--\n"
    "-- RESTORE RECIPE (schema comes from the committed Prisma migrations):\n"
    "--   1. fresh empty database + DATABASE_URL/DIRECT_URL pointed at it\n"
    "--   2. npx prisma migrate deploy\n"
    "--   3. psql \"$DIRECT_URL\" -f " + out_path.name + "\n"
    "-- (FK checks are deferred by the SET session_replication_role below;\n"
    "--  it requires superuser, which the local rehearsal user is.)\n"
    "SET session_replication_role = replica;\n"
)

parts = [header]
for t in tables:
    cols = ",".join(f'"{c}"' for c in columns[t])
    buf = io.StringIO()
    with conn.cursor() as cur:
        # explicit column list: physical column order may differ between the
        # db-push-era source and the migration-baseline restore target
        cur.copy_expert(f'COPY "{t}" ({cols}) TO STDOUT', buf)  # text format
    data = buf.getvalue()
    parts.append(f'\n-- table: {t} ({prod_counts[t]} rows)\n')
    parts.append(f'COPY "{t}" ({cols}) FROM stdin;\n')
    if data:
        parts.append(data if data.endswith("\n") else data + "\n")
    parts.append("\\.\n")
parts.append("\nSET session_replication_role = DEFAULT;\n")
out_path.write_text("".join(parts), encoding="utf-8")
size_kb = out_path.stat().st_size // 1024
print(f"[2/5] exported {sum(prod_counts.values())} rows / {len(tables)} tables -> {out_path} ({size_kb} KB)")

conn.close()

if len(sys.argv) > 1 and sys.argv[1] == "dump":
    print("dump-only mode: DONE. Keep the file somewhere safe (cloud storage).")
    sys.exit(0)

# ---------------------------------------------------------------- 3. restore
local = "postgresql://postgres:postgres@127.0.0.1:54329/kozy_rehearsal"


def psql(db, *args):
    return subprocess.run(
        [PSQL, "-h", "127.0.0.1", "-p", "54329", "-U", "postgres", "-d", db, *args],
        capture_output=True,
        text=True,
    )


r = psql("postgres", "-c", "DROP DATABASE IF EXISTS kozy_rehearsal;")
r = psql("postgres", "-c", "CREATE DATABASE kozy_rehearsal;")
if r.returncode != 0:
    fail(f"scratch DB create failed: {r.stderr[-300:]}")

env = dict(os.environ)
env["DATABASE_URL"] = local
env["DIRECT_URL"] = local
mig = subprocess.run(
    ["npx", "prisma", "migrate", "deploy"], cwd=str(ROOT), env=env,
    capture_output=True, text=True,
)
if mig.returncode != 0 or "failed" in (mig.stdout + mig.stderr).lower():
    fail(f"migrate deploy on scratch failed:\n{(mig.stdout + mig.stderr)[-500:]}")

r = subprocess.run(
    [PSQL, local, "-v", "ON_ERROR_STOP=1", "-f", str(out_path)],
    capture_output=True,
    text=True,
)
if r.returncode != 0:
    fail(f"restore failed:\n{(r.stderr or r.stdout)[-800:]}")
print("[3/5] restored schema (migrations) + data (COPY) into kozy_rehearsal")

# ---------------------------------------------------------------- 4. verify
vconn = psycopg2.connect(local)
vconn.set_session(readonly=True, autocommit=True)
mismatch = []
for t in tables:
    got = row_count(vconn, t)
    status = "OK " if got == prod_counts[t] else "MISMATCH"
    if got != prod_counts[t]:
        mismatch.append(t)
    print(f"  {status} {t:35s} prod={prod_counts[t]:>7}  restored={got}")
vconn.close()

if mismatch:
    fail(f"REHEARSAL FAILED on: {mismatch}")
print(f"[4/5] all {len(tables)} tables match — the backup RESTORES cleanly")

# ---------------------------------------------------------------- 5. cleanup
r = psql("postgres", "-c", "DROP DATABASE kozy_rehearsal;")
if r.returncode != 0:
    print("WARN: scratch DB drop failed — drop kozy_rehearsal manually")
print(f"[5/5] scratch DB dropped. Backup kept at: {out_path}")
print("REHEARSAL PASSED — file a copy of the .sql in cloud storage.")
