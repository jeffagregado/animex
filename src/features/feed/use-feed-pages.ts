import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useConvex } from 'convex/react'

import { api } from '../../../convex/_generated/api'
import { feedPageSchema, type FeedCard } from '../social/shared/social-contracts'
import { appendFeedPage, createFeedState } from './feed-state'

export type FeedView = 'home' | 'global'

interface ScopedFeedState {
  scope: string
  items: FeedCard[]
  cursor: string | null
  hasMore: boolean
  loading: boolean
  error: string | null
}

const emptyScope = (scope: string): ScopedFeedState => ({ scope, ...createFeedState(), loading: true, error: null })
const feedQuery = (view: FeedView) =>
  view === 'home' ? api.feed.listHome : api.feed.listGlobal

/** Loads explicit cursor pages with auth/view race isolation. */
export function useFeedPages(view: FeedView, authKey: string) {
  const client = useConvex()
  const scope = `${authKey}:${view}`
  const scopeRef = useRef(scope)
  const epochRef = useRef(0)
  const pendingRef = useRef(new Map<string, Promise<void>>())
  const [state, setState] = useState<ScopedFeedState>(() => emptyScope(scope))
  const visible = state.scope === scope ? state : emptyScope(scope)

  useLayoutEffect(() => {
    if (scopeRef.current === scope) return
    scopeRef.current = scope
    epochRef.current += 1
    pendingRef.current.clear()
    setState(emptyScope(scope))
  }, [scope])

  const load = (cursor: string | null, replace: boolean, advanceEpoch: boolean): Promise<void> => {
    if (advanceEpoch) { epochRef.current += 1; pendingRef.current.clear() }
    const epoch = epochRef.current
    const requestKey = `${epoch}:${cursor ?? 'initial'}`
    const existing = pendingRef.current.get(requestKey)
    if (existing) return existing
    setState((current) => replace || current.scope !== scope ? emptyScope(scope) : { ...current, loading: true, error: null })
    const request = client.query(feedQuery(view), { cursor }).then((raw) => {
      if (epochRef.current !== epoch || scopeRef.current !== scope) return
      const page = feedPageSchema.parse(raw)
      if (page.items.length === 0 && page.hasMore) {
        if (page.cursor === null || page.cursor === cursor) throw new Error('Feed pagination returned a repeated cursor.')
        return load(page.cursor, false, false)
      }
      setState((current) => {
        const base = replace || current.scope !== scope ? createFeedState() : current
        return { scope, ...appendFeedPage(base, page), loading: false, error: null }
      })
    }).catch((cause: unknown) => {
      if (epochRef.current !== epoch || scopeRef.current !== scope) return
      setState((current) => ({ ...(current.scope === scope ? current : emptyScope(scope)), loading: false, error: cause instanceof Error ? cause.message : 'Feed could not be loaded.' }))
    }).finally(() => {
      if (pendingRef.current.get(requestKey) === request) pendingRef.current.delete(requestKey)
    })
    pendingRef.current.set(requestKey, request)
    return request
  }

  useEffect(() => { void load(null, true, false) }, [client, scope])

  return {
    items: visible.items,
    cursor: visible.cursor,
    hasMore: visible.hasMore,
    error: visible.error,
    initialLoading: visible.loading && visible.items.length === 0,
    loadingMore: visible.loading && visible.items.length > 0,
    loadMore: (): Promise<void> => load(visible.cursor, false, false),
    retry: (): Promise<void> => load(visible.items.length === 0 ? null : visible.cursor, false, false),
    refresh: (): Promise<void> => load(null, true, true),
  }
}
