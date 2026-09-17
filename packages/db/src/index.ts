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
  if (globalForPrisma.prisma) return globalForPrisma.prisma

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
