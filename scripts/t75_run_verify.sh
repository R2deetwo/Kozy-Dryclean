#!/bin/bash
# Task 75 one-shot battery: migrate + seed + build + server + verify,
# in ONE tool call (the sandbox kills spawned processes at tool boundaries,
# and a zombie server with the WRONG env silently 401s logins).
cd /home/z/my-project
pkill -f "next-server" 2>/dev/null
pkill -f "next start" 2>/dev/null
sleep 2

# Local embedded Postgres (sandbox reset can leave it down)
if ! node -e "const n=require('net');const s=n.connect(54329,'127.0.0.1',()=>{s.end();process.exit(0)});s.on('error',()=>process.exit(1))" 2>/dev/null; then
  echo "=== START POSTGRES ==="
  bash scripts/start_pg_tcp.sh 2>&1 | tail -1 || exit 1
fi

export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54329/kozy"
export DIRECT_URL="postgresql://postgres:postgres@127.0.0.1:54329/kozy"
export NEXTAUTH_URL="http://localhost:3000"
export NEXTAUTH_SECRET="kozy-dev-secret-local-052"
export CRON_SECRET="kozy-dev-cron-secret-052"
export PRISMA_QUIET=1

echo "=== MIGRATE ==="
bunx prisma migrate deploy 2>&1 | tail -3 || exit 1

echo "=== SEED ==="
bun scripts/t75_seed.ts || exit 1

echo "=== BUILD (if no .next for this source) ==="
bun run build 2>&1 | tail -6 || exit 1

echo "=== SERVER ==="
./node_modules/.bin/next start -p 3000 > work/t75-server.log 2>&1 &
for i in $(seq 1 40); do
  if curl -s -o /dev/null -w "" http://localhost:3000/ 2>/dev/null; then break; fi
  sleep 1
done
sleep 2

echo "=== VERIFY ==="
node scripts/t75_verify.cjs
EXIT=$?
pkill -f "next-server" 2>/dev/null
pkill -f "next start" 2>/dev/null
exit $EXIT
