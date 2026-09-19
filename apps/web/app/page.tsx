import { loadAccount } from '@/lib/account'
import { loadSchemes } from '@/lib/catalogue'
import { findOwnedRun, runToMatchResponse, savedExplanation } from '@/lib/runs'
import { getUser, type SessionUser } from '@/lib/session'
import { Saathi, type InitialState } from './_components/saathi'
import { Welcome } from './_components/welcome'

export default async function Home() {
  const user = await getUser()
  // Read on the server, so a returning visitor lands straight on their saved
  // profile and results, with no loading flash and no extra round trip.
  const initial = user ? await loadInitialState(user) : null

  return (
    // Wide for the two-column app; the welcome screen stays narrow and focused.
    <main className={`mx-auto w-full flex-1 px-4 py-8 sm:py-12 ${initial ? 'max-w-6xl' : 'max-w-2xl'}`}>
      <header className="mb-8">
        <p className="text-sm font-semibold text-accent">Scheme Saathi · योजना साथी</p>
        <h1 className="mt-1 text-3xl font-bold leading-tight sm:text-4xl">
          Find government schemes you can get
        </h1>
        <p className="mt-3 leading-relaxed text-muted">
          Tell us about yourself in your own language. We check your details against each scheme&apos;s
          eligibility rules, then explain the results simply.
        </p>
      </header>
      {initial ? <Saathi key={user!.id} initial={initial} /> : <Welcome />}
    </main>
  )
}

async function loadInitialState(user: SessionUser): Promise<InitialState | null> {
  const account = await loadAccount(user)
  const active = account.profiles[0]
  if (!active) return null

  const [run, catalogue] = await Promise.all([
    active.latestRunId ? findOwnedRun(user.id, active.latestRunId) : null,
    loadSchemes(),
  ])
  return {
    account,
    catalogue,
    activeProfileId: active.id,
    result: run ? runToMatchResponse(run) : null,
    explanation: run ? savedExplanation(run, run.language) : null,
    resultLanguage: run?.language ?? account.language,
  }
}
