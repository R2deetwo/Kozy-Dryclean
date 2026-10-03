// =============================================================================
// GET /api/reviews/google-optout — the one-tap "never ask me again"
// =============================================================================
// Every review-ask email carries this link. One tap, the customer is on the
// no-ask list forever, and the page says so plainly. HMAC-signed per
// customer — no login needed.
// =============================================================================

import { NextResponse } from 'next/server'
import { optOutReviewAsks, verifyAskToken } from '@/lib/google-reviews'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const userId = url.searchParams.get('u') ?? ''
  const token = url.searchParams.get('t') ?? ''
  if (!userId || !verifyAskToken(userId, token, 'review-optout')) {
    return NextResponse.json(
      { error: 'INVALID_LINK', message: 'That link is not valid.' },
      { status: 400 }
    )
  }
  await optOutReviewAsks(userId)
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kozy Care — no more review asks</title>
<meta name="robots" content="noindex">
<style>
  body{margin:0;font-family:system-ui,-apple-system,sans-serif;background:#F7F5F0;color:#0A192F;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px}
  .card{max-width:420px;background:#fff;border-radius:18px;box-shadow:0 10px 40px rgba(15,35,64,.12);padding:32px;text-align:center}
  .k{font-family:Georgia,serif;font-size:20px;font-weight:700}
  .gold{color:#B8860B}
  h1{font-family:Georgia,serif;font-size:22px;margin:18px 0 8px}
  p{font-size:14px;line-height:1.6;color:#5B6B82;margin:0 0 18px}
  a{display:inline-block;background:#0A192F;color:#fff;text-decoration:none;border-radius:999px;padding:10px 22px;font-size:13px;font-weight:600}
</style></head>
<body><div class="card">
  <div class="k">K<span class="gold">ozy</span> Care</div>
  <h1>You&rsquo;re on the no-ask list</h1>
  <p>Done — we will never email you about leaving a Google review again. Your service and everything else about your account are unchanged. Thank you for telling us.</p>
  <a href="/">Back to Kozy Care</a>
</div></body></html>`
  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
