import type { Scheme } from '@saathi/core'

/**
 * Every scheme, shown before anything has been checked, so people can see
 * what exists. Once they answer, this is replaced by their real results.
 */
export function SchemeCatalogue({ schemes }: { schemes: Scheme[] }) {
  return (
    <section aria-labelledby="catalogue" className="flex flex-col gap-4">
      <div>
        <h2 id="catalogue" className="text-2xl font-bold">All {schemes.length} central government schemes</h2>
        <p className="mt-1 text-muted">
          Answer a few questions and we&apos;ll check each one for you. They&apos;ll turn into your results here.
        </p>
      </div>
      <ul className="flex flex-col gap-3">
        {schemes.map((s) => (
          <li key={s.id} className="rounded-2xl border border-dashed border-border bg-surface/70 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="font-semibold leading-snug">{s.name}</p>
              <span className="shrink-0 rounded-full border border-border px-2.5 py-0.5 text-xs text-muted">
                Not checked yet
              </span>
            </div>
            {s.benefitAmount && <p className="mt-1 font-bold text-muted">{s.benefitAmount}</p>}
            <p className="mt-1 text-sm leading-relaxed text-muted">{s.benefit}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
