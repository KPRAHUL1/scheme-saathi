'use client'

import { useEffect, useState } from 'react'

export type StepState = 'pending' | 'active' | 'done' | 'skipped'
export type Step = { id: string; label: string; state: StepState; usesAI: boolean }

// How long an AI step can run before we tell the user it's the service, not them.
const SLOW_AFTER_SECONDS = 12

export function ProgressSteps({ steps, activeSince }: { steps: Step[]; activeSince: number }) {
  const [now, setNow] = useState(activeSince)

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const elapsed = Math.max(0, Math.floor((now - activeSince) / 1000))
  const active = steps.find((s) => s.state === 'active')

  return (
    <ol aria-label="Progress" className="flex flex-col gap-2.5 rounded-2xl border border-border bg-surface p-4">
      {steps
        .filter((s) => s.state !== 'skipped')
        .map((s) => (
          <li key={s.id} className="flex items-center gap-3">
            <StepIcon state={s.state} />
            <span className={s.state === 'pending' ? 'text-muted' : s.state === 'active' ? 'font-medium' : ''}>
              {s.label}
            </span>
            {s.state === 'active' && elapsed >= 2 && (
              <span className="ml-auto text-sm tabular-nums text-muted">{elapsed}s</span>
            )}
          </li>
        ))}
      {active?.usesAI && elapsed >= SLOW_AFTER_SECONDS && (
        <li className="pl-8 text-sm text-muted">The AI service is busy right now. Still trying…</li>
      )}
    </ol>
  )
}

function StepIcon({ state }: { state: StepState }) {
  if (state === 'done') {
    return (
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-eligible text-xs text-background" aria-label="done">
        ✓
      </span>
    )
  }
  if (state === 'active') {
    return (
      <span
        className="size-5 shrink-0 animate-spin rounded-full border-2 border-border border-t-accent"
        aria-label="in progress"
      />
    )
  }
  return <span className="size-5 shrink-0 rounded-full border-2 border-border" aria-label="waiting" />
}
