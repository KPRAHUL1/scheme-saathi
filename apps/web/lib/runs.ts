import { rankMissingFields, STATUS_RANK, type Check, type Match } from '@saathi/core'
import { getPrisma } from '@saathi/db'
import type { ExplainResponse, MatchItem, MatchResponse } from './api'
import { toScheme } from './catalogue'

export function toMatchResponse(runId: string, language: string, matches: Match[]): MatchResponse {
  return {
    runId,
    language,
    matches: matches.map((m): MatchItem => ({
      scheme: m.scheme,
      status: m.status,
      failed: m.failed,
      missingFields: m.missingFields,
    })),
    nextQuestions: rankMissingFields(matches).slice(0, 3),
  }
}

/**
 * A stored run, but only if it belongs to this user. Ownership is checked in
 * the query itself (run -> profile -> user), so there is no code path that
 * loads someone else's decision and forgets to check afterwards.
 */
export function findOwnedRun(userId: string, runId: string) {
  return getPrisma().matchRun.findFirst({
    where: { id: runId, profile: { userId } },
    include: { profile: { select: { label: true } }, results: { include: { scheme: true } } },
  })
}

type OwnedRun = NonNullable<Awaited<ReturnType<typeof findOwnedRun>>>

/** Rebuilds exactly what /api/match returned, from the audit log. */
export function runToMatchResponse(run: OwnedRun): MatchResponse {
  const matches = run.results
    .map((r): Match => {
      const checks = r.checks as unknown as Check[]
      const unknown = checks.filter((c) => c.outcome === 'unknown')
      return {
        scheme: toScheme(r.scheme),
        status: r.status,
        checks,
        passed: checks.filter((c) => c.outcome === 'pass'),
        failed: checks.filter((c) => c.outcome === 'fail'),
        unknown,
        missingFields: unknown.map((c) => c.predicate.field),
      }
    })
    .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.scheme.name.localeCompare(b.scheme.name))
  return toMatchResponse(run.id, run.language, matches)
}

/** The saved explanation, if one exists for this language. Costs no AI call. */
export function savedExplanation(run: OwnedRun, language: string): ExplainResponse | null {
  if (!run.explanation || run.explanationLanguage !== language) return null
  return run.explanation as unknown as ExplainResponse
}
