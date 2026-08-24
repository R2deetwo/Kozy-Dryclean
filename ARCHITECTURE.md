# Kozy Architecture — Phase 2 Roadmap

This document covers the next major features and how they fit together. It's the design doc we'll work from when implementing each piece.

---

## Table of Contents

1. [Multi-tenant architecture](#1-multi-tenant-architecture)
2. [Real authentication with Brevo email verification](#2-real-authentication-with-brevo-email-verification)
3. [WhatsApp integration via Chakra Chat](#3-whatsapp-integration-via-chakra-chat)
4. [CRM with mass messaging](#4-crm-with-mass-messaging)
5. [Implementation order](#5-implementation-order)

---

## 1. Multi-tenant architecture

### What "multi-tenant" means for Kozy

Kozy could grow in two directions:
- **Single-tenant with multiple staff**: One Kozy business, multiple admins/drivers (current state)
- **Multi-tenant SaaS**: Kozy becomes a platform — multiple laundry businesses sign up, each with their own customers, drivers, pricing, and branding

### Recommended approach: Single-tenant now, multi-tenant-ready

For now, keep single-tenant. But design the schema so multi-tenant can be added later by just adding a `tenantId` column to every table.

### Schema changes (when ready)

```prisma
model Tenant {
  id          String   @id @default(cuid())
  name        String   // "Kozy Lagos"
  subdomain   String   @unique // "kozy" → kozy.app.kozy-dryclean.vercel.app
  branding    Json     // { primaryColor, logo, etc. }
  plan        String   @default("trial") // trial, pro, enterprise
  createdAt   DateTime @default(now())
}

model User {
  id          String   @id @default(cuid())
  tenantId    String   // ← add this
  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  email       String   @unique
  // ... rest unchanged
}
```

### How to enforce isolation

Two options:

**Option A — Application-level (simpler)**: Every Prisma query includes `where: { tenantId: session.tenantId }`. Use Prisma middleware to inject this automatically:

```ts
prisma.$use(async (params, next) => {
  if (params.model && params.action !== 'createMany') {
    const session = await getSession()
    if (session?.tenantId) {
      params.args = params.args || {}
      params.args.where = { ...params.args.where, tenantId: session.tenantId }
    }
  }
  return next(params)
})
```

**Option B — Postgres Row-Level Security (more secure)**: Use Supabase's RLS policies. Each tenant gets a Postgres role, and the database itself rejects cross-tenant queries. More work but bulletproof.

**Recommendation**: Start with Option A. Move to Option B when you have 50+ tenants.

---

## 2. Real authentication with Brevo email verification

### Why Brevo (instead of Postmark)

Brevo (formerly Sendinblue) offers:
- Email + SMS + WhatsApp + Chat in one platform
- Free tier: 300 emails/day forever
- Cheaper than Postmark for volume ($25/mo for 20k emails vs Postmark's $50)
- Built-in contact management (useful for CRM)

### Architecture

```
Customer signs up with email
        ↓
NextAuth creates user (unverified)
        ↓
Brevo sends verification email with magic link
        ↓
Customer clicks link
        ↓
Backend verifies token, marks user.emailVerified = true
        ↓
NextAuth issues session JWT
```

### Implementation

**Step 1 — Install Brevo SDK**

```bash
bun add @getbrevo/brevo
```

**Step 2 — Create email service** (`src/lib/email.ts`)

```ts
import Brevo from '@getbrevo/brevo'

const brevo = new Brevo({
  apiKey: process.env.BREVO_API_KEY!,
})

export async function sendVerificationEmail(email: string, token: string) {
  const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL}/verify-email?token=${token}`

  await brevo.smtp.sendTransacEmail({
    sender: { email: 'concierge@kozy.ng', name: 'Kozy' },
    to: [{ email }],
    subject: 'Verify your Kozy account',
    htmlContent: `
      <div style="font-family: Georgia, serif; background: #F8F9FA; padding: 40px;">
        <div style="max-width: 480px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px;">
          <h1 style="color: #0A192F; font-family: Georgia, serif;">Welcome to Kozy</h1>
          <p style="color: #6F88A8; line-height: 1.6;">
            Please verify your email to activate your account and start booking pickups.
          </p>
          <a href="${verifyUrl}" style="display: inline-block; background: #D4AF37; color: #0A192F; padding: 12px 24px; border-radius: 9999px; text-decoration: none; font-weight: 600; margin: 24px 0;">
            Verify my email
          </a>
          <p style="color: #6F88A8; font-size: 12px; margin-top: 24px;">
            Or paste this link: ${verifyUrl}
          </p>
        </div>
      </div>
    `,
  })
}
```

**Step 3 — NextAuth Credentials provider**

```ts
// src/lib/auth.ts
import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { sendVerificationEmail } from './email'

export const authOptions = {
  providers: [
    CredentialsProvider({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const user = await db.user.findUnique({ where: { email: credentials.email } })
        if (!user) return null
        if (!user.emailVerified) {
          // Resend verification email
          await sendVerificationEmail(user.email, generateToken(user.id))
          throw new Error('Please verify your email — we just sent you a new link.')
        }
        const valid = await bcrypt.compare(credentials.password, user.passwordHash)
        return valid ? user : null
      },
    }),
  ],
  // ... callbacks, session strategy, etc.
}
```

**Step 4 — Signup flow**

```ts
// src/app/api/auth/signup/route.ts
export async function POST(req: Request) {
  const { email, password, name, phone } = await req.json()
  const existing = await db.user.findUnique({ where: { email } })
  if (existing) return Response.json({ error: 'Email already registered' }, { status: 400 })

  const passwordHash = await bcrypt.hash(password, 10)
  const user = await db.user.create({
    data: { email, passwordHash, name, phone, role: 'B2C', emailVerified: null },
  })

  const token = generateToken(user.id) // random 32-char string, expires in 24h
  await db.verificationToken.create({
    data: { token, userId: user.id, expires: new Date(Date.now() + 86400000) },
  })

  await sendVerificationEmail(email, token)
  return Response.json({ ok: true })
}
```

**Step 5 — Verification endpoint**

```ts
// src/app/api/auth/verify-email/route.ts
export async function POST(req: Request) {
  const { token } = await req.json()
  const record = await db.verificationToken.findUnique({ where: { token } })
  if (!record || record.expires < new Date()) {
    return Response.json({ error: 'Invalid or expired token' }, { status: 400 })
  }
  await db.user.update({
    where: { id: record.userId },
    data: { emailVerified: new Date() },
  })
  await db.verificationToken.delete({ where: { token } })
  return Response.json({ ok: true })
}
```

### Schema additions

```prisma
model User {
  // ... existing fields
  passwordHash   String?
  emailVerified   DateTime?
}

model VerificationToken {
  id        String   @id @default(cuid())
  token     String   @unique
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  expires   DateTime
  createdAt DateTime @default(now())
}
```

### Env vars needed

```
BREVO_API_KEY=xkeysib-...
BREVO_SENDER_EMAIL=concierge@kozy.ng
BREVO_SENDER_NAME=Kozy
```

---

## 3. WhatsApp integration via Chakra Chat

### What Chakra Chat provides

Chakra Chat (https://chakrachat.com) is a WhatsApp Business API provider tailored for African businesses. It offers:
- WhatsApp template messages (pre-approved by Meta)
- Session messaging (free-form chat within 24h of customer reply)
- Bulk WhatsApp broadcasts
- Click-to-chat links
- Webhook delivery reports

### When to use WhatsApp vs SMS vs Email

| Channel | Use case | Cost |
|---|---|---|
| **WhatsApp** | Order updates, receipts, two-way chat | ₦2-5 per message |
| **SMS** | OTP codes, critical alerts, fallback for no-WhatsApp | ₦2-4 per SMS |
| **Email** | Invoices, monthly statements, marketing | ₦0.05 per email |

### Architecture

```
Order status changes
        ↓
Backend decides channel (WhatsApp preferred, SMS fallback)
        ↓
Chakra Chat API → sends WhatsApp template message
        ↓
Webhook → marks notification as delivered
```

### Implementation

**Step 1 — Install Chakra SDK** (or use fetch)

```bash
# Chakra doesn't have an official SDK, use fetch
# Just add the base URL to env vars
```

**Step 2 — Create notification service** (`src/lib/notifications.ts`)

```ts
const CHAT_API = 'https://api.chakrachat.com/v1'

export async function sendWhatsApp(to: string, template: string, params: Record<string, string>) {
  const res = await fetch(`${CHAT_API}/messages/send`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.CHAKRA_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to, // +2348074441122
      type: 'template',
      template: {
        name: template, // 'order_status_update' (pre-approved in Chakra dashboard)
        language: 'en',
        params: Object.values(params),
      },
    }),
  })
  return res.json()
}

export async function sendSMS(to: string, message: string) {
  // Termii fallback
  const res = await fetch('https://api.ng.termii.com/api/sms/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to,
      from: process.env.TERMII_SENDER_ID,
      sms: message,
      api_key: process.env.TERMII_API_KEY,
      channel: 'generic',
    }),
  })
  return res.json()
}

export async function notifyCustomer(order: Order, trigger: string) {
  const user = await db.user.findUnique({ where: { id: order.userId } })
  if (!user?.phone) return

  const template = TEMPLATE_MAP[trigger] // 'order_picked_up', 'payment_verified', etc.
  const params = {
    customerName: user.name.split(' ')[0],
    orderNumber: order.orderNumber,
    status: trigger.replace(/_/g, ' ').toLowerCase(),
  }

  // Try WhatsApp first, fall back to SMS
  try {
    await sendWhatsApp(user.phone, template, params)
  } catch {
    await sendSMS(user.phone, buildMessage(trigger, order, user))
  }
}
```

**Step 3 — Pre-approve WhatsApp templates**

In Chakra dashboard, submit these templates (Meta takes 24-48h to approve):

1. `order_placed` — "Hi {{1}}, your Kozy pickup (#{{2}}) is booked for {{3}}."
2. `order_picked_up` — "Goods received! Items collected by {{1}}. Track: {{2}}"
3. `payment_verified` — "Payment confirmed! ₦{{1}} received for Order #{{2}}."
4. `order_delivered` — "Delivered! Order #{{1}} is complete. Rate: {{2}}"
5. `b2b_invoice_ready` — "Order #{{1}} weighed {{2}}kg. Total: ₦{{3}}. Pay: {{4}}"

**Step 4 — Wire into order status updates**

In `src/lib/store.ts` (or the future `/api/orders/[id]/status` route):

```ts
updateOrderStatus: async (orderId, status, actorId) => {
  // ... existing logic
  await notifyCustomer(order, triggerForStatus(status))
}
```

### Env vars

```
CHAKRA_API_KEY=...
CHAKRA_SENDER_ID=Kozy
TERMII_API_KEY=...  (fallback)
TERMII_SENDER_ID=Kozy
```

---

## 4. CRM with mass messaging

### Use cases

1. **Promotional broadcast**: "20% off all suit dry cleaning this weekend"
2. **Service announcement**: "We're now serving Lekki Phase 2"
3. **Re-engagement**: "We haven't seen you in 30 days — here's ₦500 off"
4. **Holiday greetings**: "Eid Mubarak from Kozy"

### Architecture

```
Admin composes message in CRM
        ↓
Selects audience (all customers, B2C only, B2B only, specific segment)
        ↓
Backend queues message to Brevo (email) + Chakra (WhatsApp) + Termii (SMS)
        ↓
Each recipient gets the message on their preferred channel
        ↓
Webhooks update delivery status
```

### Schema

```prisma
model Campaign {
  id          String   @id @default(cuid())
  name        String   // "Weekend Promo - Aug 2026"
  channel     String   // 'whatsapp', 'sms', 'email', 'all'
  subject     String?
  body        String
  audience    String   // 'all', 'b2c', 'b2b', 'segment:active', etc.
  status      String   @default("draft") // draft, scheduled, sending, sent, failed
  scheduledAt DateTime?
  sentAt      DateTime?
  createdAt   DateTime @default(now())
  createdById String
  createdBy   User     @relation("CampaignCreator", fields: [createdById], references: [id])

  deliveries  CampaignDelivery[]
}

model CampaignDelivery {
  id          String   @id @default(cuid())
  campaignId  String
  campaign    Campaign @relation(fields: [campaignId], references: [id])
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  channel     String   // 'whatsapp', 'sms', 'email'
  status      String   @default("pending") // pending, sent, delivered, failed
  sentAt      DateTime?
  deliveredAt DateTime?
  error       String?
}
```

### Implementation

**Admin CRM page** (`/admin/crm`)

- Compose message (textarea + channel selector + audience filter)
- Preview how it'll look on each channel
- Schedule or send immediately
- See delivery stats (sent / delivered / failed)

**Backend send endpoint** (`/api/campaigns/[id]/send`)

```ts
export async function POST(req: Request, { params }) {
  const campaign = await db.campaign.findUnique({ where: { id: params.id } })
  if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
    return Response.json({ error: 'Already sent' }, { status: 400 })
  }

  // Get audience
  const users = await getAudience(campaign.audience) // returns User[]

  // Queue each delivery (use a job queue like BullMQ or Vercel Cron)
  for (const user of users) {
    await db.campaignDelivery.create({
      data: {
        campaignId: campaign.id,
        userId: user.id,
        channel: pickChannel(user, campaign.channel),
        status: 'pending',
      },
    })
  }

  // Mark campaign as sending
  await db.campaign.update({
    where: { id: campaign.id },
    data: { status: 'sending', sentAt: new Date() },
  })

  // Trigger the background job
  await sendCampaignBatch(campaign.id)

  return Response.json({ ok: true, queued: users.length })
}
```

**Background sender** (Vercel Cron — runs every minute)

```ts
// src/app/api/cron/process-campaigns/route.ts
export async function GET(req: Request) {
  // Verify it's a Vercel Cron request
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const pending = await db.campaignDelivery.findMany({
    where: { status: 'pending' },
    take: 50, // process 50 per minute to avoid rate limits
    include: { campaign: true, user: true },
  })

  for (const delivery of pending) {
    try {
      if (delivery.channel === 'whatsapp') {
        await sendWhatsApp(delivery.user.phone, 'promo_broadcast', { message: delivery.campaign.body })
      } else if (delivery.channel === 'sms') {
        await sendSMS(delivery.user.phone, delivery.campaign.body)
      } else if (delivery.channel === 'email') {
        await sendEmail(delivery.user.email, delivery.campaign.subject, delivery.campaign.body)
      }
      await db.campaignDelivery.update({
        where: { id: delivery.id },
        data: { status: 'sent', sentAt: new Date() },
      })
    } catch (e) {
      await db.campaignDelivery.update({
        where: { id: delivery.id },
        data: { status: 'failed', error: e.message },
      })
    }
  }

  return Response.json({ processed: pending.length })
}
```

**Vercel cron config** (`vercel.json`)

```json
{
  "crons": [
    {
      "path": "/api/cron/process-campaigns",
      "schedule": "* * * * *"
    }
  ]
}
```

### Cost estimation

For 1,000 customers:
- WhatsApp broadcast: ₦2,000-5,000 per campaign
- SMS broadcast: ₦2,000-4,000 per campaign
- Email broadcast: ₦50 per campaign (Brevo free tier)

---

## 5. Implementation order

### Phase 2A — Real authentication (1 week)
1. Sign up for Brevo (free) — get API key
2. Add `passwordHash`, `emailVerified` columns to User model
3. Add `VerificationToken` model
4. Create `/api/auth/signup` route
5. Create `/api/auth/verify-email` route
6. Replace demo AuthGate with real NextAuth form
7. Add "Sign up" link below the sign-in form
8. Test end-to-end: signup → email → verify → login

### Phase 2B — WhatsApp notifications (3-5 days)
1. Sign up for Chakra Chat — get API key
2. Submit 5 WhatsApp templates for approval (24-48h)
3. Create `src/lib/notifications.ts` service
4. Wire into `updateOrderStatus` in store
5. Add `notifyCustomer()` calls at every pipeline transition
6. Test: change order status → customer gets WhatsApp message

### Phase 2C — CRM mass messaging (1-2 weeks)
1. Add `Campaign` + `CampaignDelivery` models
2. Create `/admin/crm` page with composer
3. Add audience selector (all / B2C / B2B / segment)
4. Create `/api/campaigns` CRUD routes
5. Set up Vercel Cron for background sending
6. Add delivery stats dashboard
7. Test: send a promo to all customers → see delivery stats

### Phase 2D — Multi-tenant (defer until needed)
1. Add `Tenant` model
2. Add `tenantId` to every table
3. Add Prisma middleware for automatic tenant filtering
4. Add tenant switching in admin header
5. Add tenant-scoped subdomains (kozy.vercel.app → tenant1.kozy.vercel.app)

---

## Cost summary (monthly)

| Service | Free tier | Paid tier | When to upgrade |
|---|---|---|---|
| Vercel | Hobby (free) | Pro $20/mo | When you need team features or >100 deploys/day |
| Supabase | Free (500MB DB) | Pro $25/mo | Before going live (to avoid auto-pause) |
| Brevo | 300 emails/day | $25/mo for 20k emails | When you exceed 300/day |
| Chakra Chat | Pay per message | — | No monthly fee, just per-message |
| Termii | Pay per SMS | — | No monthly fee |
| Paystack | 1.5% per transaction | — | No monthly fee |
| Cloudflare R2 | 10GB free | $0.015/GB/mo | When you exceed 10GB of uploads |

**Estimated monthly cost at launch (100 customers)**: ~$50-70
**At 1,000 customers**: ~$150-200

---

## Next steps

Pick which phase you want to tackle first:

- **"Let's do Phase 2A — real auth with Brevo"** — I'll walk you through signing up for Brevo, adding the schema, building the signup/login flow, and wiring up email verification. ~1 week of work.

- **"Let's do Phase 2B — WhatsApp notifications"** — I'll walk you through Chakra Chat signup, template submission, and wiring up the notification service. ~3-5 days.

- **"Let's do Phase 2C — CRM mass messaging"** — I'll build the admin CRM page, campaign models, and background sender. ~1-2 weeks.

- **"Let's do the frontend → Supabase wiring first"** — The biggest gap right now is that the frontend still reads from Zustand localStorage, not from Supabase. This means when you sign in on a fresh device, you won't see the seeded orders. This should actually be Phase 2.0 — do it before 2A/2B/2C.

My recommendation: **do the frontend → Supabase wiring first**. It's the foundation everything else depends on. Then 2A (real auth), then 2B (WhatsApp), then 2C (CRM).
