#!/bin/bash
# Task 88 verify: server + admin login + customers page DOM + member modal + screenshots
cd /home/z/my-project
pkill -f "next dev" 2>/dev/null; pkill -f "next-server" 2>/dev/null; sleep 2
export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54329/kozy"
export DIRECT_URL="postgresql://postgres:postgres@127.0.0.1:54329/kozy"
export NEXTAUTH_URL="http://localhost:3000"
export NEXTAUTH_SECRET="kozy-dev-secret-local-052"
export CRON_SECRET="kozy-dev-cron-secret-052"
export PAYSTACK_WEBHOOK_SECRET="kozy-dev-webhook-secret-052"
export PRISMA_QUIET=1

nohup bun run dev > dev.log 2>&1 &
for i in $(seq 1 40); do curl -s -o /dev/null http://localhost:3000 && break; sleep 2; done
echo "== server up (attempt $i)"

agent-browser open http://localhost:3000/login >/dev/null 2>&1
sleep 2
agent-browser snapshot -i 2>/dev/null | rg "textbox" | head -2
agent-browser fill @e12 "t87admin@woosh.dpdns.org" >/dev/null 2>&1 || agent-browser find label "EMAIL" fill "t87admin@woosh.dpdns.org"
agent-browser fill @e13 "T87Admin!2026" >/dev/null 2>&1 || true
agent-browser snapshot -i 2>/dev/null | rg "Sign in" | head -1
