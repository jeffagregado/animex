import { useCallback, useEffect, useRef, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { ImageOff, LoaderCircle } from 'lucide-react'

import { searchAnime } from '../server/discover.functions'
import type { AnimeSummary } from '../shared/discover-contracts'
import type { DiscoverUrlSearchState } from './discover-ui.types'

type DiscoverSearchResultsProps = {
  searchState: DiscoverUrlSearchState
}

type SearchResultCardProps = {
  anime: AnimeSummary
}

type SearchFailureShape = {
  code: unknown
  retryAfterSeconds: unknown
}

const hasValidSearchCriteria = (searchState: DiscoverUrlSearchState): boolean => {
  const query = searchState.query?.trim() ?? null
  return (query === null || (query.length >= 2 && query.length <= 100))
    && Boolean(query || searchState.genre || searchState.format || searchState.season || searchState.year)
}

const isSearchFailureShape = (value: unknown): value is SearchFailureShape => typeof value === 'object' && value !== null && 'code' in value && 'retryAfterSeconds' in value

const getSearchFailureMessage = (error: unknown, isNextPage: boolean): string => {
  const prefix = isNextPage ? 'Could not load more results.' : 'Search is unavailable.'
  if (!isSearchFailureShape(error) || error.code !== 'RATE_LIMITED') {
    return `${prefix} Try again.`
  }
  if (typeof error.retryAfterSeconds === 'number') {
    return `${prefix} Try again in ${error.retryAfterSeconds} seconds.`
  }
  return `${prefix} AniList is rate limited; retry when ready.`
}

/** Removes duplicate AniList IDs returned across search pages. */
const dedupeSearchResults = (pages: { items: AnimeSummary[] }[]): AnimeSummary[] => {
  const ids = new Set<number>()
  return pages.flatMap((page) => page.items.filter((anime) => {
    if (ids.has(anime.anilistId)) {
      return false
    }
    ids.add(anime.anilistId)
    return true
  }))
}

/** Renders a display-only search card and resets image failure for a new URL. */
function SearchResultCard({ anime }: SearchResultCardProps) {
  const [hasImageError, setHasImageError] = useState(false)
  const imageUrl = anime.coverImageUrl

  useEffect(() => {
    setHasImageError(false)
  }, [imageUrl])

  return <article className="flex min-w-0 gap-3 rounded-lg border border-border bg-card p-3"><div className="h-20 w-14 shrink-0 overflow-hidden rounded bg-muted">{imageUrl !== null && !hasImageError ? <img className="size-full object-cover" src={imageUrl} alt={`${anime.titles.display} cover`} onError={() => setHasImageError(true)} /> : <span className="flex size-full flex-col items-center justify-center gap-1 text-center text-[10px] text-muted-foreground"><ImageOff aria-hidden="true" className="size-4" />Image unavailable</span>}</div><div className="min-w-0"><h3 className="truncate font-bold">{anime.titles.display}</h3><p className="mt-1 text-sm text-muted-foreground">{anime.format?.replaceAll('_', ' ') ?? 'Anime'} · {anime.seasonYear ?? 'TBA'}</p><p className="mt-1 truncate text-xs text-muted-foreground">{anime.genres.join(' · ')}</p></div></article>
}

/** Uses guarded infinite pagination for a valid URL search/filter state. */
export function DiscoverSearchResults({ searchState }: DiscoverSearchResultsProps) {
  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  const nextPageGuard = useRef({ searchKey: '', isPending: false })
  const enabled = hasValidSearchCriteria(searchState)
  const searchKey = JSON.stringify(searchState)
  if (nextPageGuard.current.searchKey !== searchKey) {
    nextPageGuard.current = { searchKey, isPending: false }
  }
  const query = useInfiniteQuery({
    queryKey: ['discover-search', searchState],
    queryFn: async ({ pageParam }) => await searchAnime({ data: { ...searchState, page: pageParam } }),
    initialPageParam: 1,
    getNextPageParam: (page) => page.hasNextPage ? page.currentPage + 1 : undefined,
    enabled,
  })
  const requestNextPage = useCallback((): void => {
    const guard = nextPageGuard.current
    if (guard.searchKey !== searchKey || guard.isPending || !query.hasNextPage) {
      return
    }
    guard.isPending = true
    void query.fetchNextPage().finally(() => {
      if (nextPageGuard.current.searchKey === searchKey) {
        nextPageGuard.current.isPending = false
      }
    })
  }, [query.fetchNextPage, query.hasNextPage, searchKey])

  useEffect(() => {
    const target = loadMoreRef.current
    if (target === null || !query.hasNextPage || typeof IntersectionObserver === 'undefined') {
      return undefined
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        requestNextPage()
      }
    }, { rootMargin: '240px' })
    observer.observe(target)
    return () => observer.disconnect()
  }, [query.hasNextPage, requestNextPage])

  if (!enabled) {
    return null
  }
  if (query.isPending) {
    return <section aria-label="Search results loading" className="grid gap-3 sm:grid-cols-2"><div className="h-28 animate-pulse motion-reduce:animate-none rounded-lg bg-muted" /><div className="h-28 animate-pulse motion-reduce:animate-none rounded-lg bg-muted" /></section>
  }
  if (query.isError && query.data === undefined) {
    return <section role="alert" className="rounded-lg border border-destructive/50 bg-destructive/10 p-4"><p>{getSearchFailureMessage(query.error, false)}</p><button className="mt-3 rounded-md border border-border px-3 py-2 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" type="button" onClick={() => void query.refetch()}>Retry search</button></section>
  }

  const items = dedupeSearchResults(query.data.pages)
  if (items.length === 0) {
    return <section className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">No anime matched these filters.</section>
  }

  return <section aria-labelledby="search-results-heading" className="space-y-3"><h2 id="search-results-heading" className="text-xl font-extrabold">Search results</h2><div className="grid gap-3 sm:grid-cols-2">{items.map((anime) => <SearchResultCard anime={anime} key={anime.anilistId} />)}</div>{query.isFetchNextPageError ? <div role="status" className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm"><p>{getSearchFailureMessage(query.error, true)}</p><button className="mt-2 rounded-md border border-border px-3 py-2 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-cyan-300" type="button" onClick={requestNextPage}>Retry loading more</button></div> : null}{query.hasNextPage ? <div ref={loadMoreRef} className="flex justify-center py-2"><button className="rounded-md border border-border px-4 py-2 text-sm font-semibold outline-none transition hover:bg-muted focus-visible:ring-2 focus-visible:ring-cyan-300" type="button" disabled={query.isFetchingNextPage} onClick={requestNextPage}>{query.isFetchingNextPage ? <><LoaderCircle aria-hidden="true" className="mr-2 inline size-4 animate-spin motion-reduce:animate-none" />Loading more</> : 'Load more'}</button></div> : <p className="text-center text-sm text-muted-foreground">End of results.</p>}</section>
}
