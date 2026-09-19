import type { ExplainedScheme, MatchItem } from '@/lib/api'
import { APPLY_METHOD_LABELS, describeCheck, FIELD_LABELS } from '@/lib/labels'
import type { Speaker } from '@/lib/speech'
import { DownloadIcon } from './icons'
import { SpeakButton } from './speak-button'

const TONE = {
  eligible: 'border-eligible/30 bg-eligible-bg',
  near_miss: 'border-near/30 bg-near-bg',
  needs_info: 'border-info/30 bg-info-bg',
  ineligible: 'border-border bg-surface',
} as const

/**
 * Renders straight from the engine's result, so it is useful immediately.
 * When the AI explanation arrives it replaces the English text; the verdict,
 * amount and apply link always come from the engine and database.
 */
export function ResultCard({
  item,
  explained,
  explaining,
  language,
  speaker,
}: {
  item: MatchItem
  explained?: ExplainedScheme
  explaining: boolean
  language: string
  speaker: Speaker
}) {
  const { scheme, status } = item
  const nearMiss = status === 'near_miss'

  // What "Listen" reads: the essentials, never URLs or document lists.
  const spoken = explained
    ? [explained.name, explained.why, nearMiss ? explained.gap : null]
    : [scheme.name, scheme.benefitAmount, scheme.benefit, nearMiss ? item.failed.map(describeCheck).join(' ') : null]

  return (
    <article className={`rounded-2xl border p-5 ${TONE[status]}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold leading-snug" lang={explained ? language : 'en'}>
            {explained?.name ?? scheme.name}
          </h3>
          {explained && explained.name !== scheme.name && (
            <p className="text-sm text-muted">{scheme.name}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!scheme.verifiedOn && (
            <span
              className="rounded-full border border-border bg-surface px-2.5 py-0.5 text-xs text-muted"
              title="These details have not yet been checked against the official website."
            >
              Unverified
            </span>
          )}
          <SpeakButton
            id={scheme.id}
            text={spoken.filter(Boolean).join('. ')}
            lang={explained ? language : 'en'}
            speaker={speaker}
          />
        </div>
      </div>

      {scheme.benefitAmount && <p className="mt-2 text-2xl font-bold">{scheme.benefitAmount}</p>}

      <p className="mt-2 leading-relaxed" lang={explained ? language : 'en'}>
        {explained?.why ?? scheme.benefit}
      </p>

      {status === 'near_miss' && (
        <p className="mt-3 rounded-lg bg-surface/70 px-3 py-2 text-sm" lang={explained?.gap ? language : 'en'}>
          <strong>Close: </strong>
          {explained?.gap ?? item.failed.map(describeCheck).join(' ')}
        </p>
      )}

      {status === 'needs_info' && (
        <p className="mt-3 text-sm">
          <strong>We still need: </strong>
          {item.missingFields.map((f) => FIELD_LABELS[f].toLowerCase()).join(', ')}
        </p>
      )}

      {!explained && explaining && (
        <p className="mt-3 animate-pulse text-sm text-muted">Writing this in your language…</p>
      )}

      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-medium">Documents you&apos;ll need</summary>
        <ul className="mt-2 list-disc pl-5 text-sm" lang={explained ? language : 'en'}>
          {(explained?.documents ?? scheme.documents).map((d) => <li key={d}>{d}</li>)}
        </ul>
      </details>

      <section className="mt-4 rounded-xl border border-border bg-surface p-3" aria-label={`How to apply for ${scheme.name}`}>
        <h4 className="text-sm font-semibold">
          How to apply <span className="font-normal text-muted">· {APPLY_METHOD_LABELS[scheme.applyMethod].en}</span>
        </h4>
        <p className="mt-1 text-sm leading-relaxed" lang={explained?.nextStep ? language : 'en'}>
          {explained?.nextStep ?? scheme.applySteps}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {/* Only official PDFs that were checked to exist; many schemes have none. */}
          {scheme.forms.map((f) => (
            <a
              key={f.url}
              href={f.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
            >
              <DownloadIcon />
              Official form: {f.label}
            </a>
          ))}
          <a
            href={scheme.applyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-lg border border-border px-3 py-2 text-sm font-medium hover:border-accent"
          >
            Official website ↗
          </a>
        </div>
      </section>
    </article>
  )
}
