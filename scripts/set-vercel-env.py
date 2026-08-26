#!/usr/bin/env python3
"""Set all required env vars in Vercel for the kozy-dryclean project.

All secrets are read from the local environment — none are hardcoded.
Set them in your shell before running, e.g.:

    export VERCEL_TOKEN="vcp_..."
    export KOZY_DATABASE_URL="postgres://..."
    export KOZY_DIRECT_URL="postgres://..."
    export KOZY_NEXTAUTH_SECRET="..."
    export KOZY_SUPABASE_SERVICE_ROLE_KEY="..."
    export KOZY_SUPABASE_ANON_KEY="..."

    python3 scripts/set-vercel-env.py
"""
import json
import os
import urllib.request
import urllib.error
import urllib.parse
import sys

# All secrets are read from the local environment — none are hardcoded.
# This script is safe to commit; nothing here can leak credentials.
TOKEN = os.environ.get("VERCEL_TOKEN", "")
if not TOKEN:
    print("ERROR: VERCEL_TOKEN env var is not set. Export it before running this script.")
    sys.exit(1)


# First, get the project ID
req = urllib.request.Request(
    "https://api.vercel.com/v9/projects/kozy-dryclean",
    headers={"Authorization": f"Bearer {TOKEN}"},
)
try:
    with urllib.request.urlopen(req) as resp:
        project_data = json.load(resp)
        project_id = project_data["id"]
        print(f"Project ID: {project_id}")
except urllib.error.HTTPError as e:
    print(f"Error getting project: {e.code} {e.read().decode()}")
    exit(1)

# Environment variables to set — values are read from the environment at runtime.
# Non-secret config values (URLs, phone numbers, sender IDs) can stay inline.
ENV_VARS = [
    # Database (REQUIRED) — read from env so secrets never live in source.
    ("DATABASE_URL", os.environ.get("KOZY_DATABASE_URL", ""), "encrypted", ["production", "preview", "development"]),
    ("DIRECT_URL", os.environ.get("KOZY_DIRECT_URL", ""), "encrypted", ["production", "preview", "development"]),

    # Auth (REQUIRED) — secret read from env.
    ("NEXTAUTH_SECRET", os.environ.get("KOZY_NEXTAUTH_SECRET", ""), "encrypted", ["production", "preview", "development"]),
    ("NEXTAUTH_URL", "https://kozy-dryclean.vercel.app", "plain", ["production", "preview", "development"]),

    # Supabase (REQUIRED) — anon key is OK inline, but service-role key must come from env.
    ("NEXT_PUBLIC_SUPABASE_URL", "https://rejnclethpipmqwucors.supabase.co", "plain", ["production", "preview", "development"]),
    ("NEXT_PUBLIC_SUPABASE_ANON_KEY", os.environ.get("KOZY_SUPABASE_ANON_KEY", ""), "encrypted", ["production", "preview", "development"]),
    ("SUPABASE_SERVICE_ROLE_KEY", os.environ.get("KOZY_SUPABASE_SERVICE_ROLE_KEY", ""), "encrypted", ["production", "preview", "development"]),

    # App config (REQUIRED)
    ("NEXT_PUBLIC_APP_URL", "https://kozy-dryclean.vercel.app", "plain", ["production", "preview", "development"]),
    ("NEXT_PUBLIC_COMPANY_PHONE", "+2348005693789", "plain", ["production", "preview", "development"]),
    ("NEXT_PUBLIC_COMPANY_EMAIL", "concierge@kozy.ng", "plain", ["production", "preview", "development"]),

    # Optional (placeholders for now)
    ("TERMII_SENDER_ID", "Kozy", "plain", ["production", "preview", "development"]),
    ("TERMII_CHANNEL", "generic", "plain", ["production", "preview", "development"]),
    ("POSTMARK_SENDER_EMAIL", "concierge@kozy.ng", "plain", ["production", "preview", "development"]),
]

# Validate that every required secret env var is actually set
missing = [
    name for name, val, vtype, _ in ENV_VARS
    if vtype == "encrypted" and not val
]
if missing:
    print(f"ERROR: missing required env vars for: {', '.join(missing)}")
    print("Export them before running this script.")
    exit(1)

# Create each env var
created = 0
failed = 0
for key, value, value_type, targets in ENV_VARS:
    payload = {
        "key": key,
        "value": value,
        "type": value_type,
        "target": targets,
    }
    body = json.dumps(payload).encode()
    req = urllib.request.Request(
        f"https://api.vercel.com/v10/projects/{project_id}/env",
        data=body,
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            result = json.load(resp)
            created += 1
            print(f"  OK {key}")
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        failed += 1
        print(f"  FAIL {key}: {err[:200]}")
    except Exception as e:
        failed += 1
        print(f"  FAIL {key}: {e}")

print(f"\nCreated: {created}")
print(f"Failed: {failed}")
