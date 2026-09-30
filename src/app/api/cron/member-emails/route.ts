// =============================================================================
// GET|POST /api/cron/member-emails — the daily member relationship pass
// =============================================================================
// Triggered daily by vercel.json (08:00 UTC = 09:00 WAT) and callable by the
// office at any time. Auth: the standard Vercel CRON_SECRET bearer token
// (set it in the project env — Vercel's scheduler sends it automatically;
// manual calls pass the same value).
//
//   GET  ?dry=1  → plan the whole sweep WITHOUT sending (the office can see
//                  exactly who would get what, and why)
//   GET          → run the sweep for real (subject to the safety gate)
//   POST         → same as GET (body may carry { dry: true })
//
// The safety gate lives in src/lib/member-emails.ts: with the automation
// disarmed, only allowlisted recipients (test accounts + the owner) actually
// receive — everyone else is reported as SUPPRESSED. Flip the
// memberEmailAutomation setting in admin Settings to arm real sends.
// =============================================================================

import { NextResponse } from 'next/server'
import { runMemberEmailSweep } from '@/lib/member-emails'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    // No secret configured → refuse. A public schedule must never become an
    // open email trigger.
    return false
  }
  const header = req.headers.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  return token === secret
}

async function handle(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }
  const url = new URL(req.url)
  const dryParam = url.searchParams.get('dry')
  let dry = dryParam === '1' || dryParam === 'true'
  if (!dryParam && req.method === 'POST') {
    try {
      const body = await req.json()
      dry = body?.dry === true
    } catch {
      // empty body is fine
    }
  }
  try {
    const result = await runMemberEmailSweep({ dry })
    return NextResponse.json(result)
  } catch (e) {
    console.error('[member-emails] sweep failed:', e)
    return NextResponse.json(
      { error: 'Sweep failed', message: String(e) },
      { status: 500 }
    )
  }
}

export async function GET(req: Request) {
  return handle(req)
}

export async function POST(req: Request) {
  return handle(req)
}
