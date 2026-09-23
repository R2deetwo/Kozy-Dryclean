#!/bin/bash
# Phase 55 — boot the dev server with every email redirected to
# practiceprosystems@gmail.com (EMAIL_OVERRIDE_TO), then run the QA battery.
# One invocation (background processes die between bash calls).
# TERMII is deliberately NOT set — SMS sends are skipped safely during QA.
set -u
cd /home/z/my-project

if [ ! -f work/p55-env.env ]; then
  echo "ERROR: work/p55-env.env missing (run scripts/p55_pull_env.py first)"
  exit 1
fi
source work/p55-env.env

LOG=work/p55-dev.log
rm -f "$LOG"

echo "[p55] starting dev server with EMAIL_OVERRIDE_TO=practiceprosystems@gmail.com ..."
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
echo "[p55] dev server up — running the QA battery ..."
node scripts/p55_qa.js
RC=$?

echo "[p55] stopping dev server ..."
pkill -f "next" 2>/dev/null
sleep 2
echo "[p55] done (exit $RC)"
exit $RC
