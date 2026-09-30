#!/bin/bash
# Task 76 one-shot battery: migrate + seed + REAL email test + build + server
# + verify, in ONE tool call (the sandbox kills spawned processes at tool
# boundaries, and a zombie server with the WRONG env silently 401s logins).
#
# The REAL email test fires BETWEEN seed and server start — it sends the
# member-facing emails to the @woosh.dpdns.org test accounts + the owner's
# practiceprosystems@gmail.com (never a real member; the local DB has only
# test users, and the local admin_alerts_email is overridden to the owner
# for the duration of the test).
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
export PAYSTACK_WEBHOOK_SECRET="kozy-dev-webhook-secret-052"
export PRISMA_QUIET=1
# NOTE: BREVO_API_KEY and PAYSTACK_SECRET_KEY stay UNSET for the server —
# the battery's sweep marks sends without delivering anything, and the
# PAYSTACK renewal branch returns the honest 503.

echo "=== MIGRATE ==="
bunx prisma migrate deploy 2>&1 | tail -3 || exit 1
bunx prisma generate 2>&1 | tail -1 || exit 1

echo "=== SEED ==="
bun scripts/t76_seed.ts || exit 1

echo "=== REAL EMAIL TEST (woosh test users + practiceprosystems@gmail.com ONLY) ==="
# FORCE_EMAIL=1 re-sends; by default a marker in work/ avoids duplicate test
# mails on battery re-runs (the sends already landed in the woosh inboxes).
if [ "${FORCE_EMAIL:-0}" = "1" ] || [ ! -f work/.t76_emails_sent ]; then
  bun scripts/t76_email_test.ts 2>&1 | grep -v "^\[brevo\] sent" || exit 1
  mkdir -p work && touch work/.t76_emails_sent
else
  echo "(skipped — already sent; FORCE_EMAIL=1 to resend)"
fi

echo "=== BUILD ==="
bun run build 2>&1 | tail -6 || exit 1

echo "=== SERVER ==="
./node_modules/.bin/next start -p 3000 > work/t76-server.log 2>&1 &
for i in $(seq 1 40); do
  if curl -s -o /dev/null -w "" http://localhost:3000/ 2>/dev/null; then break; fi
  sleep 1
done
sleep 2

echo "=== VERIFY ==="
node scripts/t76_verify.cjs
EXIT=$?
pkill -f "next-server" 2>/dev/null
pkill -f "next start" 2>/dev/null
exit $EXIT
