import { describe, expect, it } from 'vitest'
import {
  EMPTY_PROFILE, SchemeSchema, matchAll, matchScheme, mergeProfile,
  rankMissingFields, type Profile, type Scheme,
} from '../src'
import rawSchemes from '../../../data/schemes.json'

// Core has no I/O, so the real catalogue comes in as a fixture. Parsing it
// through SchemeSchema means a malformed hand edit fails this suite.
const SCHEMES: Scheme[] = SchemeSchema.array().parse(rawSchemes)

function scheme(predicates: Scheme['predicates']): Scheme {
  return {
    id: 'test', name: 'Test Scheme', ministry: 'Test', benefit: 'Test benefit',
    benefitAmount: null, predicates, documents: [], applyUrl: '', sourceUrl: '',
    verifiedOn: null,
  }
}

function profile(overrides: Partial<Profile>): Profile {
  return { ...EMPTY_PROFILE, ...overrides }
}

describe('verdict derivation', () => {
  it('is eligible when every predicate passes', () => {
    const m = matchScheme(
      scheme([{ field: 'age', min: 18 }, { field: 'annualIncome', max: 200000 }]),
      profile({ age: 30, annualIncome: 150000 }),
    )
    expect(m.status).toBe('eligible')
    expect(m.passed).toHaveLength(2)
  })

  it('is near_miss on exactly one failure', () => {
    const m = matchScheme(
      scheme([{ field: 'age', min: 18 }, { field: 'annualIncome', max: 200000 }]),
      profile({ age: 30, annualIncome: 250000 }),
    )
    expect(m.status).toBe('near_miss')
    expect(m.failed).toHaveLength(1)
    // The UI leans on `actual` to say "you are 50,000 over the limit".
    expect(m.failed[0].actual).toBe(250000)
  })

  it('is ineligible on two or more failures', () => {
    const m = matchScheme(
      scheme([{ field: 'age', min: 18 }, { field: 'annualIncome', max: 200000 }]),
      profile({ age: 12, annualIncome: 250000 }),
    )
    expect(m.status).toBe('ineligible')
  })

  it('is needs_info when nothing failed but something is unanswered', () => {
    const m = matchScheme(
      scheme([{ field: 'age', min: 18 }, { field: 'annualIncome', max: 200000 }]),
      profile({ age: 30 }),
    )
    expect(m.status).toBe('needs_info')
    expect(m.missingFields).toEqual(['annualIncome'])
  })

  it('lets a confirmed failure outrank an open question', () => {
    // One hard fail plus one unknown must not soften into needs_info.
    const m = matchScheme(
      scheme([{ field: 'age', min: 18 }, { field: 'annualIncome', max: 200000 }]),
      profile({ annualIncome: 250000 }),
    )
    expect(m.status).toBe('near_miss')
  })

  it('treats a single failure on a fixed trait as ineligible, not near', () => {
    // A man must not be told he is "one rule away" from a maternity scheme.
    const s = scheme([{ field: 'gender', eq: 'female' }, { field: 'annualIncome', max: 800000 }])
    expect(matchScheme(s, profile({ gender: 'male', annualIncome: 150000 })).status).toBe('ineligible')
  })
})

describe('predicate evaluation', () => {
  it('treats age bounds as inclusive on both ends', () => {
    const s = scheme([{ field: 'age', min: 18, max: 40 }])
    expect(matchScheme(s, profile({ age: 18 })).status).toBe('eligible')
    expect(matchScheme(s, profile({ age: 40 })).status).toBe('eligible')
    expect(matchScheme(s, profile({ age: 41 })).status).toBe('ineligible')
  })

  it('treats an income ceiling as inclusive', () => {
    const s = scheme([{ field: 'annualIncome', max: 250000 }])
    expect(matchScheme(s, profile({ annualIncome: 250000 })).status).toBe('eligible')
    expect(matchScheme(s, profile({ annualIncome: 250001 })).status).toBe('near_miss')
  })

  it('does not confuse a false boolean with an unanswered one', () => {
    const s = scheme([{ field: 'isRural', eq: true }])
    expect(matchScheme(s, profile({ isRural: false })).status).toBe('ineligible')
    expect(matchScheme(s, profile({})).status).toBe('needs_info')
  })

  it('does not confuse a zero value with an unanswered one', () => {
    // A landless labourer reports 0 hectares. That is a pass, not a blank.
    const s = scheme([{ field: 'landHectares', max: 2 }])
    expect(matchScheme(s, profile({ landHectares: 0 })).status).toBe('eligible')
    expect(matchScheme(s, profile({})).status).toBe('needs_info')
  })

  it('matches set membership for category and occupation', () => {
    const s = scheme([{ field: 'category', in: ['sc', 'st'] }])
    expect(matchScheme(s, profile({ category: 'sc' })).status).toBe('eligible')
    expect(matchScheme(s, profile({ category: 'general' })).status).toBe('ineligible')
  })
})

describe('ranking and follow-up questions', () => {
  it('sorts eligible schemes ahead of ineligible ones', () => {
    const matches = matchAll(SCHEMES, profile({
      age: 30, gender: 'female', annualIncome: 150000, occupation: 'farmer',
      landHectares: 1, isRural: true, category: 'obc', state: 'MH', hasDisability: false,
    }))
    const ranks = matches.map((m) => m.status)
    const order = ['eligible', 'needs_info', 'near_miss', 'ineligible']
    const indices = ranks.map((r) => order.indexOf(r))
    expect(indices).toEqual([...indices].sort((a, b) => a - b))
  })

  it('surfaces the question that unblocks the most schemes first', () => {
    const matches = matchAll(SCHEMES, profile({ age: 30 }))
    const ranked = rankMissingFields(matches)
    expect(ranked.length).toBeGreaterThan(0)
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].unlocks).toBeGreaterThanOrEqual(ranked[i].unlocks)
    }
  })
})

describe('against the real dataset', () => {
  it('has unique scheme ids', () => {
    // Shape is already enforced by SchemeSchema.parse above; ids are the one
    // invariant the schema cannot see, and the DB upsert keys on them.
    expect(SCHEMES.length).toBeGreaterThan(0)
    expect(new Set(SCHEMES.map((s) => s.id)).size).toBe(SCHEMES.length)
  })

  it('rejects a predicate with an unknown field', () => {
    const bad = { ...SCHEMES[0], predicates: [{ field: 'caste', in: ['sc'] }] }
    expect(SchemeSchema.safeParse(bad).success).toBe(false)
  })

  it('matches a small farmer to PM-KISAN', () => {
    const matches = matchAll(SCHEMES, profile({
      age: 45, gender: 'male', occupation: 'farmer', landHectares: 0.8,
      annualIncome: 150000, isRural: true, category: 'obc', state: 'MH',
      hasDisability: false,
    }))
    const kisan = matches.find((m) => m.scheme.id === 'pm-kisan')
    expect(kisan?.status).toBe('eligible')
  })

  it('flags an over-the-limit applicant as a near miss, not a flat no', () => {
    const matches = matchAll(SCHEMES, profile({
      age: 45, gender: 'male', occupation: 'farmer', landHectares: 5,
      annualIncome: 150000, isRural: true, category: 'obc', state: 'MH',
      hasDisability: false,
    }))
    const kisan = matches.find((m) => m.scheme.id === 'pm-kisan')
    expect(kisan?.status).toBe('near_miss')
    expect(kisan?.failed[0].predicate.field).toBe('landHectares')
  })
})

describe('mergeProfile', () => {
  it('keeps known values when an extraction returns nulls', () => {
    const base = profile({ age: 30, state: 'MH' })
    const merged = mergeProfile(base, { age: null, annualIncome: 200000 })
    expect(merged.age).toBe(30)
    expect(merged.state).toBe('MH')
    expect(merged.annualIncome).toBe(200000)
  })

  it('lets a later answer correct an earlier one', () => {
    const merged = mergeProfile(profile({ age: 30 }), { age: 31 })
    expect(merged.age).toBe(31)
  })
})
