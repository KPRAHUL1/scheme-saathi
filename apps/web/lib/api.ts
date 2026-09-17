import type { Check, MatchStatus, Profile, ProfileField, Scheme } from '@saathi/core'

export type ExtractResponse = {
  profile: Profile
  extracted: Profile
  language: string
  /** What Gemini heard, for recordings; null for typed messages. */
  transcript: string | null
}

export type MatchItem = {
  scheme: Scheme
  status: MatchStatus
  failed: Check[]
  missingFields: ProfileField[]
}

export type MatchResponse = {
  runId: string
  /** Language the run was made in; its saved explanation is in this language. */
  language: string
  matches: MatchItem[]
  nextQuestions: { field: ProfileField; unlocks: number }[]
}

export type ExplainedScheme = {
  id: string
  name: string
  why: string
  gap: string | null
  documents: string[]
  nextStep: string
  status: MatchStatus
  applyUrl: string
}

export type ExplainResponse = {
  runId: string
  language: string
  intro: string | null
  schemes: ExplainedScheme[]
}

export type ClientProfile = {
  id: string
  label: string
  profile: Profile
  latestRunId: string | null
}

export type Account = { language: string; profiles: ClientProfile[] }

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(data.error ?? `Request failed (${res.status})`, res.status)
  return data as T
}

export const api = {
  startSession: (language: string, label: string) =>
    request<Account>('POST', '/api/session', { language, label }),
  deleteMyData: () => request<{ ok: true }>('DELETE', '/api/session'),
  addProfile: (label: string) => request<ClientProfile>('POST', '/api/profiles', { label }),
  run: (runId: string) => request<MatchResponse>('GET', `/api/runs/${encodeURIComponent(runId)}`),
  extract: (input: { message: string } | { audio: string }, profile: Profile) =>
    request<ExtractResponse>('POST', '/api/extract', { ...input, profile }),
  match: (profileId: string, profile: Profile, language: string) =>
    request<MatchResponse>('POST', '/api/match', { profileId, profile, language }),
  explain: (runId: string, language: string) =>
    request<ExplainResponse>('POST', '/api/explain', { runId, language }),
}
