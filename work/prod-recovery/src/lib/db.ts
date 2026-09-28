import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Full SQL logging only in development; production logs errors only
    // (per-query logging in prod leaks data volume patterns and is noisy).
    // PRISMA_QUIET=1 silences query logs in dev too — for memory-tight
    // dev servers (the sandbox OOM-killed next-server with full logging
    // while two QA browsers were open).
    log:
      process.env.NODE_ENV === 'development' && process.env.PRISMA_QUIET !== '1'
        ? ['query']
        : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db