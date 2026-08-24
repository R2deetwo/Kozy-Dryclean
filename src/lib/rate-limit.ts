// =============================================================================
// Simple in-memory rate limiter
// =============================================================================
// For production at scale, replace with @upstash/ratelimit + Redis.
// For now, this uses a Map in server memory — works for single-instance deploys
// (Vercel serverless functions may have multiple instances, so this is a
// best-effort limiter, not a hard guarantee).
// =============================================================================

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Clean up expired entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store.entries()) {
      if (entry.resetAt < now) {
        store.delete(key)
      }
    }
  }, 5 * 60 * 1000).unref?.()
}

interface RateLimitOptions {
  /** Maximum number of requests allowed in the window */
  max: number
  /** Time window in milliseconds */
  windowMs: number
}

interface RateLimitResult {
  success: boolean
  remaining: number
  resetAt: number
}

export function rateLimit(
  identifier: string,
  options: RateLimitOptions
): RateLimitResult {
  const now = Date.now()
  const entry = store.get(identifier)

  if (!entry || entry.resetAt < now) {
    // First request or window expired — start fresh
    store.set(identifier, {
      count: 1,
      resetAt: now + options.windowMs,
    })
    return {
      success: true,
      remaining: options.max - 1,
      resetAt: now + options.windowMs,
    }
  }

  if (entry.count >= options.max) {
    // Rate limit exceeded
    return {
      success: false,
      remaining: 0,
      resetAt: entry.resetAt,
    }
  }

  // Increment count
  entry.count++
  return {
    success: true,
    remaining: options.max - entry.count,
    resetAt: entry.resetAt,
  }
}

// Get client IP from request (works behind Vercel's proxy)
export function getClientIP(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  const realIP = req.headers.get('x-real-ip')
  if (realIP) return realIP
  return 'unknown'
}
