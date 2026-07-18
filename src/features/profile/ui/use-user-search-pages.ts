import { useCallback, useEffect, useRef } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'

import { searchUsers } from '../server/user-search.functions'
import type {
  UserSearchPage,
  UserSearchRow,
} from '../shared/user-search-contracts'

export type { UserSearchRow } from '../shared/user-search-contracts'

/** Loads authenticated identity-only User search pages. */
export function useUserSearchPages(queryText: string, enabled: boolean) {
  const continuation = useRef<string | null>(null)
  const guard = useRef<{ scope: string; token: symbol } | null>(null)
  const cursorHistoryRef = useRef<{
    cursors: Set<string | null>
    scope: string
  }>({ cursors: new Set(), scope: queryText })
  const query = useInfiniteQuery({
    queryKey: ['user-search', queryText],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }): Promise<UserSearchPage> => {
      if (cursorHistoryRef.current.scope !== queryText) {
        cursorHistoryRef.current = { cursors: new Set(), scope: queryText }
      }
      const successfulCursors = cursorHistoryRef.current.cursors
      if (pageParam === null) successfulCursors.clear()
      const result = await searchUsers({
        data: { query: queryText, cursor: pageParam },
      })
      if (
        !result.isDone
        && (
          result.continueCursor.length === 0
          || result.continueCursor === pageParam
          || successfulCursors.has(result.continueCursor)
        )
      ) throw new Error('User search returned an invalid pagination cursor.')
      successfulCursors.add(pageParam)
      return result
    },
    getNextPageParam: (lastPage) => (
      lastPage.isDone ? undefined : lastPage.continueCursor
    ),
    enabled,
  })
  const pageParams = query.data?.pageParams
  for (const pageParam of pageParams ?? []) {
    if (pageParam !== null && typeof pageParam !== 'string') {
      throw new TypeError('User search cached an invalid pagination cursor.')
    }
  }
  const loadMore = useCallback(async (): Promise<void> => {
    if (!query.hasNextPage || guard.current?.scope === queryText) return
    const token = Symbol(queryText)
    guard.current = { scope: queryText, token }
    try {
      await query.fetchNextPage({ cancelRefetch: false })
    } finally {
      if (guard.current?.token === token) guard.current = null
    }
  }, [query.fetchNextPage, query.hasNextPage, queryText])
  const pages = query.data?.pages
  const items = dedupeUsers(pages ?? [])

  useEffect(() => {
    const cursors = new Set<string | null>()
    for (const pageParam of pageParams ?? []) {
      if (pageParam !== null && typeof pageParam !== 'string') {
        throw new TypeError('User search cached an invalid pagination cursor.')
      }
      cursors.add(pageParam)
    }
    guard.current = null
    continuation.current = null
    cursorHistoryRef.current = {
      cursors,
      scope: queryText,
    }
  }, [pageParams, queryText])
  useEffect(() => {
    const lastPage = pages?.at(-1)
    if (
      !lastPage
      || !query.hasNextPage
      || query.isFetchNextPageError
      || countNewUsers(pages ?? []) > 0
    ) return
    const key = `${queryText}:${lastPage.continueCursor}`
    if (continuation.current === key) return
    continuation.current = key
    void loadMore()
  }, [loadMore, pages, query.hasNextPage, query.isFetchNextPageError, queryText])

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

const dedupeUsers = (pages: UserSearchPage[]): UserSearchRow[] => {
  const ids = new Set<string>()
  return pages.flatMap((page) => page.page.filter((user) => {
    if (ids.has(user.id)) return false
    ids.add(user.id)
    return true
  }))
}

const countNewUsers = (pages: UserSearchPage[]): number => {
  const lastPage = pages.at(-1)
  if (!lastPage) return 0
  const known = new Set(pages.slice(0, -1).flatMap((page) => page.page.map((user) => user.id)))
  return lastPage.page.filter((user, index) => (
    !known.has(user.id)
    && lastPage.page.findIndex((candidate) => candidate.id === user.id) === index
  )).length
}
