#!/bin/bash
# Phase-24 full E2E run: redirect alerts -> seed -> serve prod build on :3100
# (production DB) -> run all suites -> kill server. One call: the sandbox
# kills detached processes between calls, so server+tests MUST live here.
set -u
cd /home/z/Kozy-Git
DBU=$(grep '^DATABASE_URL=' .env.local | cut -d= -f2- | sed 's/^"//;s/"$//')
DIRU=$(grep '^DIRECT_URL=' .env.local | cut -d= -f2- | sed 's/^"//;s/"$//')
export DATABASE_URL="$DBU" DIRECT_URL="$DIRU"

echo "===== 0) Pre-clean any leftovers from earlier runs, then redirect ====="
npx tsx scripts/p24-cleanup.ts
npx tsx scripts/p24-alerts-redirect.ts

echo "===== 1) Seed E2E artifacts ====="
SEED22=$(npx tsx scripts/e2e-seed22.ts)
echo "$SEED22"
ORDER_A=$(echo "$SEED22" | awk '/ORDER KZ-E2EA/{print $2}')
ORDER_B=$(echo "$SEED22" | awk '/ORDER KZ-E2EB/{print $2}')
ORDER_C=$(echo "$SEED22" | awk '/ORDER KZ-E2EC/{print $2}')
ORDER_D=$(echo "$SEED22" | awk '/ORDER KZ-E2ED/{print $2}')
SEED24=$(npx tsx scripts/p24-seed.ts)
echo "P24 SEED: $SEED24"

echo "===== 2) Serve production build ====="
mkdir -p /home/z/my-project/work
rm -f /home/z/my-project/work/serve-p24.log /home/z/my-project/work/serve-p23.log
env "DATABASE_URL=$DBU" "DIRECT_URL=$DIRU" "NEXTAUTH_URL=http://localhost:3100" \
  npx next start -p 3100 > /home/z/my-project/work/serve-p24.log 2>&1 &
SERVER_PID=$!
ln -s serve-p24.log /home/z/my-project/work/serve-p23.log

code=000
for i in $(seq 1 90); do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3100/ || true)
  [ "$code" = "200" ] && break
  sleep 2
done
echo "server ready (code=$code)"

cd /home/z/Kozy-Git
export E2E_BASE=http://localhost:3100
export ADMIN_EMAIL=e2e-admin22@kozy-test.example
export ADMIN_PASSWORD='E2e-Admin-Pw-7261!'
export ORDER_A ORDER_B ORDER_C ORDER_D
export P24_SEED="$SEED24"

start_server() {
  env "DATABASE_URL=$DBU" "DIRECT_URL=$DIRU" "NEXTAUTH_URL=http://localhost:3100" \
    npx next start -p 3100 >> /home/z/my-project/work/serve-p24.log 2>&1 &
  SERVER_PID=$!
  local code=000
  for i in $(seq 1 60); do
    code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3100/ || true)
    [ "$code" = "200" ] && break
    sleep 2
  done
  echo "server up (pid=$SERVER_PID code=$code)"
}
stop_server() {
  [ -n "${SERVER_PID:-}" ] && kill $SERVER_PID 2>/dev/null
  pkill -f next-server 2>/dev/null
  sleep 2
}

# Fresh seed for the run (seed22 prints ORDER lines; recompute env)
RC=0
run() {
  echo ""
  echo "===== SUITE: $1 ====="
  stop_server
  start_server
  ( cd /home/z/my-project/scripts && python3 "$1" ) || RC=1
}
run e2e_phase22.py
run e2e_phase23.py
run e2e_admin_kanban.py
run e2e_transfer_flow.py
run e2e_receipt_reject.py

# The kanban suite deletes the e2e admin at its end — re-seed it so the
# phase-24 suite can log in.
npx tsx scripts/e2e-seed22.ts >/dev/null 2>&1 || true

run e2e_phase24.py

stop_server
echo ""
echo "===== RUN COMPLETE (RC=$RC) ====="
exit $RC
