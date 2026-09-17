'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { VOICE_LANGUAGES } from '@/lib/speech'

// The welcome screen is the one place every visitor must read, so it is shown
// in their chosen language. Hindi is translated; others fall back to English.
const COPY = {
  en: {
    language: 'Choose your language',
    who: 'Who are you checking schemes for?',
    consent: 'Before you start',
    stores: 'To find schemes, we save the details you share: age, gender, state, income, category, work, land and disability.',
    points: [
      'Saved securely and linked only to this device. No name or phone number needed.',
      "What you type or say is sent to Google's Gemini AI to understand it and explain your results.",
      'Never sold. Remove everything at any time with "Delete my data".',
    ],
    agree: 'I agree, continue',
    starting: 'Starting…',
    error: "Couldn't start. Please check your internet connection and try again.",
  },
  hi: {
    language: 'अपनी भाषा चुनें',
    who: 'आप किसके लिए योजनाएँ देख रहे हैं?',
    consent: 'शुरू करने से पहले',
    stores: 'योजनाएँ खोजने के लिए हम आपकी दी हुई जानकारी सहेजते हैं: उम्र, लिंग, राज्य, आय, श्रेणी, काम, ज़मीन और विकलांगता।',
    points: [
      'जानकारी सुरक्षित रहती है और सिर्फ़ इसी डिवाइस से जुड़ी होती है। नाम या फ़ोन नंबर की ज़रूरत नहीं।',
      'आप जो लिखते या बोलते हैं, उसे समझने और नतीजे समझाने के लिए Google के Gemini AI को भेजा जाता है।',
      'जानकारी कभी बेची नहीं जाती। "Delete my data" बटन से कभी भी सब कुछ मिटा सकते हैं।',
    ],
    agree: 'मैं सहमत हूँ, आगे बढ़ें',
    starting: 'शुरू हो रहा है…',
    error: 'शुरू नहीं हो सका। इंटरनेट कनेक्शन जाँचें और फिर कोशिश करें।',
  },
}

const WHO = [
  { value: 'Me', en: 'Myself', hi: 'अपने लिए' },
  { value: 'Mother', en: 'My mother', hi: 'मेरी माँ' },
  { value: 'Father', en: 'My father', hi: 'मेरे पिता' },
  { value: 'Spouse', en: 'My husband or wife', hi: 'पति या पत्नी' },
  { value: 'Family member', en: 'Someone else in my family', hi: 'परिवार का कोई और' },
] as const

export function Welcome() {
  const router = useRouter()
  const [language, setLanguage] = useState<string | null>(null)
  const [who, setWho] = useState<(typeof WHO)[number]['value']>('Me')
  const [status, setStatus] = useState<'idle' | 'starting' | 'error'>('idle')

  const lang = language === 'hi' ? 'hi' : 'en'
  const t = COPY[lang]

  async function start() {
    if (!language) return
    setStatus('starting')
    try {
      await api.startSession(language, who)
      // The page reads the new session cookie on the server and shows the app.
      router.refresh()
    } catch {
      setStatus('error')
    }
  }

  const section = 'flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5'
  const step = 'flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground'
  const choice = (selected: boolean) =>
    `rounded-xl border px-4 py-3 text-left text-base ${
      selected ? 'border-accent bg-eligible-bg font-semibold' : 'border-border bg-background hover:border-accent'
    }`

  return (
    <div className="flex flex-col gap-5" lang={lang}>
      <section className={section} aria-labelledby="step-language">
        <h2 id="step-language" className="flex items-center gap-3 text-lg font-semibold">
          <span className={step}>1</span>
          {t.language}
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-labelledby="step-language">
          {VOICE_LANGUAGES.map((l) => {
            const code = l.code.split('-')[0]
            return (
              <button
                key={l.code}
                type="button"
                role="radio"
                aria-checked={language === code}
                lang={code}
                onClick={() => setLanguage(code)}
                className={choice(language === code)}
              >
                {l.label}
              </button>
            )
          })}
        </div>
      </section>

      <section className={section} aria-labelledby="step-who">
        <h2 id="step-who" className="flex items-center gap-3 text-lg font-semibold">
          <span className={step}>2</span>
          {t.who}
        </h2>
        <div className="flex flex-col gap-2" role="radiogroup" aria-labelledby="step-who">
          {WHO.map((w) => (
            <button
              key={w.value}
              type="button"
              role="radio"
              aria-checked={who === w.value}
              onClick={() => setWho(w.value)}
              className={choice(who === w.value)}
            >
              {w[lang]}
            </button>
          ))}
        </div>
      </section>

      <section className={section} aria-labelledby="step-consent">
        <h2 id="step-consent" className="flex items-center gap-3 text-lg font-semibold">
          <span className={step}>3</span>
          {t.consent}
        </h2>
        <p className="leading-relaxed">{t.stores}</p>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-muted">
          {t.points.map((p) => <li key={p}>{p}</li>)}
        </ul>
        <button
          type="button"
          onClick={() => void start()}
          disabled={!language || status === 'starting'}
          className="mt-2 rounded-xl bg-accent px-5 py-3.5 text-lg font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-50"
        >
          {status === 'starting' ? t.starting : t.agree}
        </button>
        {status === 'error' && <p role="alert" className="text-danger">{t.error}</p>}
      </section>
    </div>
  )
}
