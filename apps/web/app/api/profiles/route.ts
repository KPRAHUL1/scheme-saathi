import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getPrisma } from '@saathi/db'
import { toClientProfile } from '@/lib/account'
import { getUser, unauthorized } from '@/lib/session'

const Body = z.object({ label: z.string().trim().min(1).max(40) })

// Enough for a household; stops a script from filling the database.
const MAX_PROFILES = 10

/** Add a family member to check for. */
export async function POST(request: Request) {
  const user = await getUser()
  if (!user) return unauthorized()

  const body = Body.safeParse(await request.json().catch(() => null))
  if (!body.success) {
    return NextResponse.json({ error: 'Invalid request', issues: body.error.issues }, { status: 400 })
  }

  const prisma = getPrisma()
  if ((await prisma.profile.count({ where: { userId: user.id } })) >= MAX_PROFILES) {
    return NextResponse.json({ error: `You can add up to ${MAX_PROFILES} people.` }, { status: 400 })
  }

  const row = await prisma.profile.create({ data: { userId: user.id, label: body.data.label } })
  return NextResponse.json(toClientProfile(row))
}
