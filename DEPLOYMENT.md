# Kozy Drycleaning and Laundry Services — Deployment Guide

> **Repo**: https://github.com/R2deetwo/Kozy-Dryclean
> **Hosting**: Vercel
> **Database**: Supabase (Postgres)

This guide walks you through getting the project from this preview environment to a live production deployment.

---

## Table of Contents

1. [Vercel "already connected" fix](#1-vercel-already-connected-fix)
2. [Push the code to your GitHub repo](#2-push-the-code-to-your-github-repo)
3. [Set up Supabase](#3-set-up-supabase)
4. [Connect Vercel to GitHub](#4-connect-vercel-to-github)
5. [Set environment variables in Vercel](#5-set-environment-variables-in-vercel)
6. [Run the database migration](#6-run-the-database-migration)
7. [Test the live deployment](#7-test-the-live-deployment)
8. [Going live checklist](#8-going-live-checklist)

---

## 1. Vercel "already connected" fix

The "already connected" error happens because **another Vercel account (or project) already has the GitHub integration tied to your GitHub user**. Vercel enforces one-to-one mapping between a GitHub repo and a Vercel project per user.

### Fix Option A — Disconnect the old Vercel integration (recommended)

1. Go to GitHub → **Settings** → **Applications** → **Installed GitHub Apps** → find **Vercel**
2. Click **Configure**
3. Under "Repository access", find the repo `R2deetwo/Kozy-Dryclean`
4. Either remove that repo from the Vercel app's allowed list, OR
5. Click **Uninstall** next to Vercel entirely (this severs the connection for ALL repos — only do this if you're sure no other project depends on it)

### Fix Option B — Delete the existing Vercel project that's holding the connection

1. Log into each Vercel account you have access to
2. Find any project named "Kozy-Dryclean" or similar
3. Go to **Project Settings** → **Advanced** → **Delete Project** (this is permanent)
4. Once the project is deleted, the GitHub repo is freed up

### Fix Option C — Use the Vercel CLI instead of the dashboard

If the GitHub app keeps fighting you, bypass it entirely:

```bash
# Install Vercel CLI
npm install -g vercel

# Login (will open browser)
vercel login

# In your project folder
cd Kozy-Dryclean
vercel link    # say yes when it asks to create a new project
vercel --prod  # deploy to production
```

This skips the GitHub integration entirely — you push to GitHub manually and run `vercel --prod` to deploy. Not ideal long-term, but unblocks you in 5 minutes.

### Fix Option D — Transfer the existing Vercel project

If you previously connected the repo to your **personal Vercel account** and want it in the new account instead:

1. In the OLD Vercel account: Project Settings → Transfer Project → enter the new account's name
2. Accept the transfer in the NEW account's email
3. The project now lives in the new Vercel account with the same GitHub connection intact

---

## 2. Push the code to your GitHub repo

From the project root:

```bash
# Initialize git if you haven't
git init
git remote add origin https://github.com/R2deetwo/Kozy-Dryclean.git
git branch -M main

# Stage everything except .env (already in .gitignore)
git add .

# Verify .env is NOT staged
git status --ignored

# Commit and push
git commit -m "Initial commit — Kozy Drycleaning platform v3"
git push -u origin main
```

### If you already pushed and want to update:

```bash
git add .
git commit -m "Update label + add env example"
git push
```

---

## 3. Set up Supabase

### Create the project

1. Go to **https://supabase.com** → sign in with GitHub → **New Project**
2. Project details:
   - **Name**: `kozy-dryclean` (or whatever you prefer)
   - **Database Password**: generate a strong password and **save it somewhere safe** (1Password, Bitwarden, or a physical note — you cannot retrieve it later)
   - **Region**: `West EU (London)` or `East US (North Virginia)` — pick whichever is closest to your customers. For Lagos, London is fine (the latency difference is negligible; Supabase doesn't have an African region yet)
   - **Pricing plan**: Free tier is fine to start (500MB DB, 1GB file storage, paused after 7 days of inactivity). Upgrade to Pro ($25/mo) before going live to avoid auto-pause.
3. Wait ~2 minutes for provisioning

### Get the connection strings

Once the project is ready:

1. Go to **Project Settings** → **Database** → **Connection string** section
2. You'll see two connection strings — copy both:

#### URL 1 — Transaction pooler (port 6543)

```
postgresql://postgres.[PROJECT_REF]:[YOUR_DB_PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres
```

→ This goes into `DATABASE_URL` in your `.env` file.

#### URL 2 — Session pooler / Direct connection (port 5432)

```
postgresql://postgres:[YOUR_DB_PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
```

→ This goes into `DIRECT_URL` in your `.env` file.

**Why two URLs?** Supabase's pooler (PgBouncer) doesn't support some Prisma migration features (like long-running transactions). The pooler is for runtime app queries, the direct connection is for migrations.

### Get the API keys (for later use)

1. Go to **Project Settings** → **API**
2. Copy:
   - **Project URL**: `https://[PROJECT_REF].supabase.co`
   - **anon public**: `eyJhbG...` (safe to expose to the browser)
   - **service_role**: `eyJhbG...` (⚠️ NEVER expose this — full admin access to your DB)

You won't need these for the basic setup, but you'll need them if you want to use Supabase Auth, Supabase Storage, or Supabase Realtime later.

### Run the SQL schema (manual option)

If you'd rather not use Prisma migrations, you can run the SQL directly. Go to **SQL Editor** in Supabase and paste the contents of `prisma/schema-to-sql.sql` (you'll need to generate this — see step 6).

---

## 4. Connect Vercel to GitHub

1. Go to **https://vercel.com** → sign in with your GitHub account
2. **Add New** → **Project** → **Import Git Repository**
3. Find `R2deetwo/Kozy-Dryclean` in the list
   - If it's not there, click **Adjust GitHub App Permissions** and grant access to that repo
4. Configure project:
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `./` (default)
   - **Build Command**: `bun run build` (or `npm run build` if you're not using Bun)
   - **Output Directory**: (leave default — Next.js handles this)
   - **Install Command**: `bun install` (or `npm install`)
5. **Don't click Deploy yet** — first add environment variables (next step)

---

## 5. Set environment variables in Vercel

In the Vercel project import screen (or later under **Project Settings → Environment Variables**), add each variable from `.env.example`. Here's the priority order:

### 🔴 Required for first deploy (no external services)

| Variable | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://kozy-dryclean.vercel.app` (or your custom domain) | Replace with your actual Vercel URL after first deploy |
| `NEXTAUTH_SECRET` | (run `openssl rand -base64 32`) | 32-char random string |
| `NEXTAUTH_URL` | `https://kozy-dryclean.vercel.app` | Same as NEXT_PUBLIC_APP_URL |
| `DATABASE_URL` | (Supabase pooler URL, port 6543) | From Supabase dashboard |
| `DIRECT_URL` | (Supabase direct URL, port 5432) | From Supabase dashboard |

### 🟡 Required for payments

| Variable | Value | Notes |
|---|---|---|
| `PAYSTACK_SECRET_KEY` | `sk_test_...` | From Paystack dashboard (test mode first) |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | `pk_test_...` | Same place, public key |
| `PAYSTACK_WEBHOOK_SECRET` | (same as secret key) | Paystack doesn't have a separate webhook secret — it uses your secret key + a hash |
| `PAYSTACK_BUSINESS_ID` | (optional) | From Paystack → Settings → Business |

### 🟡 Required for notifications

| Variable | Value | Notes |
|---|---|---|
| `TERMII_API_KEY` | (from Termii dashboard) | For SMS to Nigerian numbers |
| `TERMII_SENDER_ID` | `Kozy` | Pre-approve with Termii |
| `TERMII_CHANNEL` | `generic` | Or `dnd` for Do-Not-Distast numbers |
| `POSTMARK_API_KEY` | (from Postmark) | For transactional email |
| `POSTMARK_SENDER_EMAIL` | `concierge@kozy.ng` | Must be a verified sender |

### 🟡 Required for file uploads (receipts, condition photos)

| Variable | Value | Notes |
|---|---|---|
| `R2_ACCOUNT_ID` | (your Cloudflare account ID) | Cloudflare dashboard → R2 |
| `R2_ACCESS_KEY_ID` | (from R2 → Manage API tokens) | |
| `R2_SECRET_ACCESS_KEY` | (same place) | ⚠️ Secret — never expose |
| `R2_BUCKET_NAME` | `kozy-uploads` | Create the bucket first |
| `R2_PUBLIC_URL` | `https://uploads.kozy.ng` | Set up a Cloudflare worker or custom domain |

### 🟢 Optional (recommended)

| Variable | Value | Notes |
|---|---|---|
| `SENTRY_DSN` | (from Sentry) | Error monitoring |
| `GOOGLE_MAPS_API_KEY` | (from Google Cloud Console) | For driver navigation |
| `NEXT_PUBLIC_COMPANY_PHONE` | `+2348005693789` | Shown in UI |
| `NEXT_PUBLIC_COMPANY_EMAIL` | `concierge@kozy.ng` | Shown in UI |

### Setting env vars in Vercel dashboard

For each variable:
1. **Key**: e.g. `DATABASE_URL`
2. **Value**: paste the value
3. **Environment**: check **Production**, **Preview**, and **Development** (or just Production if you want different values per env)
4. Click **Add**

### Setting env vars via CLI (faster)

```bash
# Install Vercel CLI
npm install -g vercel

# Link the project to your Vercel account
vercel link

# Set env vars from .env.local file
vercel env pull .env.local  # pull existing
# Or push from a file:
# (Vercel doesn't have a built-in .env importer, but you can use this script:)
while IFS= read -r line; do
  [[ "$line" =~ ^[A-Z] ]] || continue
  key="${line%%=*}"
  val="${line#*=}"
  vercel env add "$key" production <<< "$val"
done < .env.local
```

---

## 6. Run the database migration

Once `DATABASE_URL` and `DIRECT_URL` are set in Vercel, run the Prisma migration locally to push the schema to Supabase:

```bash
# Install dependencies
bun install   # or: npm install

# Generate Prisma client
bun run db:generate

# Push the schema to Supabase
bun run db:push

# (Optional) If you want to use migrations instead of db:push:
bun run db:migrate --name init
```

This creates all tables in your Supabase Postgres database:
- `User`
- `Order`
- `GarmentMedia`
- `Payment`
- `StatusEvent`

Verify in Supabase → **Table Editor** → you should see all 5 tables.

### Seed the demo data (optional but useful)

To populate the database with the same demo data we've been using:

```bash
bun run scripts/seed.ts
```

(You'll need to create this script — it reads the seed data from `src/lib/store.ts` and writes it to Supabase.)

---

## 7. Test the live deployment

After Vercel finishes building (usually 2-3 minutes):

1. Visit your deployment URL: `https://kozy-dryclean.vercel.app`
2. The landing page should load
3. Click **Customer** in the top toggle → you should see the auth gate
4. Click one of the demo accounts → you should see the dashboard
5. Try the booking flow end-to-end

### Common issues

| Issue | Fix |
|---|---|
| Blank page / 500 error | Check Vercel → Functions → Logs |
| `PrismaClientInitializationError` | `DATABASE_URL` is wrong or DB is paused — restart Supabase |
| Hydration mismatch | Hard refresh + clear localStorage |
| Images not loading | Check `R2_PUBLIC_URL` is correct |
| Paystack webhook not firing | Webhook URL not set in Paystack dashboard — see step 8 |
| SMS not sending | `TERMII_SENDER_ID` not approved yet |

---

## 8. Going live checklist

### Before going public

- [ ] Buy a custom domain (e.g. `kozy.ng` from Whogohost or GoDaddy)
- [ ] Add domain in Vercel → Project Settings → Domains
- [ ] Update DNS records to point to Vercel
- [ ] Update `NEXT_PUBLIC_APP_URL` and `NEXTAUTH_URL` to the custom domain
- [ ] Upgrade Supabase from Free to Pro ($25/mo) to avoid auto-pause
- [ ] Switch Paystack from test keys to live keys
- [ ] Set up Paystack webhook at `https://kozy.ng/api/webhooks/paystack`
- [ ] Submit Termii sender ID for approval ("Kozy")
- [ ] Verify Postmark sender email (`concierge@kozy.ng`)
- [ ] Set up Sentry for error monitoring
- [ ] Add privacy policy + terms of service pages (NDPR compliance)
- [ ] Test the full flow: signup → book → pay → track → deliver

### Custom domain setup

1. Buy domain from any registrar (Whogohost, GoDaddy, Namecheap)
2. In Vercel: **Project Settings → Domains → Add** → enter `kozy.ng`
3. Vercel shows you DNS records to add:
   ```
   A     @     76.76.21.21
   CNAME www    cname.vercel-dns.com
   ```
4. Add these in your domain registrar's DNS panel
5. Wait 5-30 minutes for DNS propagation
6. Vercel auto-provisions SSL via Let's Encrypt

### Paystack webhook setup

1. Paystack Dashboard → **Settings → API Keys & Webhooks**
2. **Add Webhook URL**: `https://kozy.ng/api/webhooks/paystack`
3. Copy the **Webhook Secret** (it's shown once)
4. Add it to Vercel env vars as `PAYSTACK_WEBHOOK_SECRET`
5. Redeploy

---

## Secrets & Tokens Manifest

Here's every secret you'll need, where to get it, and where it goes:

| Secret | Where to get | Where it goes |
|---|---|---|
| **Supabase DB password** | Created during Supabase project setup | Saved in password manager — used inside `DATABASE_URL` |
| **Supabase Project URL** | Supabase → Project Settings → API | Optional in `.env` if using Supabase Auth |
| **Supabase anon key** | Same place | Optional in `.env` if using Supabase Auth |
| **Supabase service_role key** | Same place | ⚠️ Server-only — NEVER in `NEXT_PUBLIC_*` |
| **NextAuth secret** | `openssl rand -base64 32` (run locally) | `NEXTAUTH_SECRET` env var |
| **Paystack secret key** | https://dashboard.paystack.com/settings/developer/api-keys | `PAYSTACK_SECRET_KEY` |
| **Paystack public key** | Same place | `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` |
| **Paystack webhook secret** | Paystack → Settings → Webhooks (after creating webhook) | `PAYSTACK_WEBHOOK_SECRET` |
| **Termii API key** | https://termii.com/account | `TERMII_API_KEY` |
| **Postmark API key** | https://account.postmarkapp.com → Servers → Create | `POSTMARK_API_KEY` |
| **Cloudflare account ID** | Cloudflare dashboard → right sidebar | `R2_ACCOUNT_ID` |
| **R2 access key** | Cloudflare → R2 → Manage R2 API Tokens → Create | `R2_ACCESS_KEY_ID` |
| **R2 secret access key** | Same place (shown once!) | `R2_SECRET_ACCESS_KEY` |
| **Sentry DSN** | https://sentry.io → project settings → Client Keys | `SENTRY_DSN` |
| **Google Maps API key** | https://console.cloud.google.com → APIs & Services → Credentials | `GOOGLE_MAPS_API_KEY` |
| **Vercel token** (optional) | https://vercel.com/account/tokens | `VERCEL_TOKEN` (local .env only) |
| **GitHub PAT** (optional) | https://github.com/settings/tokens | `GH_PAT` (only if using CI/CD) |

### 🔴 Critical — never commit these to git

- Supabase DB password
- Supabase service_role key
- NextAuth secret
- Paystack secret key
- Paystack webhook secret
- Termii API key
- Postmark API key
- R2 secret access key
- Sentry auth token
- Vercel token
- GitHub PAT

The `.gitignore` already excludes `.env*` files. The `.env.example` file IS safe to commit because it has no real values.

---

## Quick start (5-minute version)

If you just want to get something live today:

```bash
# 1. Push code to GitHub
git push -u origin main

# 2. Create Supabase project (skip for now — use SQLite)
# (We'll use the existing SQLite for the first deploy)

# 3. Install Vercel CLI
npm install -g vercel

# 4. Deploy from CLI
vercel
vercel --prod

# 5. Set minimum env vars in Vercel dashboard
# - NEXTAUTH_SECRET (openssl rand -base64 32)
# - NEXTAUTH_URL (your vercel URL)
# - NEXT_PUBLIC_APP_URL (same)

# 6. Visit the URL — it should work!
```

Once that's live, come back and add Supabase + Paystack + Termii one at a time, testing each addition.

---

## Need help?

- **Vercel docs**: https://vercel.com/docs
- **Supabase docs**: https://supabase.com/docs
- **Prisma + Supabase guide**: https://supabase.com/docs/guides/integrations/prisma
- **Paystack docs**: https://paystack.com/docs
- **Termii docs**: https://developers.termii.com
- **Postmark docs**: https://postmarkapp.com/developer

If you hit a specific error, share the error message + the step where it happened and I can help debug.
