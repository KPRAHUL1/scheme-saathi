import { loadEnvConfig } from '@next/env'
import type { NextConfig } from 'next'
import { resolve } from 'node:path'

// One .env at the monorepo root, shared with the Prisma CLI and seed script.
// On Vercel there is no .env file; variables come from the project settings.
// forceReload is required: Next has already loaded (and cached) env from
// apps/web by the time this runs, and without it this call is a silent no-op.
loadEnvConfig(resolve(process.cwd(), '../..'), process.env.NODE_ENV !== 'production', console, true)

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source rather than built JS.
  transpilePackages: ['@saathi/core', '@saathi/db'],
}

export default nextConfig
