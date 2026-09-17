import { createHash, randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getPrisma } from '@saathi/db'

/**
 * Anonymous, device-based accounts. No name, email or password: the people
 * this app serves often have none of those to spare, and a login wall before
 * any value is where they would leave.
 *
 * The cookie carries a random 256-bit token. The database stores only its
 * SHA-256 hash, so someone reading the sessions table cannot sign in as anyone.
 */

const COOKIE = 'saathi_session'
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365
const TOUCH_AFTER_MS = 24 * 60 * 60 * 1000

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

export type SessionUser = { id: string; language: string }

export async function getUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value
  if (!token) return null

  const prisma = getPrisma()
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, lastSeenAt: true, user: { select: { id: true, language: true } } },
  })
  // A cookie for a deleted account is simply ignored: the visitor starts over.
  if (!session) return null

  // Refresh at most daily, so reads don't each cost an extra write.
  if (Date.now() - session.lastSeenAt.getTime() > TOUCH_AFTER_MS) {
    await prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
  }
  return session.user
}

/** Called only once the visitor has accepted the consent notice. */
export async function createUser(language: string, firstProfileLabel: string): Promise<SessionUser> {
  const token = randomBytes(32).toString('base64url')
  const user = await getPrisma().user.create({
    data: {
      consentedAt: new Date(),
      language,
      sessions: { create: { tokenHash: hashToken(token) } },
      profiles: { create: { label: firstProfileLabel } },
    },
    select: { id: true, language: true },
  })

  ;(await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ONE_YEAR_SECONDS,
  })
  return user
}

/** "Delete my data": the user row cascades to sessions, profiles and runs. */
export async function deleteCurrentUser(): Promise<void> {
  const user = await getUser()
  if (user) await getPrisma().user.delete({ where: { id: user.id } })
  ;(await cookies()).delete(COOKIE)
}

export const unauthorized = () =>
  NextResponse.json({ error: 'Your session has ended. Please start again.' }, { status: 401 })
