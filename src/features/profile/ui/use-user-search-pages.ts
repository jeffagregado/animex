import { useCallback, useEffect, useRef } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useConvex } from 'convex/react'
import { makeFunctionReference } from 'convex/server'
import { z } from 'zod'

export interface UserSearchRow {
  avatarUrl: string | null
  id: string
  name: string
  username: string
}

interface UserSearchResult {
  continueCursor: string
  isDone: boolean
  page: UserSearchRow[]
}

const resultSchema: z.ZodType<UserSearchResult> = z.object({
  page: z.array(z.object({
    id: z.string().min(1),
    username: z.string().trim().min(1),
    name: z.string().trim().min(1),
    avatarUrl: z.string().url().nullable(),
  }).strict()).max(20),
  continueCursor: z.string(),
  isDone: z.boolean(),
}).strict()

const searchUsersRef = makeFunctionReference<
  'query',
  { query: string; paginationOpts: { cursor: string | null; numItems: 20 } },
  UserSearchResult
>('userSearch:search')

/** Loads authenticated identity-only User search pages. */
export function useUserSearchPages(queryText: string, enabled: boolean) {
  const convex = useConvex()
  const continuation = useRef<string | null>(null)
  const guard = useRef<{ scope: string; token: symbol } | null>(null)
  if (guard.current !== null && guard.current.scope !== queryText) guard.current = null
  const query = useInfiniteQuery({
    queryKey: ['user-search', queryText],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }): Promise<UserSearchResult> => {
      const raw = await convex.query(searchUsersRef, {
        query: queryText,
        paginationOpts: { cursor: pageParam, numItems: 20 },
      })
      const result = resultSchema.parse(raw)
      if (
        !result.isDone
        && (result.continueCursor.length === 0 || result.continueCursor === pageParam)
      ) throw new Error('User search returned an invalid pagination cursor.')
      return result
    },
    getNextPageParam: (lastPage) => (
      lastPage.isDone ? undefined : lastPage.continueCursor
    ),
    enabled,
  })
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
  const pages = query.data?.pages ?? []
  const items = dedupeUsers(pages)

  useEffect(() => {
    continuation.current = null
  }, [queryText])
  useEffect(() => {
    const lastPage = pages.at(-1)
    if (
      !lastPage
      || !query.hasNextPage
      || query.isFetchNextPageError
      || countNewUsers(pages) > 0
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

const dedupeUsers = (pages: UserSearchResult[]): UserSearchRow[] => {
  const ids = new Set<string>()
  return pages.flatMap((page) => page.page.filter((user) => {
    if (ids.has(user.id)) return false
    ids.add(user.id)
    return true
  }))
}

const countNewUsers = (pages: UserSearchResult[]): number => {
  const lastPage = pages.at(-1)
  if (!lastPage) return 0
  const known = new Set(pages.slice(0, -1).flatMap((page) => page.page.map((user) => user.id)))
  return lastPage.page.filter((user, index) => (
    !known.has(user.id)
    && lastPage.page.findIndex((candidate) => candidate.id === user.id) === index
  )).length
}
