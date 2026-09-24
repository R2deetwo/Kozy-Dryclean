#!/bin/bash
# Phase 60 — boot the dev server (local PG) and run the intelligence-layer
# QA battery. Emails: NONE can fire — the battery's only mutation is one
# driverId-only assignment (no email path), and everything else is reads.
# One invocation (background processes die between bash calls).
set -u
cd /home/z/my-project

LOG=work/p60-dev.log
rm -f "$LOG"

echo "[p60] unit tests (pure engines) ..."
bun scripts/p60_unit.ts || exit 1

echo "[p60] seeding ..."
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54329/kozy \
DIRECT_URL=postgresql://postgres:postgres@127.0.0.1:54329/kozy \
bun scripts/p60_seed.ts || exit 1

echo "[p60] starting dev server ..."
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54329/kozy \
DIRECT_URL=postgresql://postgres:postgres@127.0.0.1:54329/kozy \
NEXTAUTH_URL=http://localhost:3000 \
NEXTAUTH_SECRET=kozy-dev-secret-local-052 \
CRON_SECRET=kozy-dev-cron-secret-052 \
npx next dev -p 3000 > "$LOG" 2>&1 &

for i in $(seq 1 60); do
  if curl -s -o /dev/null http://localhost:3000/login; then break; fi
  sleep 2
done
echo "[p60] dev server up — running the QA battery ..."
node scripts/p60_qa.js
RC=$?

echo "[p60] stopping dev server ..."
pkill -f "next dev" 2>/dev/null
sleep 2
exit $RC
