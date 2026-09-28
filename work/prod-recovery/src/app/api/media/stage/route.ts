// Phase 51 — POST /api/media/stage
//
// Stage ONE condition photo before the order exists. The booking wizard
// calls this per photo the moment it is selected (compressed client-side to
// a compact JPEG), so:
//   - each request stays ~200-300KB (the old all-photos-in-the-order-POST
//     design hit the serverless request ceiling at 6 photos — customers
//     with 30 garments fell back to WhatsApp),
//   - the upload happens WHILE the customer fills in the rest of the wizard
//     (perceived as instant), with per-photo retry.
//
// The order POST later claims the staged rows by presenting BOTH the photo
// IDs and the client's scoping token; unclaimed rows are purged after 24h
// (lib/media.ts).
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { StagePhotoSchema } from '@/lib/schemas'
import { rateLimit, getClientIP } from '@/lib/rate-limit'
import { scheduleMediaPurge } from '@/lib/media'

export async function POST(req: Request) {
  // ----- Rate limit: 120 staged photos per 15 min per IP -----
  // A 30-photo basket with a few retries fits comfortably; a scripted
  // dump-the-database loop does not.
  const ip = getClientIP(req)
  const limit = await rateLimit(`stage-photo:${ip}`, {
    max: 120,
    windowMs: 15 * 60 * 1000,
  })
  if (!limit.success) {
    return NextResponse.json(
      { error: 'Too many photo uploads. Please try again in a few minutes.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((limit.resetAt - Date.now()) / 1000)),
        },
      }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = StagePhotoSchema.safeParse(body)
  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? 'Photo could not be validated'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const { token, photo } = parsed.data

  try {
    const row = await db.stagedPhoto.create({
      data: {
        token,
        data: photo,
        bytes: photo.length,
      },
      select: { id: true },
    })

    // Throttled housekeeping piggy-backs on upload traffic (the daily cron
    // is the backstop on quiet days).
    scheduleMediaPurge()

    return NextResponse.json({ id: row.id })
  } catch (e) {
    console.error('staged photo create failed:', e)
    return NextResponse.json(
      { error: 'Could not save that photo — please retry.' },
      { status: 500 }
    )
  }
}
