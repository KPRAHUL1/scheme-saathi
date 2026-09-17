'use client'

import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { EMPTY_PROFILE, mergeProfile, type Profile, type ProfileField } from '@saathi/core'
import {
  api, ApiError, type Account, type ClientProfile, type ExplainResponse, type MatchItem, type MatchResponse,
} from '@/lib/api'
import { describeCheck, FIELD_LABELS, formatValue, QUESTIONS, quickReplies } from '@/lib/labels'
import { useRecorder } from '@/lib/recorder'
import { useSpeaker, type Speaker } from '@/lib/speech'
import { DownloadIcon, MicIcon } from './icons'
import { ProfileForm } from './profile-form'
import { ProgressSteps, type Step, type StepState } from './progress-steps'
import { ResultCard } from './result-card'
import { SpeakButton } from './speak-button'

const EXAMPLES = [
  {
    label: 'हिंदी · Farmer',
    text: 'मैं महाराष्ट्र के एक गाँव में रहने वाला 45 साल का किसान हूँ। मेरे पास 2 एकड़ ज़मीन है और सालाना आमदनी करीब 1.5 लाख है।',
  },
  {
    label: 'English · Student',
    text: "I'm a 20 year old SC student from Bihar. My family earns about 2 lakh a year.",
  },
  {
    label: 'தமிழ் · Woman',
    text: 'நான் தமிழ்நாட்டில் ஒரு கிராமத்தில் வசிக்கும் 30 வயது பெண். எங்கள் குடும்ப வருமானம் ஆண்டுக்கு 1.2 லட்சம்.',
  },
]

// Only ever called from event handlers, never during render.
const timestamp = () => Date.now()

type StepId = 'understand' | 'check' | 'explain'
type Progress = { steps: Record<StepId, StepState>; activeSince: number; language: string }

const languageName = (code: string) => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) ?? code
  } catch {
    return code
  }
}

export type InitialState = {
  account: Account
  activeProfileId: string
  result: MatchResponse | null
  explanation: ExplainResponse | null
  resultLanguage: string
}

const explainingStep = (language: string): Progress => ({
  steps: { understand: 'skipped', check: 'skipped', explain: 'active' },
  activeSince: timestamp(),
  language,
})

export function Saathi({ initial }: { initial: InitialState }) {
  const router = useRouter()
  const [profiles, setProfiles] = useState<ClientProfile[]>(initial.account.profiles)
  const [activeId, setActiveId] = useState(initial.activeProfileId)
  const [profile, setProfile] = useState<Profile>(
    () => initial.account.profiles.find((p) => p.id === initial.activeProfileId)?.profile ?? EMPTY_PROFILE,
  )
  const [language, setLanguage] = useState(initial.resultLanguage)
  const [input, setInput] = useState('')
  const [lastMessage, setLastMessage] = useState<string | null>(null)
  // A restored result with no saved explanation starts explaining on mount.
  const [progress, setProgress] = useState<Progress | null>(() =>
    initial.result && !initial.explanation ? explainingStep(initial.resultLanguage) : null,
  )
  const [notice, setNotice] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [result, setResult] = useState<MatchResponse | null>(initial.result)
  const [explanation, setExplanation] = useState<ExplainResponse | null>(initial.explanation)
  const [explainFailed, setExplainFailed] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  // The newest run. A slow explanation for an older run must not overwrite it.
  const currentRun = useRef<string | null>(initial.result?.runId ?? null)
  // Bumped on every profile switch, so a slow load for the previous person is dropped.
  const viewSeq = useRef(0)
  const restoreStarted = useRef(false)

  const recorder = useRecorder((audio) => void understand({ audio }, null))
  const speaker = useSpeaker()

  const busy = progress?.steps.understand === 'active' || progress?.steps.check === 'active'
  const explaining = progress?.steps.explain === 'active'

  const explainRestored = useEffectEvent(() => {
    // Guarded because React runs mount effects twice in development, and each
    // explanation costs scarce AI quota.
    if (restoreStarted.current || !initial.result || initial.explanation) return
    restoreStarted.current = true
    void explain(initial.result.runId, initial.resultLanguage)
  })
  useEffect(() => {
    explainRestored()
  }, [])

  /** The session is gone (e.g. data deleted on another tab): back to welcome. */
  function sessionEnded(error: unknown) {
    if (error instanceof ApiError && error.status === 401) {
      router.refresh()
      return true
    }
    return false
  }

  async function check(next: Profile, lang = language, fromMessage = false) {
    // Invalidate the previous run now, not when this one returns: its
    // explanation may land mid-check and would otherwise clear our progress.
    currentRun.current = null
    const profileId = activeId
    setProfile(next)
    setShowForm(false)
    setNotice(null)
    setExplainFailed(false)
    speaker.stopAll()
    setProgress({
      steps: { understand: fromMessage ? 'done' : 'skipped', check: 'active', explain: 'pending' },
      activeSince: timestamp(),
      language: lang,
    })
    try {
      const res = await api.match(profileId, next, lang)
      currentRun.current = res.runId
      setResult(res)
      setExplanation(null)
      setProfiles((ps) => ps.map((p) => (p.id === profileId ? { ...p, profile: next, latestRunId: res.runId } : p)))
      setProgress((p) => p && { ...p, steps: { ...p.steps, check: 'done', explain: 'active' }, activeSince: timestamp() })
      void explain(res.runId, lang)
    } catch (e) {
      setProgress(null)
      if (sessionEnded(e)) return
      setNotice(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
    }
  }

  async function explain(runId: string, lang: string) {
    try {
      const res = await api.explain(runId, lang)
      if (currentRun.current === runId) setExplanation(res)
    } catch (e) {
      if (sessionEnded(e)) return
      // Cards already show the engine's English text, so nothing is lost,
      // but say so rather than leaving the user waiting for a translation.
      if (currentRun.current === runId) setExplainFailed(true)
    } finally {
      if (currentRun.current === runId) setProgress(null)
    }
  }

  async function send(text: string) {
    const message = text.trim()
    if (!message || busy) return
    setInput('')
    await understand({ message }, message)
  }

  /** Typed text or a recording: Gemini reads the details either way, in one request. */
  async function understand(input: { message: string } | { audio: string }, shown: string | null) {
    if (busy) return
    setLastMessage(shown)
    setNotice(null)
    setProgress({
      steps: { understand: 'active', check: 'pending', explain: 'pending' },
      activeSince: timestamp(),
      language,
    })
    let extracted: Awaited<ReturnType<typeof api.extract>>
    try {
      extracted = await api.extract(input, profile)
    } catch (e) {
      setProgress(null)
      if (sessionEnded(e)) return
      setShowForm(true)
      setNotice("Sorry, we couldn't understand that automatically. Please use the form below. It works without AI.")
      return
    }
    if ('audio' in input) {
      if (!extracted.transcript?.trim()) {
        setProgress(null)
        setNotice("We couldn't hear anything clearly. Please try again closer to the microphone, or type instead.")
        return
      }
      // Show what was heard, so a mistake is visible and can be corrected with Edit.
      setLastMessage(extracted.transcript)
    }
    setLanguage(extracted.language)
    await check(extracted.profile, extracted.language, true)
  }

  async function switchProfile(target: ClientProfile) {
    const seq = ++viewSeq.current
    currentRun.current = null
    recorder.cancel()
    speaker.stopAll()
    setActiveId(target.id)
    setProfile(target.profile)
    setResult(null)
    setExplanation(null)
    setExplainFailed(false)
    setLastMessage(null)
    setNotice(null)
    setShowForm(false)
    setInput('')
    setProgress(null)
    if (!target.latestRunId) return

    try {
      const res = await api.run(target.latestRunId)
      if (seq !== viewSeq.current) return
      currentRun.current = res.runId
      setResult(res)
      setLanguage(res.language)
      setProgress(explainingStep(res.language))
      void explain(res.runId, res.language)
    } catch (e) {
      if (!sessionEnded(e) && seq === viewSeq.current) {
        setNotice("Couldn't load saved results. Please check again.")
      }
    }
  }

  async function addProfile(label: string) {
    const name = label.trim()
    if (!name) return
    try {
      const created = await api.addProfile(name)
      setProfiles((ps) => [...ps, created])
      setAdding(false)
      setNewLabel('')
      await switchProfile(created)
    } catch (e) {
      if (!sessionEnded(e)) setNotice(e instanceof Error ? e.message : "Couldn't add that person. Please try again.")
    }
  }

  async function deleteMyData() {
    if (!window.confirm('Delete all saved details and results for everyone on this device? This cannot be undone.')) {
      return
    }
    recorder.cancel()
    speaker.stopAll()
    try {
      await api.deleteMyData()
      router.refresh()
    } catch {
      setNotice("Couldn't delete your data right now. Please try again.")
    }
  }

  const known = (Object.keys(profile) as ProfileField[]).filter((f) => profile[f] !== null)
  const nextQuestion = result?.nextQuestions[0]
  const replies = nextQuestion ? quickReplies(nextQuestion.field) : null
  const explainedById = new Map(explanation?.schemes.map((s) => [s.id, s]) ?? [])
  const byStatus = (s: MatchItem['status']) => result?.matches.filter((m) => m.status === s) ?? []
  const eligible = byStatus('eligible')
  const ineligible = byStatus('ineligible')

  const steps: Step[] = progress
    ? [
        { id: 'understand', label: 'Understanding your message', state: progress.steps.understand, usesAI: true },
        { id: 'check', label: "Checking every scheme's rules", state: progress.steps.check, usesAI: false },
        {
          id: 'explain',
          label: progress.language === 'en'
            ? 'Writing simple explanations'
            : `Writing explanations in ${languageName(progress.language)}`,
          state: progress.steps.explain,
          usesAI: true,
        },
      ]
    : []

  return (
    <div className="flex flex-col gap-6">
      <section
        aria-label="Who you are checking for"
        className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-border bg-surface px-4 py-3"
      >
        <label htmlFor="person" className="text-sm text-muted">Checking for</label>
        <select
          id="person"
          value={activeId}
          disabled={busy}
          onChange={(e) => {
            const target = profiles.find((p) => p.id === e.target.value)
            if (target) void switchProfile(target)
          }}
          className="rounded-lg border border-border bg-background px-3 py-1.5 font-medium disabled:opacity-50"
        >
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
        {!adding ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            disabled={busy}
            className="text-sm text-accent underline disabled:opacity-50"
          >
            + Add family member
          </button>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void addProfile(newLabel)
            }}
            className="flex w-full flex-wrap items-center gap-2"
          >
            <label htmlFor="new-person" className="sr-only">Who is this for?</label>
            <input
              id="new-person"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="e.g. Mother"
              maxLength={40}
              className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-1.5"
            />
            <button
              type="submit"
              disabled={!newLabel.trim()}
              className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-accent-foreground disabled:opacity-50"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false)
                setNewLabel('')
              }}
              className="rounded-lg border border-border px-4 py-1.5 text-sm"
            >
              Cancel
            </button>
          </form>
        )}
      </section>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void send(input)
        }}
        className="flex flex-col gap-3"
      >
        <label htmlFor="message" className="sr-only">Tell us about yourself</label>
        <textarea
          id="message"
          rows={3}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void send(input)
            }
          }}
          placeholder={
            recorder.state !== 'idle'
              ? 'Recording… tap Send when you have finished speaking'
              : nextQuestion
                ? `${QUESTIONS[nextQuestion.field]} (any language)`
                : 'In any language: your age, where you live, your work, family income…'
          }
          className="w-full resize-y rounded-2xl border border-border bg-surface p-4 text-base leading-relaxed focus:outline-2 focus:outline-accent"
        />
        {recorder.state === 'idle' ? (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={!!busy || !input.trim()}
              className="rounded-lg bg-accent px-5 py-2.5 font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
            >
              {result ? 'Send' : 'Find my schemes'}
            </button>
            {recorder.supported && (
              <button
                type="button"
                onClick={() => void recorder.start()}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 hover:border-accent disabled:opacity-50"
              >
                <MicIcon />
                Speak
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowForm((s) => !s)}
              className="rounded-lg border border-border px-4 py-2.5 hover:bg-surface"
            >
              {showForm ? 'Hide form' : 'Fill a form instead'}
            </button>
          </div>
        ) : (
          <div
            role="status"
            className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-danger/50 bg-surface px-4 py-3"
          >
            <span className="size-3 shrink-0 animate-pulse rounded-full bg-danger" aria-hidden />
            <span className="font-semibold tabular-nums">
              {recorder.state === 'recording'
                ? `Recording ${Math.floor(recorder.seconds / 60)}:${String(recorder.seconds % 60).padStart(2, '0')}`
                : 'Preparing…'}
            </span>
            <span className="text-sm text-muted">Speak in any language · up to 1 minute</span>
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={recorder.cancel}
                disabled={recorder.state !== 'recording'}
                className="rounded-lg border border-border px-4 py-2 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void recorder.finish()}
                disabled={recorder.state !== 'recording'}
                className="rounded-lg bg-accent px-5 py-2 font-medium text-accent-foreground disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        )}
      </form>

      {!result && !busy && (
        <div>
          <p className="mb-2 text-sm text-muted">Or try an example:</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex.label}
                type="button"
                onClick={() => void send(ex.text)}
                className="rounded-full border border-border bg-surface px-4 py-1.5 text-sm hover:border-accent"
              >
                {ex.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div aria-live="polite" className="flex flex-col gap-3">
        {recorder.error && (
          <p role="alert" className="rounded-lg border border-danger/30 bg-surface px-4 py-3 text-danger">
            {recorder.error}
          </p>
        )}
        {progress && <ProgressSteps steps={steps} activeSince={progress.activeSince} />}
        {notice && (
          <p role="alert" className="rounded-lg border border-danger/30 bg-surface px-4 py-3 text-danger">
            {notice}
          </p>
        )}
      </div>

      {lastMessage && (
        <p className="self-end max-w-[85%] rounded-2xl rounded-br-sm bg-accent px-4 py-2.5 text-accent-foreground">
          {lastMessage}
        </p>
      )}

      {known.length > 0 && (
        <section aria-labelledby="understood">
          <div className="mb-2 flex items-center justify-between">
            <h2 id="understood" className="font-semibold">What we understood</h2>
            <button type="button" onClick={() => setShowForm(true)} className="text-sm text-accent underline">
              Edit
            </button>
          </div>
          <ul className="flex flex-wrap gap-2">
            {known.map((f) => (
              <li key={f} className="rounded-full border border-border bg-surface px-3 py-1 text-sm">
                <span className="text-muted">{FIELD_LABELS[f]}:</span> {formatValue(f, profile[f]!)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {showForm && (
        <ProfileForm
          key={JSON.stringify(profile)}
          initial={profile}
          onSubmit={(p) => void check(p)}
          onCancel={() => setShowForm(false)}
        />
      )}

      {result && nextQuestion && (
        <section className="rounded-2xl border border-info/30 bg-info-bg p-5">
          <p className="font-medium">{QUESTIONS[nextQuestion.field]}</p>
          <p className="mt-1 text-sm text-muted">
            Answering this lets us check {nextQuestion.unlocks} more{' '}
            {nextQuestion.unlocks === 1 ? 'scheme' : 'schemes'}.
          </p>
          {replies ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {replies.map((r) => (
                <button
                  key={r.label}
                  type="button"
                  disabled={!!busy}
                  onClick={() => void check(mergeProfile(profile, r.patch))}
                  className="rounded-full border border-info/40 bg-surface px-4 py-1.5 text-sm hover:border-info disabled:opacity-50"
                >
                  {r.label}
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm">Type your answer in the box above, in any language.</p>
          )}
        </section>
      )}

      {result && (
        <section aria-labelledby="results" className="flex flex-col gap-6">
          <div>
            <h2 id="results" className="text-2xl font-bold">
              {eligible.length > 0
                ? `You may qualify for ${eligible.length} ${eligible.length === 1 ? 'scheme' : 'schemes'}`
                : 'No confirmed matches yet'}
            </h2>
            {explanation?.intro && (
              <div className="mt-2 flex flex-col items-start gap-2">
                <p className="leading-relaxed" lang={explanation.language}>{explanation.intro}</p>
                <SpeakButton id="intro" text={explanation.intro} lang={explanation.language} speaker={speaker} />
              </div>
            )}
            {explainFailed && (
              <p className="mt-2 text-sm text-muted">
                We couldn&apos;t write the explanation in your language right now, so results are shown in English.
                The eligibility results are not affected.
              </p>
            )}
            {/* Hidden while explaining, so the saved document gets the translated text. */}
            {!explaining && (
              <a
                href={`/results/${result.runId}`}
                target="_blank"
                rel="noopener"
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 font-medium hover:border-accent"
              >
                <DownloadIcon />
                Download my schemes (PDF)
              </a>
            )}
          </div>

          <Group title="You qualify" items={eligible} {...{ explainedById, explaining, language, speaker }} />
          <Group title="One more detail needed" items={byStatus('needs_info')} {...{ explainedById, explaining, language, speaker }} />
          <Group title="Close, worth checking" items={byStatus('near_miss')} {...{ explainedById, explaining, language, speaker }} />

          {ineligible.length > 0 && (
            <details className="rounded-2xl border border-border bg-surface p-5">
              <summary className="cursor-pointer font-medium">Not eligible ({ineligible.length})</summary>
              <ul className="mt-3 flex flex-col gap-2 text-sm">
                {ineligible.map((m) => (
                  <li key={m.scheme.id}>
                    <strong>{m.scheme.name}:</strong> {m.failed.map(describeCheck).join(' ')}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <p className="text-xs text-muted">
            Results are based on published eligibility rules, which can change. Always confirm on the official
            website before applying. Scheme Saathi is not a government service.
          </p>
        </section>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-sm text-muted">
        <p>Your details are saved securely and linked to this device.</p>
        <button type="button" onClick={() => void deleteMyData()} className="text-danger underline">
          Delete my data
        </button>
      </footer>
    </div>
  )
}

function Group({
  title,
  items,
  explainedById,
  explaining,
  language,
  speaker,
}: {
  title: string
  items: MatchItem[]
  explainedById: Map<string, NonNullable<ExplainResponse['schemes']>[number]>
  explaining: boolean
  language: string
  speaker: Speaker
}) {
  if (items.length === 0) return null
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h3>
      {items.map((m) => (
        <ResultCard
          key={m.scheme.id}
          item={m}
          explained={explainedById.get(m.scheme.id)}
          explaining={explaining}
          language={language}
          speaker={speaker}
        />
      ))}
    </div>
  )
}
