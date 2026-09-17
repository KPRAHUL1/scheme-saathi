import { z } from 'zod'

/**
 * Every field is nullable. `null` means "we haven't asked yet" — it is NOT
 * the same as a failed check. The eligibility engine treats null as `unknown`
 * and surfaces it as a follow-up question instead of a rejection.
 */

export const STATES = [
  'AN', 'AP', 'AR', 'AS', 'BR', 'CH', 'CT', 'DD', 'DL', 'GA', 'GJ', 'HP',
  'HR', 'JH', 'JK', 'KA', 'KL', 'LA', 'LD', 'MH', 'ML', 'MN', 'MP', 'MZ',
  'NL', 'OR', 'PB', 'PY', 'RJ', 'SK', 'TG', 'TN', 'TR', 'UP', 'UT', 'WB',
] as const

export const STATE_NAMES: Record<(typeof STATES)[number], string> = {
  AN: 'Andaman & Nicobar', AP: 'Andhra Pradesh', AR: 'Arunachal Pradesh',
  AS: 'Assam', BR: 'Bihar', CH: 'Chandigarh', CT: 'Chhattisgarh',
  DD: 'Dadra & Nagar Haveli and Daman & Diu', DL: 'Delhi', GA: 'Goa',
  GJ: 'Gujarat', HP: 'Himachal Pradesh', HR: 'Haryana', JH: 'Jharkhand',
  JK: 'Jammu & Kashmir', KA: 'Karnataka', KL: 'Kerala', LA: 'Ladakh',
  LD: 'Lakshadweep', MH: 'Maharashtra', ML: 'Meghalaya', MN: 'Manipur',
  MP: 'Madhya Pradesh', MZ: 'Mizoram', NL: 'Nagaland', OR: 'Odisha',
  PB: 'Punjab', PY: 'Puducherry', RJ: 'Rajasthan', SK: 'Sikkim',
  TG: 'Telangana', TN: 'Tamil Nadu', TR: 'Tripura', UP: 'Uttar Pradesh',
  UT: 'Uttarakhand', WB: 'West Bengal',
}

export const CATEGORIES = ['general', 'obc', 'sc', 'st', 'ews'] as const
export const GENDERS = ['female', 'male', 'other'] as const
export const OCCUPATIONS = [
  'farmer', 'student', 'labourer', 'self_employed',
  'salaried', 'unemployed', 'homemaker', 'other',
] as const

export const ProfileSchema = z.object({
  age: z.number().int().min(0).max(120).nullable(),
  gender: z.enum(GENDERS).nullable(),
  state: z.enum(STATES).nullable(),
  annualIncome: z.number().min(0).nullable(),
  category: z.enum(CATEGORIES).nullable(),
  occupation: z.enum(OCCUPATIONS).nullable(),
  landHectares: z.number().min(0).nullable(),
  isRural: z.boolean().nullable(),
  hasDisability: z.boolean().nullable(),
})

export type Profile = z.infer<typeof ProfileSchema>
export type ProfileField = keyof Profile

export const EMPTY_PROFILE: Profile = {
  age: null, gender: null, state: null, annualIncome: null, category: null,
  occupation: null, landHectares: null, isRural: null, hasDisability: null,
}

/** Merge newly extracted facts over what we already know, ignoring nulls. */
export function mergeProfile(base: Profile, incoming: Partial<Profile>): Profile {
  const out = { ...base }
  for (const [k, v] of Object.entries(incoming)) {
    if (v !== null && v !== undefined) out[k as ProfileField] = v as never
  }
  return out
}
