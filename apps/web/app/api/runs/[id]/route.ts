import { NextResponse } from 'next/server'
import { findOwnedRun, runToMatchResponse } from '@/lib/runs'
import { getUser, unauthorized } from '@/lib/session'

/** Reopen a saved result, rebuilt from the audit log. No AI involved. */
export async function GET(_request: Request, ctx: RouteContext<'/api/runs/[id]'>) {
  const user = await getUser()
  if (!user) return unauthorized()

  const { id } = await ctx.params
  const run = await findOwnedRun(user.id, id)
  // 404 rather than 403 for someone else's run: don't confirm that it exists.
  if (!run) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(runToMatchResponse(run))
}
