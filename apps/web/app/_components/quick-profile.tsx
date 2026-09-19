'use client'

import { useState } from 'react'
import {
  STATE_NAMES,
  type CATEGORIES,
  type GENDERS,
  type OCCUPATIONS,
  type Profile,
  type ProfileField,
} from '@saathi/core'
import { ACRE_IN_HECTARES, CATEGORY_LABELS, GENDER_LABELS, OCCUPATION_LABELS, round } from '@/lib/labels'
import type { Speaker } from '@/lib/speech'
import { SpeakButton } from './speak-button'

/**
 * Step-by-step questions for a new person: one question per screen, big tap
 * targets, skippable. Needs no AI at all, so results come straight from the
 * rules engine, instantly and without using AI quota. Shown in Hindi when the
 * user chose Hindi on the welcome screen, otherwise in English.
 */

type Lang = 'hi' | 'en'
type Option = { label: string; patch: Partial<Profile> }

const HI_OCCUPATION: Record<(typeof OCCUPATIONS)[number], string> = {
  farmer: 'किसान',
  student: 'छात्र / छात्रा',
  labourer: 'मज़दूर',
  self_employed: 'अपना काम / छोटा व्यापार',
  salaried: 'नौकरी (वेतन)',
  unemployed: 'काम की तलाश में',
  homemaker: 'घर का काम',
  other: 'अन्य',
}
const HI_GENDER: Record<(typeof GENDERS)[number], string> = { female: 'महिला', male: 'पुरुष', other: 'अन्य' }
const HI_CATEGORY: Record<(typeof CATEGORIES)[number], string> = {
  general: 'सामान्य',
  obc: 'ओबीसी (OBC)',
  sc: 'अनुसूचित जाति (SC)',
  st: 'अनुसूचित जनजाति (ST)',
  ews: 'ईडब्ल्यूएस (EWS)',
}

const UI = {
  en: {
    progress: (n: number, total: number) => `Question ${n} of ${total}`,
    next: 'Next',
    back: 'Back',
    skip: 'Skip',
    finish: 'See my schemes',
    notSay: 'Prefer not to say',
    instead: 'Type or speak instead',
    number: 'Please enter a number.',
  },
  hi: {
    progress: (n: number, total: number) => `सवाल ${n} / ${total}`,
    next: 'आगे',
    back: 'पीछे',
    skip: 'छोड़ें',
    finish: 'मेरी योजनाएँ देखें',
    notSay: 'नहीं बताना',
    instead: 'इसके बजाय लिखें या बोलें',
    number: 'कृपया एक संख्या लिखें।',
  },
}

type Step =
  | { field: ProfileField; kind: 'choice'; question: string; hint?: string; options: Option[] }
  | { field: 'age' | 'annualIncome' | 'landHectares'; kind: 'number'; question: string; hint?: string; unit: string; chips: Option[] }
  | { field: 'state'; kind: 'state'; question: string }

function buildSteps(lang: Lang): Step[] {
  const hi = lang === 'hi'
  const pick = <K extends string>(en: Record<K, string>, hiLabels: Record<K, string>, field: ProfileField) =>
    (Object.keys(en) as K[]).map((value) => ({
      label: hi ? hiLabels[value] : en[value],
      patch: { [field]: value } as Partial<Profile>,
    }))
  const money = (n: number, enLabel: string, hiLabel: string) => ({ label: hi ? hiLabel : enLabel, patch: { annualIncome: n } })

  return [
    {
      field: 'occupation',
      kind: 'choice',
      question: hi ? 'आप क्या काम करते हैं?' : 'I am a…',
      options: pick(OCCUPATION_LABELS, HI_OCCUPATION, 'occupation'),
    },
    {
      field: 'age',
      kind: 'number',
      question: hi ? 'आपकी उम्र कितनी है?' : 'How old are you?',
      unit: hi ? 'साल' : 'years',
      chips: [],
    },
    {
      field: 'gender',
      kind: 'choice',
      question: hi ? 'आप महिला हैं या पुरुष?' : 'Are you a woman or a man?',
      options: pick(GENDER_LABELS, HI_GENDER, 'gender'),
    },
    { field: 'state', kind: 'state', question: hi ? 'आप किस राज्य में रहते हैं?' : 'Which state do you live in?' },
    {
      field: 'isRural',
      kind: 'choice',
      question: hi ? 'आप गाँव में रहते हैं या शहर में?' : 'Do you live in a village or a town?',
      options: [
        { label: hi ? 'गाँव' : 'Village', patch: { isRural: true } },
        { label: hi ? 'कस्बा या शहर' : 'Town or city', patch: { isRural: false } },
      ],
    },
    {
      field: 'annualIncome',
      kind: 'number',
      question: hi ? 'आपके पूरे परिवार की साल भर की कमाई कितनी है?' : "What is your whole family's income in a year?",
      hint: hi ? 'अंदाज़ा भी चलेगा।' : 'A rough guess is fine.',
      unit: '₹',
      chips: [
        money(50_000, '₹50,000', '₹50 हज़ार'),
        money(100_000, '₹1 lakh', '₹1 लाख'),
        money(150_000, '₹1.5 lakh', '₹1.5 लाख'),
        money(200_000, '₹2 lakh', '₹2 लाख'),
        money(300_000, '₹3 lakh', '₹3 लाख'),
        money(500_000, '₹5 lakh', '₹5 लाख'),
      ],
    },
    {
      field: 'landHectares',
      kind: 'number',
      question: hi ? 'आपके पास कितनी ज़मीन है?' : 'How much land do you own?',
      unit: hi ? 'एकड़' : 'acres',
      chips: [{ label: hi ? 'ज़मीन नहीं है' : 'No land', patch: { landHectares: 0 } }],
    },
    {
      field: 'category',
      kind: 'choice',
      question: hi ? 'आपकी श्रेणी क्या है?' : 'Which category do you belong to?',
      hint: hi ? 'कुछ योजनाएँ इस पर निर्भर करती हैं। बताना ज़रूरी नहीं है।' : 'Some schemes depend on this. You can skip it.',
      options: pick(CATEGORY_LABELS, HI_CATEGORY, 'category'),
    },
    {
      field: 'hasDisability',
      kind: 'choice',
      question: hi ? 'क्या आपको कोई विकलांगता है?' : 'Do you have a disability?',
      options: [
        { label: hi ? 'हाँ' : 'Yes', patch: { hasDisability: true } },
        { label: hi ? 'नहीं' : 'No', patch: { hasDisability: false } },
      ],
    },
  ]
}

export function QuickProfile({
  initial,
  lang,
  speaker,
  onDone,
  onSkip,
}: {
  initial: Profile
  lang: Lang
  speaker: Speaker
  onDone: (profile: Profile) => void
  onSkip: () => void
}) {
  const t = UI[lang]
  const [draft, setDraft] = useState<Profile>(initial)
  const [index, setIndex] = useState(0)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Only ask what we don't know yet, and land only for farmers.
  const steps = buildSteps(lang).filter(
    (s) => initial[s.field] === null && (s.field !== 'landHectares' || draft.occupation === 'farmer'),
  )
  const step = steps[index]

  function go(next: Profile, to: number) {
    speaker.stopAll()
    setDraft(next)
    setText('')
    setError(null)
    if (to >= steps.length) onDone(next)
    else setIndex(Math.max(0, to))
  }
  const answer = (patch: Partial<Profile>) => go({ ...draft, ...patch }, index + 1)

  function submitNumber() {
    if (!step || step.kind !== 'number') return
    const n = Number(text.replace(/[,\s₹]/g, ''))
    if (text.trim() === '' || !Number.isFinite(n) || n < 0 || (step.field === 'age' && n > 120)) {
      setError(t.number)
      return
    }
    if (step.field === 'landHectares') answer({ landHectares: round(n * ACRE_IN_HECTARES) })
    else answer({ [step.field]: Math.round(n) } as Partial<Profile>)
  }

  // Everything was already known: nothing to ask.
  if (!step) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5">
        <button
          type="button"
          onClick={() => onDone(draft)}
          className="rounded-xl bg-accent px-5 py-3 text-lg font-semibold text-accent-foreground"
        >
          {t.finish}
        </button>
      </div>
    )
  }

  const choice = 'rounded-xl border border-border bg-background px-4 py-3 text-left text-base hover:border-accent'
  const isLast = index === steps.length - 1

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5" lang={lang} aria-labelledby="question">
      <div>
        <p className="text-sm text-muted">{t.progress(index + 1, steps.length)}</p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border" aria-hidden>
          <div className="h-full bg-accent transition-all" style={{ width: `${((index + 1) / steps.length) * 100}%` }} />
        </div>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 id="question" className="text-2xl font-bold leading-snug">{step.question}</h2>
        <SpeakButton id={`question-${step.field}`} text={step.question} lang={lang} speaker={speaker} />
      </div>
      {'hint' in step && step.hint && <p className="-mt-2 text-muted">{step.hint}</p>}

      {step.kind === 'choice' && (
        <div className="grid gap-2 sm:grid-cols-2">
          {step.options.map((o) => (
            <button key={o.label} type="button" onClick={() => answer(o.patch)} className={choice}>
              {o.label}
            </button>
          ))}
          {(step.field === 'gender' || step.field === 'category' || step.field === 'hasDisability') && (
            <button type="button" onClick={() => answer({})} className={`${choice} text-muted`}>
              {t.notSay}
            </button>
          )}
        </div>
      )}

      {step.kind === 'number' && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submitNumber()
          }}
          className="flex flex-col gap-3"
        >
          {step.chips.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {step.chips.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => answer(c.patch)}
                  className="rounded-full border border-border bg-background px-4 py-2 hover:border-accent"
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            {step.unit === '₹' && <span className="text-xl font-semibold">₹</span>}
            <label htmlFor="number-answer" className="sr-only">{step.question}</label>
            <input
              id="number-answer"
              value={text}
              onChange={(e) => setText(e.target.value)}
              inputMode={step.field === 'landHectares' ? 'decimal' : 'numeric'}
              className="w-40 rounded-xl border border-border bg-background px-4 py-3 text-xl"
            />
            {step.unit !== '₹' && <span className="text-lg">{step.unit}</span>}
            <button type="submit" className="ml-auto rounded-xl bg-accent px-5 py-3 font-semibold text-accent-foreground">
              {isLast ? t.finish : t.next}
            </button>
          </div>
          {error && <p role="alert" className="text-danger">{error}</p>}
        </form>
      )}

      {step.kind === 'state' && (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="state-answer" className="sr-only">{step.question}</label>
          <select
            id="state-answer"
            defaultValue=""
            onChange={(e) => e.target.value && answer({ state: e.target.value as Profile['state'] })}
            className="min-w-60 rounded-xl border border-border bg-background px-4 py-3 text-lg"
          >
            <option value="" disabled>{lang === 'hi' ? 'राज्य चुनें' : 'Choose your state'}</option>
            {Object.entries(STATE_NAMES)
              .sort(([, a], [, b]) => a.localeCompare(b))
              .map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 text-sm">
        <div className="flex gap-2">
          {index > 0 && (
            <button type="button" onClick={() => go(draft, index - 1)} className="rounded-lg border border-border px-4 py-2">
              {t.back}
            </button>
          )}
          <button type="button" onClick={() => go(draft, index + 1)} className="rounded-lg border border-border px-4 py-2">
            {isLast ? t.finish : t.skip}
          </button>
        </div>
        <button type="button" onClick={onSkip} className="text-accent underline">
          {t.instead}
        </button>
      </div>
    </section>
  )
}
