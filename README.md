# Kozy Drycleaning and Laundry Services

> Uncompromising care. Exceptional convenience.

Premium dry cleaning & laundry service for Lagos — from designer personal wear to corporate linen programs. Built with Next.js 16, TypeScript, Prisma + Supabase (Postgres), and Tailwind CSS.

## What's in this repo

A production-grade platform with three role-based portals:

- **Landing page** (`/`) — public marketing site with hero, pricing toggle (Retail/Corporate), How It Works
- **Customer Portal** (`/portal`) — auth-gated dashboard with order tracking, booking wizard, invoices
- **Atelier Console** (`/admin`) — admin dashboard with Kanban board, payment verification queue, CRM, finance charts
- **Driver App** (`/driver`) — mobile-optimized route view with swipe-to-confirm pickups/deliveries

## Tech Stack

- **Framework**: Next.js 16 (App Router) + TypeScript 5
- **Database**: Prisma ORM + Supabase Postgres
- **Styling**: Tailwind CSS 4 + shadcn/ui (Kozy brand: Midnight Navy `#0A192F` + Champagne Gold `#D4AF37`)
- **Typography**: Playfair Display (serif) + Outfit (geometric sans-serif)
- **State**: Zustand for ephemeral UI state, Prisma for persistent data
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
- `prisma/schema.prisma` — database schema (User, Order, Payment, GarmentMedia, StatusEvent)

## License

Proprietary. © 2026 Kozy Drycleaning and Laundry Services.
