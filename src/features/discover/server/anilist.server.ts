import { z } from 'zod'

import {
  AniListRequestError,
  createAniListDependencies,
  requestAniList,
  type AniListDependencies,
} from '../../../lib/anilist-client.server'

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

export { AniListRequestError, createAniListDependencies }
export type { AniListDependencies }

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

const upstreamError = (): AniListRequestError => new AniListRequestError('UPSTREAM', 'AniList is temporarily unavailable.', null)

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
