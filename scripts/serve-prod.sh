#!/bin/bash
# Launch the Kozy production server locally against the PRODUCTION database.
# - The sandbox shell exports a sqlite DATABASE_URL globally; Next.js will not
#   override an existing process.env value, so the production values from
#   .env.local must be passed explicitly (quoted — the URL contains '&').
# - NEXTAUTH_URL is overridden to the local origin: NextAuth v4's middleware
#   derives the cookie name from it, and on localhost the core issues a
#   non-__Secure- cookie — without this override /admin and /portal bounce to
#   /login during local testing. Production serves https://kozycare.ng where
#   both sides use the __Secure- name, so no code change is needed there.
cd /home/z/Kozy-Dryclean
DBU=$(grep '^DATABASE_URL=' .env.local | cut -d= -f2-)
DIRU=$(grep '^DIRECT_URL=' .env.local | cut -d= -f2-)
exec env "DATABASE_URL=$DBU" "DIRECT_URL=$DIRU" "NEXTAUTH_URL=http://localhost:3100" npx next start -p 3100
