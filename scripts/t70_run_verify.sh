#!/bin/bash
# Task 70 one-shot: server + verification in a single tool call.
# - Kills any zombie server first (an orphan with the WRONG env silently
#   wins the port and every login 401s).
# - The sandbox shell exports a sqlite DATABASE_URL globally — process.env
#   wins over .env in Next.js, so the PG URL must be passed EXPLICITLY.
cd /home/z/my-project
pkill -f "next-server" 2>/dev/null
pkill -f "next start" 2>/dev/null
sleep 2
env "DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54329/kozy" \
    "DIRECT_URL=postgresql://postgres:postgres@127.0.0.1:54329/kozy" \
    "NEXTAUTH_URL=http://localhost:3000" \
    ./node_modules/.bin/next start -p 3000 > work/t70-server.log 2>&1 &
SRV=$!
sleep 9
node scripts/t70_verify.cjs
RC=$?
kill $SRV 2>/dev/null
pkill -f "next-server" 2>/dev/null
exit $RC
