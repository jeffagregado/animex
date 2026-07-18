import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import {
  parseProfileContentPage,
  type ProfileFavorite,
  type ProfileTab,
} from '../shared/profile-contracts'
import { getProfileContentPage } from '../server/profile-read.functions'
import {
  type FeedCard,
  type ReviewListItem,
} from '../../social/shared/social-contracts'

interface CursorPage<T> {
  items: T[]
  cursor: string | null
  hasMore: boolean
}

export interface ProfilePageState<T> extends CursorPage<T> {
  error: string | null
  initialLoading: boolean
  loadingMore: boolean
  loadMore: () => Promise<void>
  retry: () => Promise<void>
}

type ProfilePageItem = FeedCard | ReviewListItem | ProfileFavorite
interface ScopedPageState extends CursorPage<ProfilePageItem> {
  scope: string
  loading: boolean
  error: string | null
}

const emptyScope = (scope: string, enabled: boolean): ScopedPageState => ({
  scope,
  items: [],
  cursor: null,
  hasMore: false,
  loading: enabled,
  error: null,
})

/** Returns one stable identity for cursor merge deduplication. */
const getItemId = (item: ProfilePageItem): string => {
  if ('id' in item) return item.id
  return `anime:${item.anime.anilistId}`
}

/** Merges pages without repeating one document or canonical favorite. */
const appendUnique = (
  current: ProfilePageItem[],
  next: ProfilePageItem[],
): ProfilePageItem[] => {
  const ids = new Set(current.map(getItemId))
  return [
    ...current,
    ...next.filter((item) => {
      const id = getItemId(item)
      if (ids.has(id)) return false
      ids.add(id)
      return true
    }),
  ]
}

export function useProfilePages(
  username: string,
  tab: 'activity',
  enabled: boolean,
): ProfilePageState<FeedCard>
export function useProfilePages(
  username: string,
  tab: 'reviews',
  enabled: boolean,
): ProfilePageState<ReviewListItem>
export function useProfilePages(
  username: string,
  tab: 'favorites',
  enabled: boolean,
): ProfilePageState<ProfileFavorite>
export function useProfilePages(
  username: string,
  tab: ProfileTab,
  enabled: boolean,
): ProfilePageState<ProfilePageItem>
/** Loads profile content with scope isolation and per-cursor request dedupe. */
export function useProfilePages(
  username: string,
  tab: ProfileTab,
  enabled: boolean,
): ProfilePageState<ProfilePageItem> {
  const scope = `${username}:${tab}`
  const scopeRef = useRef(scope)
  const epochRef = useRef(0)
  const pendingRef = useRef(new Map<string, Promise<void>>())
  const [state, setState] = useState<ScopedPageState>(
    () => emptyScope(scope, enabled),
  )
  const visible = state.scope === scope ? state : emptyScope(scope, enabled)

  useLayoutEffect(() => {
    if (scopeRef.current === scope) return
    scopeRef.current = scope
    epochRef.current += 1
    pendingRef.current.clear()
    setState(emptyScope(scope, enabled))
  }, [enabled, scope])

  const queryPage = useCallback(async (
    cursor: string | null,
  ): Promise<CursorPage<ProfilePageItem>> => {
    const page = await getProfileContentPage({
      data: { username, cursor, tab },
    })
    if (tab === 'activity') return parseProfileContentPage('activity', page)
    if (tab === 'reviews') return parseProfileContentPage('reviews', page)
    return parseProfileContentPage('favorites', page)
  }, [tab, username])

  const load = useCallback((
    cursor: string | null,
    replace: boolean,
  ): Promise<void> => {
    if (!enabled) return Promise.resolve()
    const epoch = epochRef.current
    const requestKey = `${epoch}:${cursor ?? 'initial'}`
    const pending = pendingRef.current.get(requestKey)
    if (pending) return pending
    setState((current) => replace || current.scope !== scope
      ? emptyScope(scope, true)
      : { ...current, loading: true, error: null })
    const request = queryPage(cursor).then((page) => {
      if (epochRef.current !== epoch || scopeRef.current !== scope) return
      if (page.hasMore && (page.cursor === null || page.cursor === cursor)) {
        throw new Error('Profile pagination returned a repeated cursor.')
      }
      setState((current) => ({
        scope,
        items: replace || current.scope !== scope
          ? appendUnique([], page.items)
          : appendUnique(current.items, page.items),
        cursor: page.cursor,
        hasMore: page.hasMore,
        loading: false,
        error: null,
      }))
    }).catch((cause: unknown) => {
      if (epochRef.current !== epoch || scopeRef.current !== scope) return
      setState((current) => ({
        ...(current.scope === scope ? current : emptyScope(scope, false)),
        loading: false,
        error: cause instanceof Error
          ? cause.message
          : 'Profile content could not be loaded.',
      }))
    }).finally(() => {
      if (pendingRef.current.get(requestKey) === request) {
        pendingRef.current.delete(requestKey)
      }
    })
    pendingRef.current.set(requestKey, request)
    return request
  }, [enabled, queryPage, scope])

  useEffect(() => {
    if (!enabled) return
    void load(null, true)
  }, [enabled, load])

  const loadMore = useCallback(
    () => load(visible.cursor, false),
    [load, visible.cursor],
  )
  const retry = useCallback(
    () => load(
      visible.items.length === 0 ? null : visible.cursor,
      visible.items.length === 0,
    ),
    [load, visible.cursor, visible.items.length],
  )

  return {
    items: visible.items,
    cursor: visible.cursor,
    hasMore: visible.hasMore,
    error: visible.error,
    initialLoading: visible.loading && visible.items.length === 0,
    loadingMore: visible.loading && visible.items.length > 0,
    loadMore,
    retry,
  }
}

/** Automatically requests visible next pages while preserving manual control. */
export function useProfileAutoLoad<T>(
  state: ProfilePageState<T>,
): React.RefObject<HTMLDivElement | null> {
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const requestedRef = useRef(false)

  useEffect(() => {
    if (!state.loadingMore) requestedRef.current = false
  }, [state.loadingMore])

  useEffect(() => {
    const target = sentinelRef.current
    if (
      target === null
      || !state.hasMore
      || state.error !== null
      || state.initialLoading
      || typeof IntersectionObserver === 'undefined'
    ) return
    const observer = new IntersectionObserver((entries) => {
      if (
        !entries.some((entry) => entry.isIntersecting)
        || requestedRef.current
        || state.loadingMore
      ) return
      requestedRef.current = true
      void state.loadMore().finally(() => {
        requestedRef.current = false
      })
    }, { rootMargin: '240px 0px' })
    observer.observe(target)
    return () => observer.disconnect()
  }, [
    state.error,
    state.hasMore,
    state.initialLoading,
    state.loadMore,
    state.loadingMore,
  ])

  return sentinelRef
}
