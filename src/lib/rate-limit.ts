// =============================================================================
// Rate limiting — Upstash Redis (shared, durable across serverless instances)
// =============================================================================
// Vercel serverless functions spin up many independent instances, so an
// in-process Map is only a soft limit — each instance starts its own counter.
// This module backs every rate limit in the app with Upstash Redis (REST), so
// the counter is shared by ALL instances and survives cold starts.
//
// Configuration (set in .env.local / Vercel → Environment Variables):
//   UPSTASH_REDIS_REST_URL   — e.g. https://smooth-mole-123.upstash.io
//   UPSTASH_REDIS_REST_TOKEN — from the Upstash console
//
// If (and only if) BOTH vars are missing — e.g. a fresh local clone — the
// module falls back to the previous in-memory limiter for ALL call sites
// uniformly. There is deliberately no per-endpoint mixing: either every limit
// is real (Redis) or every limit is the soft local one, never a blend.
//
// All call sites `await rateLimit(...)` — the signature is unchanged apart
// from becoming async.
// =============================================================================

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

export interface RateLimitOptions {
  /** Maximum number of requests allowed in the window */
  max: number
  /** Time window in milliseconds */
  windowMs: number
}

export interface RateLimitResult {
  success: boolean
  remaining: number
  resetAt: number
}

// ---------------------------------------------------------------------------
// Shared Redis client (single instance per process)
// ---------------------------------------------------------------------------
const redisUrl = process.env.UPSTASH_REDIS_REST_URL
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN

const redis =
  redisUrl && redisToken
    ? new Redis({ url: redisUrl, token: redisToken })
    : undefined

export const rateLimitBackend: 'upstash' | 'memory' = redis ? 'upstash' : 'memory'

// ---------------------------------------------------------------------------
// Upstash path — cached Ratelimit instances per (max, windowMs) combination
// ---------------------------------------------------------------------------
const limiters = new Map<string, Ratelimit>()

function getLimiter(max: number, windowMs: number): Ratelimit {
  const key = `${max}:${windowMs}`
  let limiter = limiters.get(key)
  if (!limiter) {
    limiter = new Ratelimit({
      redis: redis!,
      prefix: 'kozy:rl',
      // Fixed window matches the semantics of the previous in-memory limiter
      limiter: Ratelimit.fixedWindow(max, `${windowMs} ms`),
      // On a Redis outage, fail OPEN (allow the request) rather than bricking
      // signup/checkout — the error is logged loudly below.
      timeout: 1000,
    })
    limiters.set(key, limiter)
  }
  return limiter
}

/** Exported for tests/diagnostics: which backend is actually active. */
export async function rateLimit(
  identifier: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  if (!redis) {
    return memoryRateLimit(identifier, options)
  }
  try {
    const result = await getLimiter(options.max, options.windowMs).limit(identifier)
    return {
      success: result.success,
      remaining: result.remaining,
      resetAt: result.reset,
    }
  } catch (err) {
    // Redis unreachable / misconfigured — fail open, but make it visible.
    console.error('[rate-limit] Upstash error — allowing request (fail-open):', err)
    return {
      success: true,
      remaining: options.max,
      resetAt: Date.now() + options.windowMs,
    }
  }
}

// ---------------------------------------------------------------------------
// In-memory fallback (local dev without Upstash credentials)
// ---------------------------------------------------------------------------
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

function memoryRateLimit(
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
