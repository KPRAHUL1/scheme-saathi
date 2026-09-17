import { NextResponse } from 'next/server'
import { z } from 'zod'
import { matchAll, ProfileSchema } from '@saathi/core'
import { getPrisma, type Prisma } from '@saathi/db'
import { findOwnedProfile } from '@/lib/account'
import { loadSchemes } from '@/lib/catalogue'
import { toMatchResponse } from '@/lib/runs'
import { getUser, unauthorized } from '@/lib/session'

export const maxDuration = 60

const Body = z.object({
  profileId: z.string().min(1),
  profile: ProfileSchema,
  language: z.string().default('en'),
})

/**
 * The decision step. No AI is involved here: the rules engine decides, and
 * the profile and full decision are saved before anything is returned.
 */
export async function POST(request: Request) {
  const user = await getUser()
  if (!user) return unauthorized()

  const body = Body.safeParse(await request.json().catch(() => null))
  if (!body.success) {
    return NextResponse.json({ error: 'Invalid request', issues: body.error.issues }, { status: 400 })
  }
  const { profileId, profile, language } = body.data

  if (!(await findOwnedProfile(user.id, profileId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const matches = matchAll(await loadSchemes(), profile)

    // One statement: saves the latest answers and records the decision
    // together, so a saved profile never disagrees with its latest run.
    const saved = await getPrisma().profile.update({
      where: { id: profileId },
      data: {
        ...profile,
        runs: {
          create: {
            snapshot: profile as Prisma.InputJsonValue,
            language,
            results: {
              create: matches.map((m) => ({
                schemeId: m.scheme.id,
                status: m.status,
                checks: m.checks as unknown as Prisma.InputJsonValue,
              })),
            },
          },
        },
      },
      select: { runs: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true } } },
    })

    return NextResponse.json(toMatchResponse(saved.runs[0].id, language, matches))
  } catch (error) {
    console.error('[match]', error)
    return NextResponse.json({ error: 'Could not check schemes right now.' }, { status: 503 })
  }
}
