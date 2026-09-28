#!/bin/bash
# Task 73 one-shot battery: seed + publish rates + build + server + verify,
# in ONE tool call (the sandbox kills spawned processes at tool boundaries,
# and a zombie server with the WRONG env silently 401s logins).
cd /home/z/my-project
pkill -f "next-server" 2>/dev/null
pkill -f "next start" 2>/dev/null
sleep 2

export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54329/kozy"
export DIRECT_URL="postgresql://postgres:postgres@127.0.0.1:54329/kozy"
export NEXTAUTH_URL="http://localhost:3000"
export NEXTAUTH_SECRET="kozy-dev-secret-local-052"
export CRON_SECRET="kozy-dev-cron-secret-052"

echo "=== MIGRATE (local scratch if empty) ==="
bunx prisma migrate deploy 2>&1 | tail -4 || exit 1

echo "=== SEED ==="
bun scripts/t73_seed.ts || exit 1

echo "=== PUBLISH RATES (1500/1500 + distance keys) ==="
bun scripts/t73_publish_rates.ts || exit 1

echo "=== BUILD ==="
bun run build 2>&1 | tail -20 || exit 1

echo "=== SERVER ==="
./node_modules/.bin/next start -p 3000 > work/t73-server.log 2>&1 &
for i in $(seq 1 40); do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:3000/ || true)
  if [ "$code" = "200" ]; then echo "server up after ${i} checks"; break; fi
  sleep 2
done

echo "=== VERIFY ==="
node scripts/t73_verify.cjs
V=$?

echo "=== SERVER LOG TAIL (errors) ==="
grep -iE "error|unhandled" work/t73-server.log | grep -v "favicon" | tail -8 || echo "(no errors in server log)"

pkill -f "next-server" 2>/dev/null
pkill -f "next start" 2>/dev/null
exit $V
