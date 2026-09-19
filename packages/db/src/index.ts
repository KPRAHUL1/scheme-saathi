import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './generated/client'

// Next.js dev hot-reloads modules, and each PrismaClient opens its own pool.
// Caching on globalThis stops every save from leaking a set of connections.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

/**
 * Created on first call, never at import. `next build` imports every route
 * module to collect page data, so an import-time client would demand a live
 * DATABASE_URL just to compile — breaking CI and env-less preview builds.
 */
export function getPrisma(): PrismaClient {
  const cached = globalForPrisma.prisma
  // After `prisma generate`, dev hot reload loads a new PrismaClient class but
  // globalThis still holds an instance of the old one, which doesn't know about
  // new columns (they come back undefined). Only reuse a client built from the
  // code that is loaded now; otherwise replace it.
  if (cached instanceof PrismaClient) return cached
  if (cached) void (cached as { $disconnect(): Promise<void> }).$disconnect().catch(() => {})

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env at the repo root.')
  }

  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
  // Cached in production too: a warm serverless instance reuses its pool.
  globalForPrisma.prisma = client
  return client
}

export * from './generated/client'
