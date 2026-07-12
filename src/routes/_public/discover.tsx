import { createFileRoute } from '@tanstack/react-router'

import { getDiscoverPage } from '#/features/discover/server/discover.functions'
import { DiscoverRouteError, DiscoverRoutePending } from '#/features/shell/discover-route-states'
import {
  DISCOVER_GENRES,
  animeFormatSchema,
  animeSearchSortSchema,
  animeSeasonSchema,
  type AnimeFormat,
  type AnimeGenre,
  type AnimeSearchSort,
  type AnimeSeason,
} from '#/features/discover/shared/discover-contracts'
import { DiscoverPage } from '#/features/discover/ui/discover-page'
import type { DiscoverUrlSearchState } from '#/features/discover/ui/discover-ui.types'

type DiscoverRouteSearch = {
  q?: string
  genre?: AnimeGenre
  format?: AnimeFormat
  season?: AnimeSeason
  year?: number
  sort?: AnimeSearchSort
}

const defaultDiscoverSearchState: DiscoverUrlSearchState = {
  query: null,
  genre: null,
  format: null,
  season: null,
  year: null,
  sort: 'relevance',
}

/** Parses one positive URL year without passing unsafe values downstream. */
const parseDiscoverYear = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value > 0 ? value : null
  }
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    return null
  }
  const parsedYear = Number(value)
  return Number.isSafeInteger(parsedYear) && parsedYear > 0 ? parsedYear : null
}

/** Converts untrusted URL values to the valid UI search state. */
export const normalizeDiscoverSearch = (search: Record<string, unknown>): DiscoverUrlSearchState => {
  const query = typeof search.q === 'string' ? search.q.trim() : ''
  const genre = typeof search.genre === 'string' && DISCOVER_GENRES.includes(search.genre as AnimeGenre)
    ? search.genre as AnimeGenre
    : null
  const format = animeFormatSchema.safeParse(search.format).data ?? null
  const season = animeSeasonSchema.safeParse(search.season).data ?? null
  const year = parseDiscoverYear(search.year)
  const sort = animeSearchSortSchema.safeParse(search.sort).data ?? defaultDiscoverSearchState.sort

  return {
    query: query.length >= 2 && query.length <= 100 ? query : null,
    genre,
    format,
    season,
    year,
    sort,
  }
}

/** Omits default and empty URL state values from navigation. */
export const serializeDiscoverSearch = (state: DiscoverUrlSearchState): DiscoverRouteSearch => {
  const search: DiscoverRouteSearch = {}
  if (state.query !== null) {
    search.q = state.query
  }
  if (state.genre !== null) {
    search.genre = state.genre
  }
  if (state.format !== null) {
    search.format = state.format
  }
  if (state.season !== null) {
    search.season = state.season
  }
  if (state.year !== null) {
    search.year = state.year
  }
  if (state.sort !== defaultDiscoverSearchState.sort) {
    search.sort = state.sort
  }
  return search
}

/** Loads initial Discover rails through the server-only function boundary. */
export const loadDiscoverPage = async () => await getDiscoverPage()

/** Builds URL navigation options from Discover UI intent. */
export const getDiscoverNavigationOptions = (
  state: DiscoverUrlSearchState,
  intent: 'push' | 'replace',
) => ({
  search: serializeDiscoverSearch(state),
  replace: intent === 'replace',
  resetScroll: false,
})

export const Route = createFileRoute('/_public/discover')({
  validateSearch: (search) => serializeDiscoverSearch(normalizeDiscoverSearch(search)),
  loader: loadDiscoverPage,
  component: DiscoverRoute,
  pendingComponent: DiscoverRoutePending,
  errorComponent: DiscoverRouteError,
})

function DiscoverRoute() {
  const data = Route.useLoaderData()
  const search = normalizeDiscoverSearch(Route.useSearch())
  const navigate = Route.useNavigate()

  return (
    <DiscoverPage
      data={data}
      isLoading={false}
      searchState={search}
      onSearchStateChange={(state, intent) => void navigate(getDiscoverNavigationOptions(state, intent))}
    />
  )
}
