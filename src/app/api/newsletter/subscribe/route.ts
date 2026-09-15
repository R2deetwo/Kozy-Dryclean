// =============================================================================
// POST /api/newsletter/subscribe — public footer signup
// =============================================================================
// Body: { email: string, name?: string }
//
// Adds (or re-subscribes) an address on the NewsletterSubscriber list —
// prospects who never created an account. Also re-enables
// User.marketingOptIn when the address belongs to an existing customer who
// previously unsubscribed (they just explicitly asked to come back).
// Sends a branded welcome email (best-effort: a failed welcome never fails
// the signup itself).
//
// Rate limited: 5 signups/hour/IP — enough for real humans, useless for bots.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { rateLimit, getClientIP } from '@/lib/rate-limit'
import { isValidEmail, normalizeEmail } from '@/lib/email-validation'
import { sendSubscriberWelcome } from '@/lib/marketing'

const SubscribeSchema = z.object({
  email: z.string().trim().min(3).max(200),
  name: z.string().trim().max(100).optional(),
})

export async function POST(req: NextRequest) {
  const ip = getClientIP(req)
  const limit = await rateLimit(`newsletter-subscribe:${ip}`, {
    max: 5,
    windowMs: 60 * 60 * 1000,
  })
  if (!limit.success) {
    return NextResponse.json(
      { error: 'Too many attempts — please try again later' },
      { status: 429, headers: { 'Retry-After': '3600' } }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = SubscribeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 })
  }

  const email = normalizeEmail(parsed.data.email)
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 })
  }

  try {
    // Upsert the subscriber row — an unsubscribed address that signs up
    // again is re-opted-in (explicit intent beats the old opt-out).
    await db.newsletterSubscriber.upsert({
      where: { email },
      update: { optIn: true, unsubscribedAt: null, ...(parsed.data.name ? { name: parsed.data.name } : {}) },
      create: { email, name: parsed.data.name ?? null, source: 'footer' },
    })

    // If this is an existing customer who had unsubscribed, bring them back
    await db.user.updateMany({
      where: { email },
      data: { marketingOptIn: true },
    })
  } catch (e) {
    console.error('Newsletter subscribe failed:', e)
    return NextResponse.json({ error: 'Could not save your subscription' }, { status: 500 })
  }

  // Welcome email — best-effort
  try {
    await sendSubscriberWelcome(email)
  } catch (e) {
    console.error('Subscriber welcome email failed (signup still saved):', e)
  }

  return NextResponse.json({
    success: true,
    message: 'You are on the list — watch out for offers and updates from Kozy Care.',
  })
}
