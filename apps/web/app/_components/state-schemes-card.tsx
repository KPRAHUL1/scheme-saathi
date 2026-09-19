import type { Profile } from '@saathi/core'
import { mySchemeStateLink } from '@/lib/myscheme'

const TEXT = {
  en: {
    title: (state: string) => `${state} government schemes`,
    body: (state: string) =>
      `Scheme Saathi checks central government schemes for you. Schemes from the ${state} government are listed on myScheme, the Government of India's official scheme portal.`,
    button: (state: string) => `See ${state} schemes on myScheme`,
  },
  hi: {
    title: (state: string) => `${state} सरकार की योजनाएँ`,
    body: (state: string) =>
      `Scheme Saathi आपके लिए केंद्र सरकार की योजनाएँ जाँचता है। ${state} सरकार की योजनाएँ भारत सरकार के आधिकारिक पोर्टल myScheme पर देखें।`,
    button: (state: string) => `myScheme पर ${state} की योजनाएँ देखें`,
  },
}

/** Hands off to the official state list. Renders nothing if we have no checked link. */
export function StateSchemesCard({ state, lang }: { state: Profile['state']; lang: 'hi' | 'en' }) {
  const link = mySchemeStateLink(state)
  if (!link) return null
  const t = TEXT[lang]

  return (
    <section className="rounded-2xl border border-info/30 bg-info-bg p-5" lang={lang} aria-labelledby="state-schemes">
      <h3 id="state-schemes" className="text-lg font-semibold">{t.title(link.name)}</h3>
      <p className="mt-1 text-sm leading-relaxed">{t.body(link.name)}</p>
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground hover:opacity-90"
      >
        {t.button(link.name)} ↗
      </a>
    </section>
  )
}
