import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ProfileSchema, type ProfileField } from '@saathi/core'
import type { ExplainedScheme, MatchItem } from '@/lib/api'
import { describeCheck, FIELD_LABELS, formatValue } from '@/lib/labels'
import { findOwnedRun, runToMatchResponse, savedExplanation } from '@/lib/runs'
import { getUser } from '@/lib/session'
import { PrintButton } from './print-button'

// Browsers use the page title as the PDF's file name.
export const metadata: Metadata = { title: 'My schemes - Scheme Saathi' }

const TEXT = {
  en: {
    title: 'My government schemes',
    for: 'Prepared for',
    date: 'Checked on',
    details: 'Details used',
    eligible: 'You qualify',
    needsInfo: 'One more detail needed',
    nearMiss: 'Close, worth checking',
    close: 'Close:',
    stillNeeded: 'Still needed:',
    documents: 'Documents to bring',
    apply: 'Where to apply',
    unverified: 'Not yet verified against the official website.',
    none: 'No schemes matched yet. Add more details in Scheme Saathi and check again.',
    disclaimer:
      'Based on published eligibility rules, which can change. Confirm on the official website or at your nearest Common Service Centre (CSC) before applying. Scheme Saathi is not a government service.',
    save: 'Save as PDF',
    back: 'Back',
  },
  hi: {
    title: 'मेरी सरकारी योजनाएँ',
    for: 'किसके लिए',
    date: 'जाँच की तारीख',
    details: 'इस्तेमाल की गई जानकारी',
    eligible: 'आप पात्र हैं',
    needsInfo: 'एक और जानकारी चाहिए',
    nearMiss: 'करीब हैं, जाँच लें',
    close: 'करीब:',
    stillNeeded: 'अभी चाहिए:',
    documents: 'साथ ले जाने वाले दस्तावेज़',
    apply: 'कहाँ आवेदन करें',
    unverified: 'आधिकारिक वेबसाइट से अभी जाँचा नहीं गया।',
    none: 'अभी कोई योजना नहीं मिली। Scheme Saathi में और जानकारी जोड़कर फिर से जाँचें।',
    disclaimer:
      'यह प्रकाशित पात्रता नियमों पर आधारित है, जो बदल सकते हैं। आवेदन से पहले आधिकारिक वेबसाइट या नज़दीकी जन सेवा केंद्र (CSC) पर पुष्टि करें। Scheme Saathi सरकारी सेवा नहीं है।',
    save: 'PDF के रूप में सहेजें',
    back: 'वापस',
  },
}

type Text = (typeof TEXT)['en']

/** A printable summary of one saved result. Only its owner can open it. */
export default async function ResultsDocument(props: PageProps<'/results/[runId]'>) {
  const { runId } = await props.params
  const user = await getUser()
  if (!user) notFound()
  const run = await findOwnedRun(user.id, runId)
  if (!run) notFound()

  const { matches } = runToMatchResponse(run)
  const explanation = savedExplanation(run, run.language)
  const lang = explanation?.language ?? 'en'
  const t = lang === 'hi' ? TEXT.hi : TEXT.en
  const explained = new Map(explanation?.schemes.map((s) => [s.id, s]) ?? [])

  // The profile exactly as the decision saw it, not as it may have been edited since.
  const snapshot = ProfileSchema.parse(run.snapshot)
  const details = (Object.keys(snapshot) as ProfileField[]).filter((f) => snapshot[f] !== null)
  const date = new Intl.DateTimeFormat(lang === 'hi' ? 'hi-IN' : 'en-IN', { dateStyle: 'long' }).format(run.createdAt)

  const groups = [
    { title: t.eligible, items: matches.filter((m) => m.status === 'eligible') },
    { title: t.needsInfo, items: matches.filter((m) => m.status === 'needs_info') },
    { title: t.nearMiss, items: matches.filter((m) => m.status === 'near_miss') },
  ].filter((g) => g.items.length > 0)

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 bg-white px-6 py-8 text-neutral-900 print:max-w-none print:p-0" lang={lang}>
      <div className="mb-6 flex flex-wrap items-center gap-3 print:hidden">
        <PrintButton label={t.save} />
        <Link href="/" className="rounded-lg border border-neutral-300 px-5 py-2.5">
          {t.back}
        </Link>
      </div>

      <header className="border-b-2 border-neutral-900 pb-4">
        <p className="text-sm font-semibold">Scheme Saathi · योजना साथी</p>
        <h1 className="mt-1 text-3xl font-bold">{t.title}</h1>
        <p className="mt-2 text-sm">
          {t.for}: <strong>{run.profile?.label}</strong> · {t.date}: {date}
        </p>
      </header>

      {details.length > 0 && (
        <section className="mt-4 text-sm">
          <h2 className="font-semibold">{t.details}</h2>
          <p className="mt-1" lang="en">
            {details.map((f) => `${FIELD_LABELS[f]}: ${formatValue(f, snapshot[f]!)}`).join(' · ')}
          </p>
        </section>
      )}

      {explanation?.intro && <p className="mt-4 leading-relaxed">{explanation.intro}</p>}

      {groups.length === 0 && <p className="mt-6">{t.none}</p>}

      {groups.map((g) => (
        <section key={g.title} className="mt-6">
          <h2 className="mb-3 text-lg font-bold uppercase tracking-wide">{g.title}</h2>
          <div className="flex flex-col gap-4">
            {g.items.map((m) => (
              <SchemeBlock key={m.scheme.id} item={m} explained={explained.get(m.scheme.id)} lang={lang} t={t} />
            ))}
          </div>
        </section>
      ))}

      <p className="mt-8 border-t border-neutral-300 pt-3 text-xs leading-relaxed">{t.disclaimer}</p>
    </main>
  )
}

function SchemeBlock({ item, explained, lang, t }: { item: MatchItem; explained?: ExplainedScheme; lang: string; t: Text }) {
  const { scheme, status } = item
  const textLang = explained ? lang : 'en'

  return (
    <article className="break-inside-avoid rounded-lg border border-neutral-400 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-lg font-bold" lang={textLang}>{explained?.name ?? scheme.name}</h3>
        {scheme.benefitAmount && <p className="font-bold">{scheme.benefitAmount}</p>}
      </div>
      {explained && explained.name !== scheme.name && <p className="text-sm" lang="en">{scheme.name}</p>}

      <p className="mt-2 leading-relaxed" lang={textLang}>{explained?.why ?? scheme.benefit}</p>

      {status === 'near_miss' && (
        <p className="mt-2 text-sm" lang={explained?.gap ? lang : 'en'}>
          <strong>{t.close}</strong> {explained?.gap ?? item.failed.map(describeCheck).join(' ')}
        </p>
      )}
      {status === 'needs_info' && (
        <p className="mt-2 text-sm">
          <strong>{t.stillNeeded}</strong>{' '}
          <span lang="en">{item.missingFields.map((f) => FIELD_LABELS[f].toLowerCase()).join(', ')}</span>
        </p>
      )}

      <h4 className="mt-3 text-sm font-semibold">{t.documents}</h4>
      <ul className="mt-1 flex flex-col gap-1.5 text-sm" lang={textLang}>
        {(explained?.documents ?? scheme.documents).map((d) => (
          <li key={d} className="flex items-start gap-2">
            {/* An empty box to tick on paper. */}
            <span aria-hidden className="mt-0.5 size-4 shrink-0 border-2 border-neutral-600" />
            {d}
          </li>
        ))}
      </ul>

      <p className="mt-3 text-sm">
        <strong>{t.apply}:</strong>{' '}
        {explained?.nextStep && <span lang={lang}>{explained.nextStep} </span>}
        <span className="break-all">{scheme.applyUrl}</span>
      </p>
      {!scheme.verifiedOn && <p className="mt-1 text-xs text-neutral-600">{t.unverified}</p>}
    </article>
  )
}
