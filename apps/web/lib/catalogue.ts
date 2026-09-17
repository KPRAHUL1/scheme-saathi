import { SchemeSchema, type Scheme } from '@saathi/core'
import { getPrisma, type Scheme as SchemeRow } from '@saathi/db'

/**
 * Re-validates a database row against core's schema, so the engine only ever
 * sees well-formed predicates even if someone edits a row in Prisma Studio.
 */
export function toScheme(row: SchemeRow): Scheme {
  return SchemeSchema.parse({ ...row, verifiedOn: row.verifiedOn?.toISOString().slice(0, 10) ?? null })
}

export async function loadSchemes(): Promise<Scheme[]> {
  const rows = await getPrisma().scheme.findMany({ orderBy: { id: 'asc' } })
  return rows.map(toScheme)
}
