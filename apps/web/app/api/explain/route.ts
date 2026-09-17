import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getPrisma, type Prisma } from '@saathi/db'
import type { ExplainResponse } from '@/lib/api'
import { getLLM } from '@/lib/llm'
import { findOwnedRun, savedExplanation } from '@/lib/runs'
import { getUser, unauthorized } from '@/lib/session'

export const maxDuration = 60

const Body = z.object({
  runId: z.string().min(1),
  /** Language to explain in; defaults to the one saved with the run. */
  language: z.string().optional(),
})

const Explanation = z.object({
  intro: z.string(),
  schemes: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      why: z.string(),
      gap: z.string().nullable(),
      documents: z.array(z.string()),
      nextStep: z.string(),
    }),
  ),
})

const SYSTEM = `You explain government-scheme eligibility results to an ordinary person in India, in simple, warm, plain language.

The eligibility decisions are already final. They were made by a rules engine and are given to you as data. You must not change any verdict, and you must not add, remove, or invent schemes: explain exactly the schemes you are given, using their ids.

For each scheme:
- name: the scheme name, in the target language (keep official names recognisable).
- why: one or two sentences on what the person gets and why they match, based on the rules that passed.
- gap: only for status "near_miss", say kindly which single rule they missed and by how much, using the actual value. Otherwise null.
- documents: the documents list, in the target language.
- nextStep: one concrete action, e.g. where to apply.

intro: one or two encouraging sentences summarising the result.
Also say that details should be confirmed on the official website, because rules change.
Write everything in the target language. Use rupee amounts as given; do not recompute them.
Land values in the data are in hectares, but people think in acres: always state land in acres (1 hectare = 2.471 acres), rounded to one decimal.`

// Ineligible schemes aren't explained: long lists of "no" help nobody.
const EXPLAINED = new Set(['eligible', 'near_miss', 'needs_info'])

export async function POST(request: Request) {
  const user = await getUser()
  if (!user) return unauthorized()

  const body = Body.safeParse(await request.json().catch(() => null))
  if (!body.success) {
    return NextResponse.json({ error: 'Invalid request', issues: body.error.issues }, { status: 400 })
  }

  // Ownership is part of the query: another user's run is simply not found.
  const run = await findOwnedRun(user.id, body.data.runId)
  if (!run) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const language = body.data.language ?? run.language

  // Already explained in this language: return it without spending AI quota.
  const saved = savedExplanation(run, language)
  if (saved) return NextResponse.json(saved)

  const results = run.results.filter((r) => EXPLAINED.has(r.status))
  if (results.length === 0) {
    return NextResponse.json({ runId: run.id, language, intro: null, schemes: [] })
  }

  // Explained from the stored decision, not from anything the client sends,
  // so the explanation can only ever describe what the audit log recorded.
  const decisions = results.map((r) => ({
    id: r.schemeId,
    status: r.status,
    name: r.scheme.name,
    benefit: r.scheme.benefit,
    benefitAmount: r.scheme.benefitAmount,
    documents: r.scheme.documents,
    applyUrl: r.scheme.applyUrl,
    checks: r.checks,
  }))

  try {
    const explanation = await getLLM().json({
      system: SYSTEM,
      prompt: `Target language: ${language}\n\nDecisions:\n${JSON.stringify(decisions, null, 2)}`,
      schema: Explanation,
    })

    // Guard against the model inventing or dropping schemes: keep only the ids
    // we sent, attach the verdict from the database, and keep our order.
    const byId = new Map(explanation.schemes.map((s) => [s.id, s]))
    const schemes = results.flatMap((r) => {
      const s = byId.get(r.schemeId)
      return s ? [{ ...s, status: r.status, applyUrl: r.scheme.applyUrl }] : []
    })

    const response: ExplainResponse = { runId: run.id, language, intro: explanation.intro, schemes }
    await getPrisma().matchRun.update({
      where: { id: run.id },
      data: { explanation: response as unknown as Prisma.InputJsonValue, explanationLanguage: language },
    })
    return NextResponse.json(response)
  } catch (error) {
    console.error('[explain]', error)
    return NextResponse.json({ error: 'Could not write the explanation right now.' }, { status: 502 })
  }
}
