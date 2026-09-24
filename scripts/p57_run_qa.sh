#!/bin/bash
# Phase 57 — boot the dev server (local PG, no email traffic: the QA only
# reads the board; no status changes are made, so no emails can fire),
# then run the pacing QA battery. One invocation (background processes die
# between bash calls).
set -u
cd /home/z/my-project

LOG=work/p57-dev.log
rm -f "$LOG"

echo "[p57] seeding pacing orders ..."
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54329/kozy \
DIRECT_URL=postgresql://postgres:postgres@127.0.0.1:54329/kozy \
bun scripts/p57_pacing_seed.ts || exit 1

echo "[p57] starting dev server ..."
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
echo "[p57] dev server up — running the pacing QA battery ..."
node scripts/p57_qa.js
RC=$?

echo "[p57] stopping dev server ..."
pkill -f "next" 2>/dev/null
sleep 2
exit $RC
