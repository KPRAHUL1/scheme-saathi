import { NextResponse } from 'next/server'
import { z } from 'zod'
import { loadAccount } from '@/lib/account'
import { createUser, deleteCurrentUser, getUser, unauthorized } from '@/lib/session'

const Start = z.object({
  language: z.string().trim().min(2).max(10),
  label: z.string().trim().min(1).max(40),
})

export async function GET() {
  const user = await getUser()
  if (!user) return unauthorized()
  return NextResponse.json(await loadAccount(user))
}

/** Accepting the consent notice. Safe to call twice: an existing session is kept. */
export async function POST(request: Request) {
  const body = Start.safeParse(await request.json().catch(() => null))
  if (!body.success) {
    return NextResponse.json({ error: 'Invalid request', issues: body.error.issues }, { status: 400 })
  }
  const user = (await getUser()) ?? (await createUser(body.data.language, body.data.label))
  return NextResponse.json(await loadAccount(user))
}

/** "Delete my data". Irreversible, and deliberately so. */
export async function DELETE() {
  await deleteCurrentUser()
  return NextResponse.json({ ok: true })
}
