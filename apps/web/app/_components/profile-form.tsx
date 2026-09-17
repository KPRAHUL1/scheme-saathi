'use client'

import { useState } from 'react'
import { STATE_NAMES, type Profile } from '@saathi/core'
import {
  ACRE_IN_HECTARES, CATEGORY_LABELS, FIELD_LABELS, GENDER_LABELS, OCCUPATION_LABELS, round,
} from '@/lib/labels'

/**
 * The no-AI path. Always works, even with no network to Gemini, and doubles
 * as the "edit what we understood" screen.
 */
export function ProfileForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial: Profile
  onSubmit: (profile: Profile) => void
  onCancel?: () => void
}) {
  // Form fields are strings; "" means "not answered" and becomes null.
  const [v, setV] = useState(() => ({
    age: initial.age?.toString() ?? '',
    gender: initial.gender ?? '',
    state: initial.state ?? '',
    annualIncome: initial.annualIncome?.toString() ?? '',
    category: initial.category ?? '',
    occupation: initial.occupation ?? '',
    landAcres: initial.landHectares === null ? '' : String(round(initial.landHectares / ACRE_IN_HECTARES)),
    isRural: initial.isRural === null ? '' : String(initial.isRural),
    hasDisability: initial.hasDisability === null ? '' : String(initial.hasDisability),
  }))

  const set = (key: keyof typeof v) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [key]: e.target.value })

  const num = (s: string) => (s.trim() === '' ? null : Number(s))
  const bool = (s: string) => (s === '' ? null : s === 'true')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const acres = num(v.landAcres)
    onSubmit({
      age: num(v.age),
      gender: (v.gender || null) as Profile['gender'],
      state: (v.state || null) as Profile['state'],
      annualIncome: num(v.annualIncome),
      category: (v.category || null) as Profile['category'],
      occupation: (v.occupation || null) as Profile['occupation'],
      landHectares: acres === null ? null : round(acres * ACRE_IN_HECTARES),
      isRural: bool(v.isRural),
      hasDisability: bool(v.hasDisability),
    })
  }

  const field = 'flex flex-col gap-1 text-sm'
  const input =
    'rounded-lg border border-border bg-surface px-3 py-2 text-base text-foreground focus:outline-2 focus:outline-accent'

  return (
    <form onSubmit={submit} className="grid gap-4 rounded-2xl border border-border bg-surface p-5 sm:grid-cols-2">
      <p className="text-sm text-muted sm:col-span-2">
        Leave anything you&apos;re unsure about blank. We&apos;ll only ask what matters.
      </p>

      <label className={field}>
        {FIELD_LABELS.age}
        <input className={input} type="number" inputMode="numeric" min={0} max={120} value={v.age} onChange={set('age')} />
      </label>

      <label className={field}>
        {FIELD_LABELS.gender}
        <select className={input} value={v.gender} onChange={set('gender')}>
          <option value="">Prefer not to say</option>
          {Object.entries(GENDER_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </label>

      <label className={field}>
        {FIELD_LABELS.state}
        <select className={input} value={v.state} onChange={set('state')}>
          <option value="">Select state</option>
          {Object.entries(STATE_NAMES)
            .sort(([, a], [, b]) => a.localeCompare(b))
            .map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </label>

      <label className={field}>
        {FIELD_LABELS.isRural}
        <select className={input} value={v.isRural} onChange={set('isRural')}>
          <option value="">Select</option>
          <option value="true">Village</option>
          <option value="false">Town or city</option>
        </select>
      </label>

      <label className={field}>
        {FIELD_LABELS.annualIncome} (₹)
        <input className={input} type="number" inputMode="numeric" min={0} step={1000} value={v.annualIncome} onChange={set('annualIncome')} />
      </label>

      <label className={field}>
        {FIELD_LABELS.occupation}
        <select className={input} value={v.occupation} onChange={set('occupation')}>
          <option value="">Select</option>
          {Object.entries(OCCUPATION_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </label>

      <label className={field}>
        {FIELD_LABELS.landHectares} (acres)
        <input className={input} type="number" inputMode="decimal" min={0} step={0.1} value={v.landAcres} onChange={set('landAcres')} />
      </label>

      <label className={field}>
        {FIELD_LABELS.category}
        <select className={input} value={v.category} onChange={set('category')}>
          <option value="">Prefer not to say</option>
          {Object.entries(CATEGORY_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </label>

      <label className={field}>
        {FIELD_LABELS.hasDisability}
        <select className={input} value={v.hasDisability} onChange={set('hasDisability')}>
          <option value="">Prefer not to say</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      </label>

      <div className="flex gap-3 sm:col-span-2">
        <button type="submit" className="rounded-lg bg-accent px-5 py-2.5 font-medium text-accent-foreground hover:opacity-90">
          Check schemes
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded-lg border border-border px-5 py-2.5 hover:bg-background">
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
