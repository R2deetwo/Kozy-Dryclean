#!/bin/bash
# Task 81 screenshots — visual proof of the banner placement + drop-down.
cd /home/z/my-project
pkill -f "next-server" 2>/dev/null; pkill -f "next start" 2>/dev/null; sleep 2

if ! node -e "const n=require('net');const s=n.connect(54329,'127.0.0.1',()=>{s.end();process.exit(0)});s.on('error',()=>process.exit(1))" 2>/dev/null; then
  bash scripts/start_pg_tcp.sh 2>&1 | tail -1 || exit 1
fi

export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54329/kozy"
export DIRECT_URL="postgresql://postgres:postgres@127.0.0.1:54329/kozy"
export NEXTAUTH_URL="http://localhost:3000"
export NEXTAUTH_SECRET="kozy-dev-secret-local-052"
export CRON_SECRET="kozy-dev-cron-secret-052"
export PAYSTACK_WEBHOOK_SECRET="kozy-dev-webhook-secret-052"
export PRISMA_QUIET=1
export MEMBER_EMAIL_TEST_MODE=1
export EMAIL_CAPTURE_DIR="/home/z/my-project/work/t81-emails"

./node_modules/.bin/next start -p 3000 > work/t81-server.log 2>&1 &
for i in $(seq 1 40); do
  if curl -s -o /dev/null -w "" http://localhost:3000/ 2>/dev/null; then break; fi
  sleep 1
done
sleep 2

node scripts/t81_shots.cjs
EXIT=$?
pkill -f "next-server" 2>/dev/null
pkill -f "next start" 2>/dev/null
exit $EXIT
