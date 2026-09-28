#!/bin/bash
# Task 71 — local battery: start server (explicit PG env) + run verify in ONE
# process lifetime (sandbox kills spawned processes at tool boundaries).
cd /home/z/my-project
export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54329/kozy"

nohup npx next start -p 3000 > work/t71_server.log 2>&1 &
SERVER_PID=$!
echo "server pid $SERVER_PID"

# wait for the server to answer
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:3000/ || true)
  if [ "$code" = "200" ]; then
    echo "server up after ${i} checks"
    break
  fi
  sleep 2
done

node scripts/t71_verify.cjs 2>&1
EXIT=$?

kill $SERVER_PID 2>/dev/null
pkill -f "next-server" 2>/dev/null
sleep 1
exit $EXIT
