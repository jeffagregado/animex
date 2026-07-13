import { z } from 'zod'

const ANILIST_GRAPHQL_ENDPOINT = 'https://graphql.anilist.co'
const ANILIST_TIMEOUT_MS = 8_000
const ANILIST_MAX_ATTEMPTS = 3
const graphQlErrorSchema = z.object({ errors: z.array(z.object({ message: z.string() })).min(1) })

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export interface AniListDependencies {
  fetch: FetchLike
  delay: (milliseconds: number) => Promise<void>
  warn: (message: string) => void
  now: () => number
}

export class AniListRequestError extends Error {
  readonly code: 'UPSTREAM' | 'RATE_LIMITED'
  readonly retryAfterSeconds: number | null

  constructor(code: 'UPSTREAM' | 'RATE_LIMITED', message: string, retryAfterSeconds: number | null) {
    super(message)
    this.name = 'AniListRequestError'
    this.code = code
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export const createAniListDependencies = (): AniListDependencies => ({
  fetch: globalThis.fetch,
  delay: async (milliseconds) => await new Promise<void>((resolve) => globalThis.setTimeout(resolve, milliseconds)),
  warn: (message) => console.warn(message),
  now: () => Date.now(),
})

const upstreamError = (): AniListRequestError => new AniListRequestError('UPSTREAM', 'AniList is temporarily unavailable.', null)

const retryAfter = (response: Response): number | null => {
  const value = response.headers.get('retry-after')
  if (value === null) return null
  const seconds = Number(value)
  return Number.isFinite(seconds) && seconds >= 0 ? Math.ceil(seconds) : null
}

const warnRetry = (attempt: number, dependencies: AniListDependencies): void => {
  dependencies.warn(`AniList request retry ${attempt} of ${ANILIST_MAX_ATTEMPTS - 1}.`)
}

const fetchResponse = async (document: string, variables: Record<string, unknown>, dependencies: AniListDependencies): Promise<Response | null> => {
  try {
    return await dependencies.fetch(ANILIST_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ query: document, variables }),
      signal: AbortSignal.timeout(ANILIST_TIMEOUT_MS),
    })
  } catch {
    return null
  }
}

const requestAniListWithNotFoundPolicy = async (
  document: string,
  variables: Record<string, unknown>,
  dependencies: AniListDependencies,
  allowNotFoundBody: boolean,
): Promise<unknown> => {
  for (let attempt = 1; attempt <= ANILIST_MAX_ATTEMPTS; attempt += 1) {
    const response = await fetchResponse(document, variables, dependencies)
    if (response === null || response.status >= 500) {
      if (attempt === ANILIST_MAX_ATTEMPTS) throw upstreamError()
      warnRetry(attempt, dependencies)
      await dependencies.delay(attempt * 200)
      continue
    }
    if (response.status === 429) {
      const seconds = retryAfter(response)
      if (seconds === null || seconds > 2 || attempt === ANILIST_MAX_ATTEMPTS) {
        throw new AniListRequestError('RATE_LIMITED', 'AniList rate limit exceeded.', seconds)
      }
      await dependencies.delay(seconds * 1_000)
      warnRetry(attempt, dependencies)
      continue
    }
    if (!response.ok && !(allowNotFoundBody && response.status === 404)) throw upstreamError()
    let body: unknown
    try {
      body = await response.json()
    } catch {
      throw upstreamError()
    }
    if (graphQlErrorSchema.safeParse(body).success) throw upstreamError()
    return body
  }
  throw upstreamError()
}

/** Sends one sanitized, bounded-retry AniList GraphQL POST request. */
export const requestAniList = async (document: string, variables: Record<string, unknown>, dependencies: AniListDependencies): Promise<unknown> => {
  return await requestAniListWithNotFoundPolicy(document, variables, dependencies, false)
}

/** Allows a valid 404 body so detail normalizers can own not-found semantics. */
export const requestAniListAllowingNotFound = async (document: string, variables: Record<string, unknown>, dependencies: AniListDependencies): Promise<unknown> => {
  return await requestAniListWithNotFoundPolicy(document, variables, dependencies, true)
}
