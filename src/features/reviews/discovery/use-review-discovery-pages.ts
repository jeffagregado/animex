import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useConvex } from 'convex/react'

import { api } from '../../../../convex/_generated/api'
import {
  reviewDiscoveryPageSchema,
  type ReviewDiscoveryInput,
} from '../shared/review-discovery-contracts'
import type { ReviewListItem } from '../../social/shared/social-contracts'

interface ScopedReviewState {
  scope: string
  items: ReviewListItem[]
  cursor: string | null
  hasMore: boolean
  loading: boolean
  error: string | null
}

export interface ReviewDiscoveryPageState {
  items: ReviewListItem[]
  cursor: string | null
  hasMore: boolean
  error: string | null
  initialLoading: boolean
  loadingMore: boolean
  loadMore: () => Promise<void>
  retry: () => Promise<void>
}

const emptyScope = (scope: string, enabled: boolean): ScopedReviewState => ({
  scope, items: [], cursor: null, hasMore: false, loading: enabled, error: null,
})

const appendUnique = (current: ReviewListItem[], next: ReviewListItem[]): ReviewListItem[] => {
  const ids = new Set(current.map((item) => item.id))
  return [...current, ...next.filter((item) => !ids.has(item.id) && ids.add(item.id))]
}

/** Loads scope-isolated Review cursor pages after auth normalization. */
export function useReviewDiscoveryPages(
  input: Omit<ReviewDiscoveryInput, 'cursor'>,
  authKey: string,
  enabled: boolean,
): ReviewDiscoveryPageState {
  const client = useConvex()
  const scope = JSON.stringify([authKey, input.query, input.sort, input.ratingBand, input.visibility])
  const scopeRef = useRef(scope)
  const epochRef = useRef(0)
  const pendingRef = useRef(new Map<string, Promise<void>>())
  const [state, setState] = useState<ScopedReviewState>(() => emptyScope(scope, enabled))
  const visible = state.scope === scope ? state : emptyScope(scope, enabled)

  useLayoutEffect(() => {
    if (scopeRef.current === scope) return
    scopeRef.current = scope
    epochRef.current += 1
    pendingRef.current.clear()
    setState(emptyScope(scope, enabled))
  }, [enabled, scope])

  const load = (cursor: string | null, replace: boolean): Promise<void> => {
    if (!enabled) return Promise.resolve()
    const epoch = epochRef.current
    const requestKey = `${epoch}:${cursor ?? 'initial'}`
    const pending = pendingRef.current.get(requestKey)
    if (pending) return pending
    setState((current) => replace || current.scope !== scope
      ? emptyScope(scope, true)
      : { ...current, loading: true, error: null })
    const request = client.query(api.reviews.listDiscovery, { ...input, cursor }).then((raw) => {
      if (epochRef.current !== epoch || scopeRef.current !== scope) return
      const page = reviewDiscoveryPageSchema.parse(raw)
      setState((current) => ({
        scope,
        items: replace || current.scope !== scope ? appendUnique([], page.items) : appendUnique(current.items, page.items),
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
        error: cause instanceof Error ? cause.message : 'Reviews could not be loaded.',
      }))
    }).finally(() => {
      if (pendingRef.current.get(requestKey) === request) pendingRef.current.delete(requestKey)
    })
    pendingRef.current.set(requestKey, request)
    return request
  }

  useEffect(() => {
    if (!enabled) return
    void load(null, true)
  }, [client, enabled, scope])

  return {
    items: visible.items,
    cursor: visible.cursor,
    hasMore: visible.hasMore,
    error: visible.error,
    initialLoading: visible.loading && visible.items.length === 0,
    loadingMore: visible.loading && visible.items.length > 0,
    loadMore: (): Promise<void> => load(visible.cursor, false),
    retry: (): Promise<void> => load(visible.items.length === 0 ? null : visible.cursor, visible.items.length === 0),
  }
}
