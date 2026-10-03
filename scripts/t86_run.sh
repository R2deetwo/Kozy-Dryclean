#!/bin/bash
# Task 86 one-shot battery: build + server + seed + verify, in ONE tool call
# (the sandbox kills spawned processes at tool boundaries).
#
# The server runs with MEMBER_EMAIL_TEST_MODE=1 (the owner's standing rule:
# test sends stay inside the woosh world + practiceprosystems@gmail.com) and
# EMAIL_CAPTURE_DIR. PAYSTACK_SECRET_KEY is deliberately NOT set — the exact
# production condition (transfer is the working path).
cd /home/z/my-project
pkill -f "next-server" 2>/dev/null
pkill -f "next dev" 2>/dev/null
pkill -f "next start" 2>/dev/null
sleep 2

# Local embedded Postgres (sandbox reset can leave it down)
if ! node -e "const n=require('net');const s=n.connect(54329,'127.0.0.1',()=>{s.end();process.exit(0)});s.on('error',()=>process.exit(1))" 2>/dev/null; then
  echo "=== START POSTGRES ==="
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
export EMAIL_CAPTURE_DIR="/home/z/my-project/work/t86-emails"

echo "=== MIGRATE ==="
bunx prisma migrate deploy 2>&1 | tail -3 || exit 1
bunx prisma generate 2>&1 | tail -1

echo "=== SEED ==="
bun scripts/t86_seed.ts || exit 1

echo "=== BUILD ==="
bun run build 2>&1 | tail -8 || exit 1

echo "=== SERVER ==="
rm -rf work/t86-emails
mkdir -p work/t86-shots
./node_modules/.bin/next start -p 3000 > work/t86-server.log 2>&1 &
for i in $(seq 1 40); do
  if curl -s -o /dev/null -w "" http://localhost:3000/ 2>/dev/null; then break; fi
  sleep 1
done
sleep 2

echo "=== VERIFY ==="
node scripts/t86_verify.cjs
EXIT=$?
pkill -f "next-server" 2>/dev/null
pkill -f "next start" 2>/dev/null
exit $EXIT
