import {
  STATE_NAMES,
  type CATEGORIES,
  type Check,
  type GENDERS,
  type OCCUPATIONS,
  type Profile,
  type ProfileField,
} from '@saathi/core'

/**
 * English UI text. Scheme explanations are translated by the AI; these labels
 * are what shows instantly, before (or without) that translation.
 */

export const ACRE_IN_HECTARES = 0.4047

const inrFormat = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})
export const inr = (n: number) => inrFormat.format(n)

export const FIELD_LABELS: Record<ProfileField, string> = {
  age: 'Age',
  gender: 'Gender',
  state: 'State',
  annualIncome: 'Yearly family income',
  category: 'Category',
  occupation: 'Work',
  landHectares: 'Land owned',
  isRural: 'Lives in',
  hasDisability: 'Disability',
}

export const GENDER_LABELS: Record<(typeof GENDERS)[number], string> = {
  female: 'Female',
  male: 'Male',
  other: 'Other',
}

export const CATEGORY_LABELS: Record<(typeof CATEGORIES)[number], string> = {
  general: 'General',
  obc: 'OBC',
  sc: 'SC',
  st: 'ST',
  ews: 'EWS',
}

export const OCCUPATION_LABELS: Record<(typeof OCCUPATIONS)[number], string> = {
  farmer: 'Farmer',
  student: 'Student',
  labourer: 'Labourer',
  self_employed: 'Self-employed',
  salaried: 'Salaried job',
  unemployed: 'Looking for work',
  homemaker: 'Homemaker',
  other: 'Other',
}

export const QUESTIONS: Record<ProfileField, string> = {
  age: 'How old are you?',
  gender: 'What is your gender?',
  state: 'Which state do you live in?',
  annualIncome: "What is your family's total income in a year?",
  category: 'Which category do you belong to?',
  occupation: 'What work do you do?',
  landHectares: 'How much land do you own? Say 0 if none.',
  isRural: 'Do you live in a village, or in a town or city?',
  hasDisability: 'Do you have a disability?',
}

type QuickReply = { label: string; patch: Partial<Profile> }

/** One-tap answers for fields with a short, fixed set of options. */
export function quickReplies(field: ProfileField): QuickReply[] | null {
  const from = <K extends string>(labels: Record<K, string>, key: 'gender' | 'category' | 'occupation') =>
    (Object.entries(labels) as [K, string][]).map(([value, label]) => ({
      label,
      patch: { [key]: value } as Partial<Profile>,
    }))

  switch (field) {
    case 'gender':
      return from(GENDER_LABELS, 'gender')
    case 'category':
      return from(CATEGORY_LABELS, 'category')
    case 'occupation':
      return from(OCCUPATION_LABELS, 'occupation')
    case 'isRural':
      return [
        { label: 'Village', patch: { isRural: true } },
        { label: 'Town or city', patch: { isRural: false } },
      ]
    case 'hasDisability':
      return [
        { label: 'Yes', patch: { hasDisability: true } },
        { label: 'No', patch: { hasDisability: false } },
      ]
    default:
      return null
  }
}

export function formatValue(field: ProfileField, value: string | number | boolean): string {
  switch (field) {
    case 'annualIncome':
      return inr(value as number)
    case 'landHectares':
      return `${round((value as number) / ACRE_IN_HECTARES)} acres`
    case 'age':
      return `${value} years`
    case 'state':
      return STATE_NAMES[value as keyof typeof STATE_NAMES]
    case 'gender':
      return GENDER_LABELS[value as keyof typeof GENDER_LABELS]
    case 'category':
      return CATEGORY_LABELS[value as keyof typeof CATEGORY_LABELS]
    case 'occupation':
      return OCCUPATION_LABELS[value as keyof typeof OCCUPATION_LABELS]
    case 'isRural':
      return value ? 'Village' : 'Town or city'
    case 'hasDisability':
      return value ? 'Yes' : 'No'
    default:
      return String(value)
  }
}

export const round = (n: number) => Math.round(n * 100) / 100

const list = (items: string[]) => items.join(', ')

/** Plain-English reason for a failed rule, straight from the engine's data. */
export function describeCheck(check: Check): string {
  const p = check.predicate
  const a = check.actual
  switch (p.field) {
    case 'annualIncome':
      return `Income limit is ${inr(p.max)}. Yours is ${inr(a as number)}.`
    case 'landHectares':
      return `Land limit is ${round(p.max / ACRE_IN_HECTARES)} acres. You have ${round((a as number) / ACRE_IN_HECTARES)}.`
    case 'age': {
      const range =
        p.min !== undefined && p.max !== undefined ? `between ${p.min} and ${p.max}`
        : p.min !== undefined ? `${p.min} or older`
        : `${p.max} or younger`
      return `Age must be ${range}. You are ${a}.`
    }
    case 'state':
      return `Only for ${list(p.in.map((s) => STATE_NAMES[s]))}.`
    case 'category':
      return `Only for ${list(p.in.map((c) => CATEGORY_LABELS[c]))} applicants.`
    case 'occupation':
      return `Only for ${list(p.in.map((o) => OCCUPATION_LABELS[o].toLowerCase()))}.`
    case 'gender':
      return `Only for ${GENDER_LABELS[p.eq].toLowerCase()} applicants.`
    case 'isRural':
      return p.eq ? 'Only for people living in villages.' : 'Only for people living in towns and cities.'
    case 'hasDisability':
      return p.eq ? 'Only for people with a disability.' : 'Not for people with a disability.'
  }
}
