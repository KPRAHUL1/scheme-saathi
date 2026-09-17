import { config } from 'dotenv'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { SchemeSchema } from '@saathi/core'
import { getPrisma, type Prisma } from '../src/index'

config({ path: resolve(import.meta.dirname, '../../../.env'), quiet: true })

/**
 * data/schemes.json is the authoring format; this loads it into Postgres.
 *
 * Built for the data-curation loop you will run dozens of times: edit the
 * JSON, run `npm run seed`, repeat. So it is fast, safe to re-run, and loud
 * about mistakes — every entry is validated before a single row is written.
 */
const SOURCE = resolve(import.meta.dirname, '../../../data/schemes.json')

async function main() {
  const raw: unknown = JSON.parse(readFileSync(SOURCE, 'utf8'))

  const parsed = SchemeSchema.array().safeParse(raw)
  if (!parsed.success) {
    console.error('✗ data/schemes.json failed validation. Nothing was written.\n')
    for (const issue of parsed.error.issues) {
      const [index, ...path] = issue.path
      const id = Array.isArray(raw) && typeof index === 'number'
        ? (raw[index] as { id?: string } | undefined)?.id
        : undefined
      const where = `scheme[${String(index)}]${id ? ` "${id}"` : ''}`
      console.error(`  ${where} → ${path.join('.') || '(entry)'}: ${issue.message}`)
    }
    process.exit(1)
  }
  const schemes = parsed.data

  // The one invariant the schema cannot see, and the key every upsert uses.
  const ids = new Set<string>()
  for (const s of schemes) {
    if (ids.has(s.id)) {
      console.error(`✗ Duplicate scheme id "${s.id}". Nothing was written.`)
      process.exit(1)
    }
    ids.add(s.id)
  }

  console.log(`✓ ${schemes.length} schemes valid`)

  // Connect only once the data is known-good, so a JSON typo reports as a
  // typo even on a machine with no database configured.
  const prisma = getPrisma()
  try {
    await write(prisma, schemes, ids)
  } finally {
    await prisma.$disconnect()
  }
}

async function write(
  prisma: ReturnType<typeof getPrisma>,
  schemes: ReturnType<typeof SchemeSchema.parse>[],
  ids: Set<string>,
) {
  // One transaction: a failure part-way leaves the catalogue as it was.
  await prisma.$transaction(
    schemes.map((s) => {
      const data = {
        name: s.name,
        ministry: s.ministry,
        benefit: s.benefit,
        benefitAmount: s.benefitAmount,
        predicates: s.predicates as unknown as Prisma.InputJsonValue,
        documents: s.documents,
        applyUrl: s.applyUrl,
        sourceUrl: s.sourceUrl,
        verifiedOn: s.verifiedOn ? new Date(s.verifiedOn) : null,
      }
      return prisma.scheme.upsert({
        where: { id: s.id },
        create: { id: s.id, ...data },
        update: data,
      })
    }),
    // Prisma's 2s default is too short for a free-tier Neon database that has
    // to wake from suspend, reached from India over a fresh TLS connection.
    { maxWait: 20_000, timeout: 30_000 },
  )

  console.log(`✓ Upserted ${schemes.length} schemes from data/schemes.json`)

  const unverified = schemes.filter((s) => !s.verifiedOn).length
  if (unverified > 0) {
    console.log(`  ⚠ ${unverified} of ${schemes.length} are unverified (verifiedOn: null)`)
  }

  // Deliberately not deleted: past MatchResults may reference them, and the
  // schema restricts that delete to protect the audit trail.
  const orphans = await prisma.scheme.findMany({
    where: { id: { notIn: [...ids] } },
    select: { id: true },
  })
  if (orphans.length > 0) {
    console.log(`  ⚠ In the database but no longer in the JSON, left untouched: ${orphans.map((o) => o.id).join(', ')}`)
  }
}

await main()
