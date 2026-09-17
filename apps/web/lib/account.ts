import { ProfileSchema } from '@saathi/core'
import { getPrisma, type Profile as ProfileRow } from '@saathi/db'
import type { Account, ClientProfile } from './api'
import type { SessionUser } from './session'

export function toClientProfile(row: ProfileRow & { runs?: { id: string }[] }): ClientProfile {
  return {
    id: row.id,
    label: row.label,
    profile: ProfileSchema.parse({
      age: row.age,
      gender: row.gender,
      state: row.state,
      annualIncome: row.annualIncome,
      category: row.category,
      occupation: row.occupation,
      landHectares: row.landHectares,
      isRural: row.isRural,
      hasDisability: row.hasDisability,
    }),
    latestRunId: row.runs?.[0]?.id ?? null,
  }
}

export async function loadAccount(user: SessionUser): Promise<Account> {
  const rows = await getPrisma().profile.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
    include: { runs: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true } } },
  })
  return { language: user.language, profiles: rows.map(toClientProfile) }
}

/** The profile, but only if it belongs to this user. Every write goes through here. */
export function findOwnedProfile(userId: string, profileId: string) {
  return getPrisma().profile.findFirst({ where: { id: profileId, userId } })
}
