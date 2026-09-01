#!/bin/bash
# Phase-24 suite only (server + reseed + suite in one call).
set -u
cd /home/z/Kozy-Git
DBU=$(grep '^DATABASE_URL=' .env.local | cut -d= -f2- | sed 's/^"//;s/"$//')
DIRU=$(grep '^DIRECT_URL=' .env.local | cut -d= -f2- | sed 's/^"//;s/"$//')
export DATABASE_URL="$DBU" DIRECT_URL="$DIRU"

# alerts still point at the e2e inbox from the interrupted run; verify + seed
npx tsx scripts/p24-alerts-redirect.ts
npx tsx scripts/e2e-seed22.ts >/dev/null 2>&1 || true
SEED24=$(npx tsx scripts/p24-seed.ts)
echo "P24 SEED: $SEED24"

rm -f /home/z/my-project/work/serve-p24b.log
env "DATABASE_URL=$DBU" "DIRECT_URL=$DIRU" "NEXTAUTH_URL=http://localhost:3100" \
  npx next start -p 3100 > /home/z/my-project/work/serve-p24b.log 2>&1 &
SERVER_PID=$!
code=000
for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3100/ || true)
  [ "$code" = "200" ] && break
  sleep 2
done
echo "server up (code=$code)"

cd /home/z/my-project/scripts
export E2E_BASE=http://localhost:3100
export ADMIN_EMAIL=e2e-admin22@kozy-test.example
export ADMIN_PASSWORD='E2e-Admin-Pw-7261!'
export P24_SEED="$SEED24"

python3 e2e_phase24.py
RC=$?

kill $SERVER_PID 2>/dev/null
pkill -f next-server 2>/dev/null
echo "PHASE24 SUITE RC=$RC"
exit $RC
