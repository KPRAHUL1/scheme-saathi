import { config } from 'dotenv'
import { resolve } from 'node:path'
import { defineConfig } from 'prisma/config'

// One .env at the repo root serves the web app, this CLI and the seed script.
config({ path: resolve(import.meta.dirname, '../../.env'), quiet: true })

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // process.env rather than prisma's env() helper: env() throws when unset,
    // which would stop `prisma generate` from working before a DB exists.
    url: process.env['DATABASE_URL'],
  },
})
