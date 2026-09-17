import type { Profile, ProfileField } from './profile'
import type { Predicate, Scheme } from './schemes'

/**
 * The entire eligibility decision lives here: a pure function over structured
 * data, with no I/O and no model call. This is deliberate. An LLM that decides
 * whether someone qualifies for a welfare scheme can hallucinate a "no" at a
 * person who needed a "yes" — so the model never gets that job. It converts
 * speech into a Profile on the way in, and turns the verdict below into the
 * user's language on the way out. Nothing in between.
 */

export type Outcome = 'pass' | 'fail' | 'unknown'

export type Check = {
  predicate: Predicate
  outcome: Outcome
  /** The profile value tested, echoed back so the UI can explain the gap. */
  actual: string | number | boolean | null
}

export type MatchStatus = 'eligible' | 'needs_info' | 'near_miss' | 'ineligible'

export type Match = {
  scheme: Scheme
  status: MatchStatus
  checks: Check[]
  passed: Check[]
  failed: Check[]
  unknown: Check[]
  /** Fields we would need answered to firm up a `needs_info` verdict. */
  missingFields: ProfileField[]
}

function evaluate(p: Predicate, profile: Profile): Check {
  const actual = profile[p.field] as Check['actual']
  if (actual === null || actual === undefined) {
    return { predicate: p, outcome: 'unknown', actual: null }
  }

  let ok: boolean
  switch (p.field) {
    case 'age': {
      const v = actual as number
      ok = (p.min === undefined || v >= p.min) && (p.max === undefined || v <= p.max)
      break
    }
    case 'annualIncome':
      ok = (actual as number) <= p.max
      break
    case 'landHectares':
      ok = (actual as number) <= p.max
      break
    case 'state':
      ok = p.in.includes(actual as never)
      break
    case 'category':
      ok = p.in.includes(actual as never)
      break
    case 'occupation':
      ok = p.in.includes(actual as never)
      break
    case 'gender':
      ok = actual === p.eq
      break
    case 'isRural':
      ok = actual === p.eq
      break
    case 'hasDisability':
      ok = actual === p.eq
      break
    default: {
      // Exhaustiveness guard: adding a Predicate variant without handling it
      // here becomes a compile error rather than a silent `pass`.
      const never: never = p
      throw new Error(`unhandled predicate: ${JSON.stringify(never)}`)
    }
  }

  return { predicate: p, outcome: ok ? 'pass' : 'fail', actual }
}

export function matchScheme(scheme: Scheme, profile: Profile): Match {
  const checks = scheme.predicates.map((p) => evaluate(p, profile))
  const passed = checks.filter((c) => c.outcome === 'pass')
  const failed = checks.filter((c) => c.outcome === 'fail')
  const unknown = checks.filter((c) => c.outcome === 'unknown')

  // Failures decide the verdict before unknowns do: a confirmed disqualifier
  // is not softened by an unanswered question.
  let status: MatchStatus
  if (failed.length === 0) status = unknown.length === 0 ? 'eligible' : 'needs_info'
  else if (failed.length === 1 && NEAR_MISS_FIELDS.has(failed[0].predicate.field)) status = 'near_miss'
  else status = 'ineligible'

  return {
    scheme,
    status,
    checks,
    passed,
    failed,
    unknown,
    missingFields: unknown.map((c) => c.predicate.field),
  }
}

/**
 * Only a gap the person could re-check or that is genuinely borderline counts
 * as "near". A man is not one rule away from a maternity scheme, and a
 * 45-year-old cannot become 40 again, so those single failures are plain no's.
 */
const NEAR_MISS_FIELDS: ReadonlySet<ProfileField> = new Set(['annualIncome', 'landHectares'])

export const STATUS_RANK: Record<MatchStatus, number> = {
  eligible: 0, needs_info: 1, near_miss: 2, ineligible: 3,
}

export function matchAll(schemes: Scheme[], profile: Profile): Match[] {
  return schemes
    .map((s) => matchScheme(s, profile))
    .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.scheme.name.localeCompare(b.scheme.name))
}

/**
 * Which single unanswered question would unlock the most schemes? Drives the
 * follow-up prompt in chat, so we ask two useful questions instead of nine
 * bureaucratic ones.
 */
export function rankMissingFields(matches: Match[]): { field: ProfileField; unlocks: number }[] {
  const tally = new Map<ProfileField, number>()
  for (const m of matches) {
    if (m.status !== 'needs_info') continue
    for (const f of new Set(m.missingFields)) tally.set(f, (tally.get(f) ?? 0) + 1)
  }
  return [...tally.entries()]
    .map(([field, unlocks]) => ({ field, unlocks }))
    .sort((a, b) => b.unlocks - a.unlocks)
}
