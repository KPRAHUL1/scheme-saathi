import { NextResponse } from 'next/server'
import { EMPTY_PROFILE, matchAll } from '@saathi/core'
import { loadSchemes } from '@/lib/catalogue'

// Never cache: this exists to answer "is the database reachable right now?"
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Round-trip DB rows through core's schema and engine, so a green health
    // check means the whole read path works, not just the connection.
    const schemes = await loadSchemes()
    const matches = matchAll(schemes, EMPTY_PROFILE)

    return NextResponse.json({
      ok: true,
      schemes: schemes.length,
      unverified: schemes.filter((s) => !s.verifiedOn).length,
      engine: matches.length === schemes.length ? 'ok' : 'mismatch',
    })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 503 },
    )
  }
}
