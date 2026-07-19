import {
  AniListRequestError,
  createAniListDependencies,
  requestAniList,
  type AniListDependencies,
} from '../../../lib/anilist-client.server'

import {
  animeSearchInputSchema,
  type AnimeSearchInput,
} from '../shared/discover-contracts'
import {
  normalizeAniListRecommendationResponse,
  normalizeAniListSearchResponse,
  normalizeAniListSectionResponse,
} from './anilist-normalization.server'
import {
  DISCOVER_PROVIDER_SECTION_CONFIG,
  type AnimeProviderSeason,
  type AnimeSearchPageProvider,
  type AnimeSummaryProvider,
  type DiscoverSectionKeyProvider,
} from './discover-provider-cache-contracts.server'

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

const sectionDocuments: Record<DiscoverSectionKeyProvider, string> = {
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

const sortForSearch = (input: AnimeSearchInput): string => {
  if (input.sort === 'relevance') return input.query ? 'SEARCH_MATCH' : 'POPULARITY_DESC'
  return { trending: 'TRENDING_DESC', popularity: 'POPULARITY_DESC', score: 'SCORE_DESC', newest: 'START_DATE_DESC' }[input.sort]
}

/** Returns provider season for a UTC timestamp. */
const getProviderAnimeSeason = (timestampMs: number): AnimeProviderSeason => {
  const date = new Date(timestampMs)
  if (Number.isNaN(date.getTime())) throw new RangeError('Timestamp must be valid.')

  const quarter = Math.floor(date.getUTCMonth() / 3)
  return ['WINTER', 'SPRING', 'SUMMER', 'FALL'][quarter] as AnimeProviderSeason
}

/** Builds variables for a curated Discover rail. */
const createSectionVariables = (
  key: DiscoverSectionKeyProvider,
  dependencies: AniListDependencies,
): Record<string, unknown> => {
  const variables: Record<string, unknown> = {
    perPage: DISCOVER_PROVIDER_SECTION_CONFIG[key].itemLimit,
  }
  if (key !== 'seasonal') return variables
  const now = dependencies.now()
  return {
    ...variables,
    season: getProviderAnimeSeason(now),
    year: new Date(now).getUTCFullYear(),
  }
}

/** Fetches and normalizes one curated Discover rail. */
export const fetchDiscoverSectionFromAniList = async (
  key: DiscoverSectionKeyProvider,
  dependencies: AniListDependencies,
): Promise<AnimeSummaryProvider[]> => {
  const config = DISCOVER_PROVIDER_SECTION_CONFIG[key]
  const body = await requestAniList(sectionDocuments[key], createSectionVariables(key, dependencies), dependencies)
  return key === 'recommendations'
    ? normalizeAniListRecommendationResponse(body, config.itemLimit)
    : normalizeAniListSectionResponse(body)
}

/** Searches normalized AniList anime with contract-validated filters. */
export const searchAnimeFromAniList = async (
  input: AnimeSearchInput,
  dependencies: AniListDependencies,
): Promise<AnimeSearchPageProvider> => {
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
  return normalizeAniListSearchResponse(body)
}
