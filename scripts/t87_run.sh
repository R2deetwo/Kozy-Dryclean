#!/bin/bash
# Task 87 one-shot battery: build + server + seed + verify, in ONE tool call.
# Woosh-only (MEMBER_EMAIL_TEST_MODE=1 + EMAIL_CAPTURE_DIR). No Paystack key.
cd /home/z/my-project
pkill -f "next-server" 2>/dev/null
pkill -f "next dev" 2>/dev/null
pkill -f "next start" 2>/dev/null
sleep 2

if ! node -e "const n=require('net');const s=n.connect(54329,'127.0.0.1',()=>{s.end();process.exit(0)});s.on('error',()=>process.exit(1))" 2>/dev/null; then
  (nohup bash scripts/start_pg_tcp.sh > work/pg-start.log 2>&1 &)
  sleep 8
fi

export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54329/kozy"
export DIRECT_URL="postgresql://postgres:postgres@127.0.0.1:54329/kozy"
export NEXTAUTH_URL="http://localhost:3000"
export NEXTAUTH_SECRET="kozy-dev-secret-local-052"
export CRON_SECRET="kozy-dev-cron-secret-052"
export PAYSTACK_WEBHOOK_SECRET="kozy-dev-webhook-secret-052"
export PRISMA_QUIET=1
export MEMBER_EMAIL_TEST_MODE=1
export EMAIL_CAPTURE_DIR="/home/z/my-project/work/t87-emails"

echo "=== MIGRATE ==="
bunx prisma migrate deploy 2>&1 | tail -3 || exit 1
bunx prisma generate 2>&1 | tail -1

echo "=== SEED ==="
bun scripts/t87_seed.ts || exit 1

echo "=== BUILD ==="
bun run build 2>&1 | tail -6 || exit 1

echo "=== SERVER ==="
rm -rf work/t87-emails
mkdir -p work/t87-shots
./node_modules/.bin/next start -p 3000 > work/t87-server.log 2>&1 &
for i in $(seq 1 40); do
  if curl -s -o /dev/null -w "" http://localhost:3000/ 2>/dev/null; then break; fi
  sleep 1
done
sleep 2

echo "=== VERIFY ==="
node scripts/t87_verify.cjs
EXIT=$?
pkill -f "next-server" 2>/dev/null
pkill -f "next start" 2>/dev/null
exit $EXIT
