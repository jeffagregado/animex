import { z } from 'zod'

import {
  DISCOVER_SECTION_CONFIG,
  animeSearchInputSchema,
  getAnimeSeason,
  normalizeAnimeSummary,
  type AnimeSearchInput,
  type AnimeSearchPage,
  type AnimeSummary,
  type DiscoverSectionKey,
} from '../shared/discover-contracts'

const ANILIST_GRAPHQL_ENDPOINT = 'https://graphql.anilist.co'
const ANILIST_TIMEOUT_MS = 8_000
const ANILIST_MAX_ATTEMPTS = 3

const mediaSelection = `
  id type isAdult
  title { english romaji native }
  coverImage { large }
  bannerImage format season seasonYear episodes genres popularity averageScore trending
  startDate { year month day }
  nextAiringEpisode { airingAt }
`

const sectionDocuments: Record<DiscoverSectionKey, string> = {
  trending: `query Trending($perPage: Int!) { Page(page: 1, perPage: $perPage) { media(type: ANIME, isAdult: false, sort: TRENDING_DESC) { ${mediaSelection} } } }`,
  seasonal: `query Seasonal($perPage: Int!, $season: MediaSeason!, $year: Int!) { Page(page: 1, perPage: $perPage) { media(type: ANIME, isAdult: false, season: $season, seasonYear: $year, sort: POPULARITY_DESC) { ${mediaSelection} } } }`,
  upcoming: `query Upcoming($perPage: Int!) { Page(page: 1, perPage: $perPage) { media(type: ANIME, isAdult: false, status: NOT_YET_RELEASED, sort: [START_DATE, POPULARITY_DESC]) { ${mediaSelection} } } }`,
  recommendations: `query Recommendations($perPage: Int!) { Page(page: 1, perPage: $perPage) { recommendations(sort: RATING_DESC, rating_greater: 0) { rating mediaRecommendation { ${mediaSelection} } } } }`,
}

const createSearchDocument = (input: AnimeSearchInput): string => {
  const definitions = ['$page: Int!', '$perPage: Int!', '$sort: [MediaSort]']
  const filters = ['type: ANIME', 'isAdult: false', 'sort: $sort']
  if (input.query) {
    definitions.push('$query: String')
    filters.push('search: $query')
  }
  if (input.genre) {
    definitions.push('$genre: String')
    filters.push('genre: $genre')
  }
  if (input.format) {
    definitions.push('$format: MediaFormat')
    filters.push('format: $format')
  }
  if (input.season) {
    definitions.push('$season: MediaSeason')
    filters.push('season: $season')
  }
  if (input.year) {
    definitions.push('$year: Int')
    filters.push('seasonYear: $year')
  }
  return `query Search(${definitions.join(', ')}) { Page(page: $page, perPage: $perPage) { pageInfo { currentPage hasNextPage } media(${filters.join(', ')}) { ${mediaSelection} } } }`
}

const mediaListSchema = z.object({
  data: z.object({ Page: z.object({ media: z.array(z.unknown()) }) }),
})

const recommendationListSchema = z.object({
  data: z.object({ Page: z.object({ recommendations: z.array(z.object({ mediaRecommendation: z.unknown() })) }) }),
})

const searchResponseSchema = z.object({
  data: z.object({
    Page: z.object({
      pageInfo: z.object({ currentPage: z.number().int().positive(), hasNextPage: z.boolean() }),
      media: z.array(z.unknown()),
    }),
  }),
})

const graphQlErrorSchema = z.object({ errors: z.array(z.object({ message: z.string() })).min(1) })

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export interface AniListDependencies {
  fetch: FetchLike
  delay: (milliseconds: number) => Promise<void>
  warn: (message: string) => void
  now: () => number
}

type RequestErrorCode = 'UPSTREAM' | 'RATE_LIMITED'

/** Represents a client-safe AniList transport failure. */
export class AniListRequestError extends Error {
  readonly code: RequestErrorCode
  readonly retryAfterSeconds: number | null

  constructor(code: RequestErrorCode, message: string, retryAfterSeconds: number | null) {
    super(message)
    this.name = 'AniListRequestError'
    this.code = code
    this.retryAfterSeconds = retryAfterSeconds
  }
}

/** Supplies production transport dependencies explicitly. */
export const createAniListDependencies = (): AniListDependencies => ({
  fetch: globalThis.fetch,
  delay: async (milliseconds) => await new Promise<void>((resolve) => globalThis.setTimeout(resolve, milliseconds)),
  warn: (message) => console.warn(message),
  now: () => Date.now(),
})

const upstreamError = (): AniListRequestError => new AniListRequestError('UPSTREAM', 'AniList is temporarily unavailable.', null)

const getRetryAfterSeconds = (response: Response): number | null => {
  const value = response.headers.get('retry-after')
  if (value === null) return null
  const seconds = Number(value)
  return Number.isFinite(seconds) && seconds >= 0 ? Math.ceil(seconds) : null
}

/** Reports a retry without exposing provider details. */
const warnAniListRetry = (attempt: number, dependencies: AniListDependencies): void => {
  dependencies.warn(`AniList request retry ${attempt} of ${ANILIST_MAX_ATTEMPTS - 1}.`)
}

/** Waits before retrying a transient AniList transport failure. */
const retryAniListRequest = async (attempt: number, dependencies: AniListDependencies): Promise<void> => {
  warnAniListRetry(attempt, dependencies)
  await dependencies.delay(attempt * 200)
}

/** Retries transient upstream failures or raises after the final attempt. */
const throwOrRetryUpstream = async (attempt: number, dependencies: AniListDependencies): Promise<void> => {
  if (attempt === ANILIST_MAX_ATTEMPTS) throw upstreamError()
  await retryAniListRequest(attempt, dependencies)
}

/** Retries only short rate-limit windows, preserving the provider retry hint. */
const throwOrRetryRateLimit = async (
  response: Response,
  attempt: number,
  dependencies: AniListDependencies,
): Promise<void> => {
  const retryAfterSeconds = getRetryAfterSeconds(response)
  if (retryAfterSeconds === null || retryAfterSeconds > 2 || attempt === ANILIST_MAX_ATTEMPTS) {
    throw new AniListRequestError('RATE_LIMITED', 'AniList rate limit exceeded.', retryAfterSeconds)
  }
  await dependencies.delay(retryAfterSeconds * 1_000)
  warnAniListRetry(attempt, dependencies)
}

/** Sends one GraphQL request and exposes a network failure as null. */
const fetchAniListResponse = async (
  document: string,
  variables: Record<string, unknown>,
  dependencies: AniListDependencies,
): Promise<Response | null> => {
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

/** Reads valid JSON responses or raises a sanitized upstream error. */
const readAniListBody = async (response: Response): Promise<unknown> => {
  try {
    return await response.json()
  } catch {
    throw upstreamError()
  }
}

/** Rejects GraphQL error payloads without exposing provider details. */
const throwOnGraphQlError = (body: unknown): void => {
  if (graphQlErrorSchema.safeParse(body).success) throw upstreamError()
}

const requestAniList = async (document: string, variables: Record<string, unknown>, dependencies: AniListDependencies): Promise<unknown> => {
  for (let attempt = 1; attempt <= ANILIST_MAX_ATTEMPTS; attempt += 1) {
    const response = await fetchAniListResponse(document, variables, dependencies)
    if (response === null) {
      await throwOrRetryUpstream(attempt, dependencies)
      continue
    }
    if (response.status === 429) {
      await throwOrRetryRateLimit(response, attempt, dependencies)
      continue
    }
    if (response.status >= 500) {
      await throwOrRetryUpstream(attempt, dependencies)
      continue
    }
    if (!response.ok) throw upstreamError()
    const body = await readAniListBody(response)
    throwOnGraphQlError(body)
    return body
  }
  throw upstreamError()
}

/** Normalizes one provider media object or raises a sanitized upstream error. */
const normalizeSingleMedia = (value: unknown): AnimeSummary => {
  try {
    return normalizeAnimeSummary(value)
  } catch {
    throw upstreamError()
  }
}

const normalizeMedia = (values: unknown[]): AnimeSummary[] => {
  return values.map(normalizeSingleMedia)
}

const sortForSearch = (input: AnimeSearchInput): string => {
  if (input.sort === 'relevance') return input.query ? 'SEARCH_MATCH' : 'POPULARITY_DESC'
  return { trending: 'TRENDING_DESC', popularity: 'POPULARITY_DESC', score: 'SCORE_DESC', newest: 'START_DATE_DESC' }[input.sort]
}

/** Builds variables for a curated Discover rail. */
const createSectionVariables = (
  key: DiscoverSectionKey,
  dependencies: AniListDependencies,
): Record<string, unknown> => {
  const variables: Record<string, unknown> = { perPage: DISCOVER_SECTION_CONFIG[key].itemLimit }
  if (key !== 'seasonal') return variables
  const now = dependencies.now()
  return { ...variables, season: getAnimeSeason(now), year: new Date(now).getUTCFullYear() }
}

/** Normalizes one eligible recommendation, skipping non-anime and adult entries. */
const normalizeRecommendationMedia = (value: unknown): AnimeSummary | null => {
  if (typeof value !== 'object' || value === null) throw upstreamError()
  const media = value as { type?: unknown; isAdult?: unknown }
  if (media.type !== 'ANIME' || media.isAdult !== false) return null
  return normalizeSingleMedia(value)
}

/** Normalizes, deduplicates, and bounds curated recommendation media. */
const normalizeRecommendations = (body: unknown, itemLimit: number): AnimeSummary[] => {
  const parsed = recommendationListSchema.safeParse(body)
  if (!parsed.success) throw upstreamError()
  const unique = new Map<number, AnimeSummary>()
  for (const recommendation of parsed.data.data.Page.recommendations) {
    const summary = normalizeRecommendationMedia(recommendation.mediaRecommendation)
    if (summary !== null && !unique.has(summary.anilistId)) unique.set(summary.anilistId, summary)
  }
  const summaries = [...unique.values()].slice(0, itemLimit)
  if (summaries.length === 0) throw upstreamError()
  return summaries
}

/** Validates and normalizes a non-recommendation curated rail response. */
const normalizeSectionMedia = (body: unknown): AnimeSummary[] => {
  const parsed = mediaListSchema.safeParse(body)
  if (!parsed.success) throw upstreamError()
  return normalizeMedia(parsed.data.data.Page.media)
}

/** Fetches and normalizes one curated Discover rail. */
export const fetchDiscoverSectionFromAniList = async (
  key: DiscoverSectionKey,
  dependencies: AniListDependencies,
): Promise<AnimeSummary[]> => {
  const config = DISCOVER_SECTION_CONFIG[key]
  const body = await requestAniList(sectionDocuments[key], createSectionVariables(key, dependencies), dependencies)
  return key === 'recommendations'
    ? normalizeRecommendations(body, config.itemLimit)
    : normalizeSectionMedia(body)
}

/** Searches normalized AniList anime with contract-validated filters. */
export const searchAnimeFromAniList = async (
  input: AnimeSearchInput,
  dependencies: AniListDependencies,
): Promise<AnimeSearchPage> => {
  const parsedInput = animeSearchInputSchema.parse(input)
  const variables: Record<string, unknown> = {
    page: parsedInput.page,
    perPage: 20,
    sort: sortForSearch(parsedInput),
  }
  if (parsedInput.query) variables.query = parsedInput.query
  if (parsedInput.genre) variables.genre = parsedInput.genre
  if (parsedInput.format) variables.format = parsedInput.format
  if (parsedInput.season) variables.season = parsedInput.season
  if (parsedInput.year) variables.year = parsedInput.year
  const body = await requestAniList(createSearchDocument(parsedInput), variables, dependencies)
  const parsed = searchResponseSchema.safeParse(body)
  if (!parsed.success) throw upstreamError()
  return {
    items: normalizeMedia(parsed.data.data.Page.media),
    currentPage: parsed.data.data.Page.pageInfo.currentPage,
    hasNextPage: parsed.data.data.Page.pageInfo.hasNextPage,
    perPage: 20,
  }
}
