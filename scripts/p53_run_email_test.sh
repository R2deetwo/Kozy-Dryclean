#!/bin/bash
# Phase 53 — run the full email-system test with every send redirected to
# practiceprosystems@gmail.com (EMAIL_OVERRIDE_TO). One invocation: starts
# the dev server (correct PG env — the sandbox injects a sqlite DATABASE_URL
# into every bash call, which next dev would silently prefer), waits for it,
# runs the test, then kills the server.
set -u
cd /home/z/my-project

# --- Brevo credentials pulled from Vercel (production values) ---
if [ ! -f .env.p53-pull ]; then
  echo "ERROR: .env.p53-pull missing — pull it first (vercel env pull)"
  exit 1
fi
BREVO_KEY=$(grep -E "^BREVO_API_KEY=" .env.p53-pull | cut -d= -f2- | tr -d '"' | tr -d "'")
BREVO_SENDER=$(grep -E "^BREVO_SENDER_EMAIL=" .env.p53-pull | cut -d= -f2- | tr -d '"' | tr -d "'")

LOG=work/p53-dev.log
rm -f "$LOG"

echo "[p53] starting dev server with EMAIL_OVERRIDE_TO=practiceprosystems@gmail.com ..."
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54329/kozy \
DIRECT_URL=postgresql://postgres:postgres@127.0.0.1:54329/kozy \
NEXTAUTH_URL=http://localhost:3000 \
NEXTAUTH_SECRET=kozy-dev-secret-local-052 \
CRON_SECRET=kozy-dev-cron-secret-052 \
BREVO_API_KEY="$BREVO_KEY" \
BREVO_SENDER_EMAIL="$BREVO_SENDER" \
BREVO_SENDER_NAME="Kozy Care" \
EMAIL_OVERRIDE_TO=practiceprosystems@gmail.com \
npx next dev -p 3000 > "$LOG" 2>&1 &

DEV_PID=$!
for i in $(seq 1 60); do
  if curl -s -o /dev/null http://localhost:3000/login; then break; fi
  sleep 2
done
echo "[p53] dev server up — running the email test ..."
node scripts/p53_email_test.js
RC=$?

echo "[p53] stopping dev server ..."
pkill -f "next" 2>/dev/null
sleep 2
exit $RC
