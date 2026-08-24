# Kozy Drycleaning and Laundry Services

> Uncompromising care. Exceptional convenience.

Premium dry cleaning & laundry service for Lagos — from designer personal wear to corporate linen programs. Built with Next.js 16, TypeScript, Prisma + Supabase (Postgres), and Tailwind CSS.

## ⚠️ Current architecture status (as of Phase 1 cleanup)

This repo is mid-migration from a UI demo to a production app. The current state:

- **Routing**: Single route (`/`) with a **client-side `useState` toggle** in `src/app/page.tsx` that switches between Landing / Customer / Admin / Driver views. There is **no `middleware.ts`** and **no real route guards** — the "Admin" tab is accessible to anyone.
- **Data layer**: Frontend reads from Zustand (seeded in-memory + persisted to `localStorage`). Supabase Postgres is provisioned and the schema is pushed, but **no `/api/*` routes exist yet** — the frontend does not yet talk to the database.
- **Auth**: A demo "auth gate" with one-click demo-account buttons. **Not secure** — there is no real session, no NextAuth, no JWT.

### Migration plan (Phases 2-4)

- **Phase 2** (config hardening): Remove `ignoreBuildErrors`, add security headers to `next.config.ts`.
- **Phase 3** (real backend wiring): Build `/api/orders`, `/api/payments`, `/api/users/me` with server-side RBAC. Replace Zustand selectors with React Query fetches.
- **Phase 4** (real auth + real routes): Convert `/`, `/portal`, `/admin`, `/driver` into real Next.js App Router routes. Add `middleware.ts` enforcing session + role. Delete the demo auth gate and the role-switcher toggle. Unauthenticated visit to `/admin` redirects to login.

See `ARCHITECTURE.md` for the full Phase 5/6 plan (Brevo email, Chakra WhatsApp, CRM mass messaging, multi-tenant).

## What's in this repo (target architecture)

Four role-based portals:

- **Landing page** (`/`) — public marketing site with hero, pricing toggle (Retail/Corporate), How It Works
- **Customer Portal** (`/portal`) — auth-gated dashboard with order tracking, booking wizard, invoices
- **Atelier Console** (`/admin`) — admin dashboard with Kanban/List toggle, payment verification queue, CRM, finance charts, settings (bank account + pricing management)
- **Driver App** (`/driver`) — mobile-optimized route view with swipe-to-confirm pickups/deliveries

## Tech Stack

- **Framework**: Next.js 16 (App Router) + TypeScript 5
- **Database**: Prisma ORM + Supabase Postgres
- **Styling**: Tailwind CSS 4 + shadcn/ui (Kozy brand: Midnight Navy `#0A192F` + Champagne Gold `#D4AF37`)
- **Typography**: Playfair Display (serif) + Outfit (geometric sans-serif)
- **State**: Zustand for ephemeral UI state (form drafts, wizard step) — being replaced by React Query + real API routes in Phase 3
- **DnD**: @dnd-kit for Kanban board
- **Animations**: Framer Motion

## Quick Start

```bash
# Clone
git clone https://github.com/R2deetwo/Kozy-Dryclean.git
cd Kozy-Dryclean

# Install
bun install   # or: npm install

# Set up env
cp .env.example .env.local
# Edit .env.local with your Supabase + NextAuth values

# Push Prisma schema to Supabase
bun run db:generate
bun run db:push

# (Optional) Seed demo data
bun run scripts/seed-supabase.ts

# Run dev server
bun run dev
```

Visit `http://localhost:3000`.

## Environment Variables

See `.env.example` for the full list. Critical ones:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Supabase pooler URL (port 6543) |
| `DIRECT_URL` | Supabase direct URL (port 5432) for migrations |
| `NEXTAUTH_SECRET` | 32-char random string — generate with `openssl rand -base64 32` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://[project-ref].supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon public key |

## Documentation

- `DEPLOYMENT.md` — full deployment guide (Vercel + Supabase + Paystack + Termii)
- `ARCHITECTURE.md` — Phase 2-6 roadmap (auth, notifications, CRM, multi-tenant)
- `prisma/schema.prisma` — database schema (User, Order, Payment, GarmentMedia, StatusEvent)

## License

Proprietary. © 2026 Kozy Drycleaning and Laundry Services.
