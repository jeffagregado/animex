import { useCallback, useEffect, useRef } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'

import { searchCatalogPeople } from '../server/catalog-person.functions'
import type {
  CatalogPersonKind,
  CatalogPersonSearchPage,
  CatalogPersonSearchRow,
} from '../shared/catalog-person-contracts'

interface CatalogPersonSearchPages {
  error: Error | null
  hasMore: boolean
  initialLoading: boolean
  items: CatalogPersonSearchRow[]
  loadMore: () => Promise<void>
  loadingMore: boolean
  nextPageError: boolean
  retryInitial: () => Promise<unknown>
}

/** Loads and deduplicates ordered Character or Staff search pages. */
export function useCatalogPersonSearchPages(
  kind: CatalogPersonKind,
  queryText: string,
  enabled: boolean,
): CatalogPersonSearchPages {
  const sentinelContinuation = useRef<string | null>(null)
  const guard = useRef<{ scope: string; token: symbol } | null>(null)
  const scope = `${kind}:${queryText}`

  const query = useInfiniteQuery({
    queryKey: ['catalog-person-search', kind, queryText],
    initialPageParam: 1,
    queryFn: async ({ pageParam }): Promise<CatalogPersonSearchPage> => (
      await searchCatalogPeople({ data: { kind, query: queryText, page: pageParam } })
    ),
    getNextPageParam: (lastPage) => (
      lastPage.hasNextPage ? lastPage.currentPage + 1 : undefined
    ),
    enabled,
  })

  const loadMore = useCallback(async (): Promise<void> => {
    if (!query.hasNextPage || guard.current?.scope === scope) return
    const token = Symbol(scope)
    guard.current = { scope, token }
    try {
      await query.fetchNextPage({ cancelRefetch: false })
    } finally {
      if (guard.current?.token === token) guard.current = null
    }
  }, [query.fetchNextPage, query.hasNextPage, scope])

  const pages = query.data?.pages
  const items = dedupePeople(pages ?? [])

  useEffect(() => {
    guard.current = null
    sentinelContinuation.current = null
  }, [scope])

  useEffect(() => {
    const lastPage = pages?.at(-1)
    if (
      !lastPage
      || !query.hasNextPage
      || query.isFetchNextPageError
      || countNewPeople(pages ?? []) > 0
    ) return
    const key = `${scope}:${lastPage.currentPage}`
    if (sentinelContinuation.current === key) return
    sentinelContinuation.current = key
    void loadMore()
  }, [loadMore, pages, query.hasNextPage, query.isFetchNextPageError, scope])

  return {
    error: query.error instanceof Error ? query.error : null,
    hasMore: query.hasNextPage,
    initialLoading: query.isPending,
    items,
    loadMore,
    loadingMore: query.isFetchingNextPage,
    nextPageError: query.isFetchNextPageError,
    retryInitial: query.refetch,
  }
}

/** Keeps first provider occurrence across all pages. */
const dedupePeople = (pages: CatalogPersonSearchPage[]): CatalogPersonSearchRow[] => {
  const ids = new Set<number>()
  return pages.flatMap((page) => page.items.filter((item) => {
    if (ids.has(item.id)) return false
    ids.add(item.id)
    return true
  }))
}

/** Counts identities introduced by the latest page. */
const countNewPeople = (pages: CatalogPersonSearchPage[]): number => {
  const lastPage = pages.at(-1)
  if (!lastPage) return 0
  const known = new Set(pages.slice(0, -1).flatMap((page) => page.items.map((item) => item.id)))
  return lastPage.items.filter((item, index) => (
    !known.has(item.id)
    && lastPage.items.findIndex((candidate) => candidate.id === item.id) === index
  )).length
}
