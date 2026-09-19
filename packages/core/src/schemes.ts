import { z } from 'zod'
import { CATEGORIES, GENDERS, OCCUPATIONS, STATES } from './profile'

/**
 * A predicate is plain data, never prose. The engine evaluates it; the LLM
 * only ever renders the already-decided result into the user's language.
 * Keeping these free of display strings is what makes the rules auditable
 * and translatable at the same time.
 *
 * The zod schema is the single source of truth: the TS type is inferred from
 * it, and the seed script validates every hand-edited scheme against it before
 * anything reaches the database.
 */
export const PredicateSchema = z.discriminatedUnion('field', [
  z.object({
    field: z.literal('age'),
    min: z.number().int().min(0).optional(),
    max: z.number().int().min(0).optional(),
  }),
  z.object({ field: z.literal('annualIncome'), max: z.number().min(0) }),
  z.object({ field: z.literal('state'), in: z.array(z.enum(STATES)).min(1) }),
  z.object({ field: z.literal('category'), in: z.array(z.enum(CATEGORIES)).min(1) }),
  z.object({ field: z.literal('occupation'), in: z.array(z.enum(OCCUPATIONS)).min(1) }),
  z.object({ field: z.literal('gender'), eq: z.enum(GENDERS) }),
  z.object({ field: z.literal('landHectares'), max: z.number().min(0) }),
  z.object({ field: z.literal('isRural'), eq: z.boolean() }),
  z.object({ field: z.literal('hasDisability'), eq: z.boolean() }),
])

export type Predicate = z.infer<typeof PredicateSchema>

/**
 * How a person actually gets the benefit. Several big schemes have no form at
 * all ("list_based": households are picked from government survey lists), so
 * the app must never imply that downloading a form is always the way in.
 */
export const APPLY_METHODS = ['online', 'csc', 'bank', 'post_office', 'office', 'list_based'] as const

export const SchemeSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, 'lowercase letters, digits and hyphens only'),
  name: z.string().min(1),
  ministry: z.string().min(1),
  /** What the applicant actually receives, in plain words. */
  benefit: z.string().min(1),
  /** Headline figure for the result card, e.g. "₹6,000 per year". */
  benefitAmount: z.string().nullable(),
  predicates: z.array(PredicateSchema).min(1),
  documents: z.array(z.string()),
  applyUrl: z.url(),
  sourceUrl: z.url(),
  applyMethod: z.enum(APPLY_METHODS),
  /** Plain-English steps to apply; the AI translates them for the user. */
  applySteps: z.string().min(1),
  /**
   * Official downloadable forms. Only links checked to return a real PDF from
   * a government site. Empty when the scheme has no form (online or list-based).
   */
  forms: z.array(z.object({ label: z.string().min(1), url: z.url() })),
  /**
   * ISO date a human checked this entry against the official portal.
   * null means UNVERIFIED — the UI must badge it as such. We would rather
   * show a caveat than imply false precision about someone's benefits.
   */
  verifiedOn: z.iso.date().nullable(),
})

export type Scheme = z.infer<typeof SchemeSchema>
