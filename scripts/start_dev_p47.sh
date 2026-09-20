#!/bin/bash
cd /home/z/my-project
export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54329/kozy"
export NEXTAUTH_URL="http://localhost:3000"
export NEXTAUTH_SECRET="dev-secret-for-local-verification-only-0123456789"
exec npx next dev -p 3000
