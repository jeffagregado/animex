import { useEffect, useRef, useState } from 'react'
import { useConvex } from 'convex/react'

import { api } from '../../../convex/_generated/api'
import { feedPageSchema, type FeedCard } from '../social/shared/social-contracts'
import { appendFeedPage, createFeedState } from './feed-state'

export type FeedView = 'home' | 'following' | 'global'

interface ScopedFeedState {
  scope: string
  items: FeedCard[]
  cursor: string | null
  hasMore: boolean
  loading: boolean
  error: string | null
}

const emptyScope = (scope: string): ScopedFeedState => ({ scope, ...createFeedState(), loading: true, error: null })

const feedQuery = (view: FeedView) => view === 'home' ? api.feed.listHome : view === 'following' ? api.feed.listFollowing : api.feed.listGlobal

/** Loads explicit cursor pages with auth/view race isolation. */
export function useFeedPages(view: FeedView, authKey: string) {
  const client = useConvex()
  const scope = `${authKey}:${view}`
  const scopeRef = useRef(scope)
  const generationRef = useRef(0)
  const pendingRef = useRef(new Map<string, Promise<void>>())
  const [state, setState] = useState<ScopedFeedState>(() => emptyScope(scope))
  if (scopeRef.current !== scope) {
    scopeRef.current = scope
    generationRef.current += 1
    pendingRef.current.clear()
  }
  const visible = state.scope === scope ? state : emptyScope(scope)

  const load = (cursor: string | null): Promise<void> => {
    const generation = generationRef.current
    const requestKey = `${generation}:${cursor ?? 'initial'}`
    const existing = pendingRef.current.get(requestKey)
    if (existing) return existing
    setState((current) => current.scope === scope ? { ...current, loading: true, error: null } : emptyScope(scope))
    const request = client.query(feedQuery(view), { cursor }).then((raw) => {
      if (generationRef.current !== generation || scopeRef.current !== scope) return
      const page = feedPageSchema.parse(raw)
      setState((current) => {
        const base = cursor === null || current.scope !== scope ? createFeedState() : current
        return { scope, ...appendFeedPage(base, page), loading: false, error: null }
      })
    }).catch((cause: unknown) => {
      if (generationRef.current !== generation || scopeRef.current !== scope) return
      setState((current) => ({ ...(current.scope === scope ? current : emptyScope(scope)), loading: false, error: cause instanceof Error ? cause.message : 'Feed could not be loaded.' }))
    }).finally(() => { pendingRef.current.delete(requestKey) })
    pendingRef.current.set(requestKey, request)
    return request
  }

  useEffect(() => { void load(null) }, [client, scope])

  return {
    items: visible.items,
    cursor: visible.cursor,
    hasMore: visible.hasMore,
    error: visible.error,
    initialLoading: visible.loading && visible.items.length === 0,
    loadingMore: visible.loading && visible.items.length > 0,
    loadMore: (): Promise<void> => load(visible.cursor),
    retry: (): Promise<void> => load(visible.items.length === 0 ? null : visible.cursor),
    refresh: (): Promise<void> => load(null),
  }
}
