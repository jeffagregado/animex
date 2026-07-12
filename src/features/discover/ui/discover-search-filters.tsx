import { type ReactNode, useEffect, useRef, useState } from 'react'
import { ChevronDown, ListFilter, Search } from 'lucide-react'

import {
  DISCOVER_GENRES,
  type AnimeFormat,
  type AnimeGenre,
  type AnimeSearchSort,
  type AnimeSeason,
} from '../shared/discover-contracts'
import type { DiscoverSearchStateChange, DiscoverUrlSearchState } from './discover-ui.types'

type DiscoverSearchFiltersProps = {
  searchState: DiscoverUrlSearchState
  onStateChange: DiscoverSearchStateChange
}

type SearchSelectProps<TValue extends string> = {
  label: string
  value: TValue | null
  options: readonly TValue[]
  onChange: (value: TValue | null) => void
}

type ThemedSelectProps = {
  label: string
  value: string | number | null
  children: ReactNode
  onChange: (value: string) => void
}

const animeFormats: readonly AnimeFormat[] = ['TV', 'TV_SHORT', 'MOVIE', 'SPECIAL', 'OVA', 'ONA', 'MUSIC']
const animeSeasons: readonly AnimeSeason[] = ['WINTER', 'SPRING', 'SUMMER', 'FALL']
const animeSorts: readonly AnimeSearchSort[] = ['relevance', 'trending', 'popularity', 'score', 'newest']
const years = Array.from({ length: 12 }, (_, index) => new Date().getFullYear() - index)

const getQueryError = (query: string): string | null => {
  const length = query.trim().length
  if (length === 1 || length > 100) {
    return 'Enter 2 to 100 characters to search.'
  }
  return null
}

/** Renders a dark select with a consistent themed arrow. */
function ThemedSelect({ label, value, children, onChange }: ThemedSelectProps) {
  return (
    <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
      {label}
      <span className="relative">
        <select
          className="h-10 w-full appearance-none rounded-lg border border-border bg-background px-3 pr-10 text-sm text-foreground outline-none transition hover:border-cyan-300 hover:bg-cyan-300/5 focus-visible:border-cyan-300 focus-visible:ring-2 focus-visible:ring-cyan-300/40"
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value)}
        >
          {children}
        </select>
        <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-cyan-300" />
      </span>
    </label>
  )
}

/** Renders a URL-controlled searchable filter select. */
function SearchSelect<TValue extends string>({ label, value, options, onChange }: SearchSelectProps<TValue>) {
  return (
    <ThemedSelect label={label} value={value} onChange={(nextValue) => onChange(nextValue === '' ? null : nextValue as TValue)}>
        <option value="">Any</option>
        {options.map((option) => <option key={option} value={option}>{option.replaceAll('_', ' ')}</option>)}
    </ThemedSelect>
  )
}

/** Keeps search input responsive while parent owns canonical URL state. */
export function DiscoverSearchFilters({ searchState, onStateChange }: DiscoverSearchFiltersProps) {
  const [draftQuery, setDraftQuery] = useState(searchState.query ?? '')
  const previousQuery = useRef(searchState.query)
  const clearingInvalidQuery = useRef(false)
  const queryError = getQueryError(draftQuery)
  const hasActiveFilters = searchState.genre !== null || searchState.format !== null || searchState.season !== null || searchState.year !== null || searchState.sort !== 'relevance'

  useEffect(() => {
    if (previousQuery.current === searchState.query) {
      return
    }
    previousQuery.current = searchState.query
    if (clearingInvalidQuery.current && searchState.query === null) {
      clearingInvalidQuery.current = false
      return
    }
    setDraftQuery(searchState.query ?? '')
  }, [searchState.query])

  useEffect(() => {
    const query = draftQuery.trim()
    if (getQueryError(query) !== null) {
      return undefined
    }
    const timeoutId = window.setTimeout(() => {
      const nextQuery = query.length === 0 ? null : query
      if (nextQuery !== searchState.query) {
        onStateChange({ ...searchState, query: nextQuery }, 'replace')
      }
    }, 400)
    return () => window.clearTimeout(timeoutId)
  }, [draftQuery, onStateChange, searchState])

  const updateQuery = (value: string): void => {
    setDraftQuery(value)
    if (getQueryError(value) !== null && searchState.query !== null) {
      clearingInvalidQuery.current = true
      onStateChange({ ...searchState, query: null }, 'replace')
    }
  }

  const updateFilter = <TKey extends keyof DiscoverUrlSearchState>(key: TKey, value: DiscoverUrlSearchState[TKey]): void => {
    onStateChange({ ...searchState, [key]: value }, 'push')
  }

  const clearFilters = (): void => {
    onStateChange({ ...searchState, genre: null, format: null, season: null, year: null, sort: 'relevance' }, 'push')
  }

  return (
    <section id="discover-search" aria-label="Discover search" className="space-y-3 scroll-mt-4">
      <div className="flex gap-3">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search anime</span>
          <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <input
            className="h-12 w-full rounded-lg border border-border bg-card pl-12 pr-4 text-sm outline-none transition placeholder:text-muted-foreground focus-visible:border-cyan-300 focus-visible:ring-2 focus-visible:ring-cyan-300/40"
            type="search"
            value={draftQuery}
            onChange={(event) => updateQuery(event.target.value)}
            placeholder="Search anime..."
            aria-describedby={queryError === null ? undefined : 'discover-query-error'}
          />
        </label>
        <details className="group relative">
          <summary className="flex h-12 cursor-pointer list-none items-center gap-2 rounded-lg border border-cyan-400/50 bg-card px-4 text-sm font-semibold text-cyan-200 outline-none transition hover:bg-cyan-400/10 focus-visible:ring-2 focus-visible:ring-cyan-300/40">
            <ListFilter aria-hidden="true" className="size-5" />
            Filters
          </summary>
          <div className="absolute right-0 z-20 mt-2 grid w-[min(22rem,calc(100vw-2rem))] grid-cols-2 gap-3 rounded-xl border border-border bg-card p-4 shadow-2xl">
            <SearchSelect label="Genre" value={searchState.genre} options={DISCOVER_GENRES} onChange={(value) => updateFilter('genre', value as AnimeGenre | null)} />
            <SearchSelect label="Format" value={searchState.format} options={animeFormats} onChange={(value) => updateFilter('format', value as AnimeFormat | null)} />
            <SearchSelect label="Season" value={searchState.season} options={animeSeasons} onChange={(value) => updateFilter('season', value as AnimeSeason | null)} />
            <ThemedSelect label="Year" value={searchState.year} onChange={(value) => updateFilter('year', value === '' ? null : Number(value))}>
                <option value="">Any</option>{years.map((year) => <option key={year} value={year}>{year}</option>)}
            </ThemedSelect>
            <SearchSelect label="Sort" value={searchState.sort} options={animeSorts} onChange={(value) => updateFilter('sort', value as AnimeSearchSort)} />
            {hasActiveFilters ? <button className="col-span-2 rounded-lg border border-cyan-400/50 bg-cyan-400/10 px-3 py-2 text-sm font-semibold text-cyan-100 outline-none transition hover:border-cyan-300 hover:bg-cyan-300/20 focus-visible:ring-2 focus-visible:ring-cyan-300/40" type="button" onClick={clearFilters}>Clear filters</button> : null}
          </div>
        </details>
      </div>
      {queryError === null ? null : <p id="discover-query-error" role="status" className="text-sm text-amber-300">{queryError}</p>}
    </section>
  )
}
