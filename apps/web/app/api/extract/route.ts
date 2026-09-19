import { NextResponse } from 'next/server'
import { z } from 'zod'
import { EMPTY_PROFILE, mergeProfile, ProfileSchema, STATE_NAMES } from '@saathi/core'
import { getLLM } from '@/lib/llm'
import { getUser, unauthorized } from '@/lib/session'

export const maxDuration = 60

const Body = z
  .object({
    message: z.string().trim().min(1).max(2000).optional(),
    /** Base64 16 kHz mono WAV from the browser recorder: 60 s is about 2.6 MB encoded. */
    audio: z.string().min(1000).max(3_500_000).optional(),
    /** What we already know from earlier turns; new facts are merged over it. */
    profile: ProfileSchema.optional(),
  })
  .refine((b) => Boolean(b.message) !== Boolean(b.audio), 'Send either a message or a recording')

const Extraction = z.object({
  facts: ProfileSchema,
  /** BCP-47 code of the language the user wrote or spoke in, e.g. "hi", "ta", "en". */
  language: z.string(),
  /** For recordings: what was said, shown back so the user sees what we heard. */
  transcript: z.string().nullable(),
})

const SYSTEM = `You extract facts about one person from a message, for an Indian government-scheme eligibility checker. The message may be in any Indian language, English, or a mix (e.g. Hinglish).

Rules:
- Only fill a field when the message states it clearly. Otherwise use null. Never guess.
- NEVER infer caste category from a surname or community name, or gender from a person's name. Leave them null unless stated directly.
- annualIncome: yearly household income in rupees as a plain number. "1.5 lakh" = 150000. Convert monthly to yearly (x12).
- landHectares: land owned, in hectares. 1 acre = 0.4047 ha, 1 bigha is about 0.25 ha (varies by state; use it only if no better unit is given). "No land" = 0.
- state: the two-letter code from this list: ${Object.entries(STATE_NAMES).map(([c, n]) => `${c}=${n}`).join(', ')}.
- isRural: true for a village or gaon, false for a city or town.
- occupation: pick the closest option. A farm labourer who owns no land is "labourer".
- language: the language the message is written or spoken in, as a short code ("hi", "mr", "ta", "te", "bn", "en", ...).
- transcript: if the message is an audio recording, write exactly what was said, in the language and script it was spoken in. If the recording is silent or cannot be understood, use an empty string and set every fact to null. For a text message, use null.`

export async function POST(request: Request) {
  // Also protects the small AI quota from anonymous traffic.
  if (!(await getUser())) return unauthorized()

  const body = Body.safeParse(await request.json().catch(() => null))
  if (!body.success) {
    return NextResponse.json({ error: 'Invalid request', issues: body.error.issues }, { status: 400 })
  }

  try {
    const { message, audio } = body.data
    const { facts, language, transcript } = await getLLM({ audio: Boolean(audio) }).json({
      system: SYSTEM,
      prompt: message ?? 'The message is in the attached audio recording.',
      schema: Extraction,
      audio: audio ? { data: audio, mimeType: 'audio/wav' } : undefined,
    })
    const profile = mergeProfile(body.data.profile ?? EMPTY_PROFILE, facts)
    return NextResponse.json({ profile, extracted: facts, language, transcript: audio ? transcript ?? '' : null })
  } catch (error) {
    // 502: the AI failed, not the user. The UI falls back to the manual form.
    console.error('[extract]', error)
    return NextResponse.json(
      { error: 'Could not understand the message automatically. Please use the form.' },
      { status: 502 },
    )
  }
}
