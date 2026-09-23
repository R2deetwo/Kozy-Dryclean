#!/bin/bash
# Phase 54 — boot the dev server with every email redirected to
# practiceprosystems@gmail.com (EMAIL_OVERRIDE_TO), then run the QA battery.
# One invocation (background processes die between bash calls): start dev
# with the correct PG env (the sandbox injects a sqlite DATABASE_URL into
# every bash call, which next dev would silently prefer), wait for it, run
# the tests, kill the server.
set -u
cd /home/z/my-project

# --- Brevo credentials (extracted from Vercel production env; cached file
#     contains ONLY the two values, deleted after this run) ---
if [ ! -f work/p54-brevo.env ]; then
  echo "ERROR: work/p54-brevo.env missing"
  exit 1
fi
source work/p54-brevo.env

LOG=work/p54-dev.log
rm -f "$LOG"

echo "[p54] starting dev server with EMAIL_OVERRIDE_TO=practiceprosystems@gmail.com ..."
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54329/kozy \
DIRECT_URL=postgresql://postgres:postgres@127.0.0.1:54329/kozy \
NEXTAUTH_URL=http://localhost:3000 \
NEXTAUTH_SECRET=kozy-dev-secret-local-052 \
CRON_SECRET=kozy-dev-cron-secret-052 \
BREVO_API_KEY="$BREVO_API_KEY" \
BREVO_SENDER_EMAIL="$BREVO_SENDER_EMAIL" \
BREVO_SENDER_NAME="Kozy Care" \
EMAIL_OVERRIDE_TO=practiceprosystems@gmail.com \
npx next dev -p 3000 > "$LOG" 2>&1 &

for i in $(seq 1 60); do
  if curl -s -o /dev/null http://localhost:3000/login; then break; fi
  sleep 2
done
echo "[p54] dev server up — running the QA battery ..."
node scripts/p54_qa.js
RC=$?

echo "[p54] stopping dev server ..."
pkill -f "next" 2>/dev/null
sleep 2
rm -f work/p54-brevo.env
echo "[p54] done (exit $RC)"
exit $RC
