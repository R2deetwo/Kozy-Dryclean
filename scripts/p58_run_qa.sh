#!/bin/bash
# Phase 58 — boot the dev server (local PG; the login flow sends no emails,
# so no Brevo/override vars are needed), then run the auth UX battery
# (force-login fix + admin sign-out reachability). One invocation —
# background processes die between bash calls.
set -u
cd /home/z/my-project

LOG=work/p58-dev.log
rm -f "$LOG"

echo "[p58] ensuring seed users (idempotent) ..."
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54329/kozy \
DIRECT_URL=postgresql://postgres:postgres@127.0.0.1:54329/kozy \
bun scripts/phase40-seed.ts >/dev/null || exit 1

echo "[p58] starting dev server ..."
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
echo "[p58] dev server up — running the auth UX battery ..."
node scripts/p58_qa.js
RC=$?

echo "[p58] stopping dev server ..."
pkill -f "next" 2>/dev/null
sleep 2
exit $RC
