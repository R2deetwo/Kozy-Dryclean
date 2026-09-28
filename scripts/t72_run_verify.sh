#!/bin/bash
# Task 72 one-shot battery: seed + server + phase A + partner-password bridge
# + phase B, in ONE tool call (the sandbox kills spawned processes at tool
# boundaries, and a zombie server with the WRONG env silently 401s logins).
cd /home/z/my-project
pkill -f "next-server" 2>/dev/null
pkill -f "next start" 2>/dev/null
sleep 2

export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54329/kozy"
export DIRECT_URL="postgresql://postgres:postgres@127.0.0.1:54329/kozy"

echo "=== SEED ==="
bun scripts/t72_seed.ts || exit 1

echo "=== SERVER ==="
NEXTAUTH_URL="http://localhost:3000" ./node_modules/.bin/next start -p 3000 > work/t72-server.log 2>&1 &
SRV=$!
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:3000/ || true)
  if [ "$code" = "200" ]; then echo "server up after ${i} checks"; break; fi
  sleep 2
done

echo "=== PHASE A ==="
node scripts/t72_verify.cjs
A=$?

echo "=== BRIDGE: partner password (plays the welcome email's role) ==="
bun scripts/t72_partner_pw.ts || exit 1

echo "=== PHASE B ==="
node scripts/t72_verify2.cjs
B=$?

echo "=== PHASE C ==="
node scripts/t72_verify3.cjs
C=$?

kill $SRV 2>/dev/null
pkill -f "next-server" 2>/dev/null
sleep 1
echo "RESULT phaseA=$A phaseB=$B phaseC=$C"
[ "$A" = "0" ] && [ "$B" = "0" ] && [ "$C" = "0" ] && echo "ALL GREEN" || exit 1
