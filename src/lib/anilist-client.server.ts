import { z } from 'zod'

const ANILIST_GRAPHQL_ENDPOINT = 'https://graphql.anilist.co'
const ANILIST_TIMEOUT_MS = 8_000
const ANILIST_MAX_ATTEMPTS = 3
const graphQlErrorSchema = z.object({ errors: z.array(z.object({ message: z.string() })).min(1) })
export type AniListNotFoundRoot = 'Media' | 'Character' | 'Staff'

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

/** Retries one unavailable response or raises the final sanitized error. */
const retryUnavailable = async (attempt: number, dependencies: AniListDependencies): Promise<void> => {
  if (attempt === ANILIST_MAX_ATTEMPTS) throw upstreamError()
  warnRetry(attempt, dependencies)
  await dependencies.delay(attempt * 200)
}

/** Applies bounded Retry-After handling to one rate-limited response. */
const retryRateLimited = async (response: Response, attempt: number, dependencies: AniListDependencies): Promise<void> => {
  const seconds = retryAfter(response)
  if (seconds === null || seconds > 2 || attempt === ANILIST_MAX_ATTEMPTS) {
    throw new AniListRequestError('RATE_LIMITED', 'AniList rate limit exceeded.', seconds)
  }
  await dependencies.delay(seconds * 1_000)
  warnRetry(attempt, dependencies)
}

/** Parses one JSON body without exposing upstream parse details. */
const parseResponseBody = async (response: Response): Promise<unknown> => {
  try {
    return await response.json()
  } catch {
    throw upstreamError()
  }
}

/** Validates status and GraphQL error policy for one response. */
const notFoundBodySchema = (root: AniListNotFoundRoot) => z.object({
  errors: z.array(z.object({ message: z.string(), status: z.literal(404) }).passthrough()).min(1),
  data: z.object({ [root]: z.null() }).strict(),
}).strict()

/** Validates status and one explicit GraphQL not-found root. */
const readResponseBody = async (
  response: Response,
  notFoundRoot: AniListNotFoundRoot | null,
): Promise<unknown> => {
  if (!response.ok && !(notFoundRoot !== null && response.status === 404)) throw upstreamError()
  const body = await parseResponseBody(response)
  if (notFoundRoot !== null && response.status === 404) {
    if (notFoundBodySchema(notFoundRoot).safeParse(body).success) return body
    throw upstreamError()
  }
  if (graphQlErrorSchema.safeParse(body).success) throw upstreamError()
  return body
}

const requestAniListWithNotFoundPolicy = async (
  document: string,
  variables: Record<string, unknown>,
  dependencies: AniListDependencies,
  notFoundRoot: AniListNotFoundRoot | null,
): Promise<unknown> => {
  for (let attempt = 1; attempt <= ANILIST_MAX_ATTEMPTS; attempt += 1) {
    const response = await fetchResponse(document, variables, dependencies)
    if (response === null || response.status >= 500) {
      await retryUnavailable(attempt, dependencies)
      continue
    }
    if (response.status === 429) {
      await retryRateLimited(response, attempt, dependencies)
      continue
    }
    return await readResponseBody(response, notFoundRoot)
  }
  throw upstreamError()
}

/** Sends one sanitized, bounded-retry AniList GraphQL POST request. */
export const requestAniList = async (document: string, variables: Record<string, unknown>, dependencies: AniListDependencies): Promise<unknown> => {
  return await requestAniListWithNotFoundPolicy(document, variables, dependencies, null)
}

/** Allows a valid 404 body so detail normalizers can own not-found semantics. */
export const requestAniListAllowingNotFound = async (
  document: string,
  variables: Record<string, unknown>,
  dependencies: AniListDependencies,
  expectedRoot: AniListNotFoundRoot,
): Promise<unknown> => {
  return await requestAniListWithNotFoundPolicy(document, variables, dependencies, expectedRoot)
}
