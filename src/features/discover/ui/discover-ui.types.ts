import type {
  AnimeFormat,
  AnimeGenre,
  AnimeSearchSort,
  AnimeSeason,
  DiscoverPageData,
} from '../shared/discover-contracts'

export type DiscoverNavigationIntent = 'push' | 'replace'

export type DiscoverUrlSearchState = {
  query: string | null
  genre: AnimeGenre | null
  format: AnimeFormat | null
  season: AnimeSeason | null
  year: number | null
  sort: AnimeSearchSort
}

export type DiscoverSearchStateChange = (
  state: DiscoverUrlSearchState,
  intent: DiscoverNavigationIntent,
) => void

export type DiscoverPageProps = {
  data: DiscoverPageData | null
  isLoading: boolean
  searchState: DiscoverUrlSearchState
  onSearchStateChange: DiscoverSearchStateChange
}
