#!/usr/bin/env bash
# Phase 64 deploy prep — validate owner-supplied Vercel tokens the RIGHT way.
# Project-scoped tokens cannot read /v2/user (that's why earlier "whoami"
# checks falsely reported them invalid). The correct probe is a direct
# GET on the linked project + the deployments list.
# Tokens are passed via env vars so nothing secret lands in a file.
set -uo pipefail

PROJ="prj_BUv0ZqDMzsONFBQXXCgBJfmIN43e"
TEAM="team_RJD4xe4C4h3TiJ3M3iEa8idV"
OUT="/home/z/my-project/work/p64_token_probe.json"

probe() {
  local label="$1" tok="$2"
  echo "===== TOKEN $label ====="
  # 1) project GET (no teamId — project-scoped tokens resolve their own project)
  code=$(curl -s -o "$OUT" -w "%{http_code}" -H "Authorization: Bearer $tok" \
    "https://api.vercel.com/v2/projects/$PROJ" || echo "ERR")
  info=$(python3 -c "
import json
try:
    d = json.load(open('$OUT'))
    print(d.get('name','?'), '|', d.get('errorCode',''))
except Exception as e:
    print('unparsable')
" 2>/dev/null)
  echo "  project GET (no teamId): HTTP $code -> $info"

  # 2) project GET with teamId
  code2=$(curl -s -o "$OUT" -w "%{http_code}" -H "Authorization: Bearer $tok" \
    "https://api.vercel.com/v2/projects/$PROJ?teamId=$TEAM" || echo "ERR")
  echo "  project GET (teamId):    HTTP $code2"

  # 3) deployments list (deploy right lives here)
  code3=$(curl -s -o "$OUT" -w "%{http_code}" -H "Authorization: Bearer $tok" \
    "https://api.vercel.com/v9/projects/$PROJ/deployments?limit=3&target=production" || echo "ERR")
  echo "  deployments list:        HTTP $code3"
  if [ "$code3" = "200" ]; then
    python3 -c "
import json
d = json.load(open('$OUT'))
for dep in d.get('deployments', [])[:3]:
    print('    -', dep.get('name','?'), '| state:', dep.get('readyState','?'), '| created:', dep.get('createdAt','?'), '| url:', dep.get('url','?'))
" 2>/dev/null
  else
    head -c 300 "$OUT"; echo
  fi
}

[ -n "${TOKEN_A:-}" ] && probe "A (first one you pasted)" "$TOKEN_A"
[ -n "${TOKEN_B:-}" ] && probe "B (second one you pasted)" "$TOKEN_B"
echo "done"
