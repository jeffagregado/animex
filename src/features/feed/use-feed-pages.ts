import { useEffect, useState } from 'react'
import { useConvex } from 'convex/react'

import { api } from '../../../convex/_generated/api'
import { feedPageSchema } from '../social/shared/social-contracts'
import { appendFeedPage, createFeedState } from './feed-state'

export type FeedView = 'home' | 'following' | 'global'

const feedQuery = (view: FeedView) => {
  if (view === 'home') return api.feed.listHome
  if (view === 'following') return api.feed.listFollowing
  return api.feed.listGlobal
}

/** Loads explicit opaque-cursor pages and retains prior cards on failure. */
export function useFeedPages(view: FeedView) {
  const client = useConvex()
  const [state, setState] = useState(createFeedState)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async (cursor: string | null): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const raw = await client.query(feedQuery(view), { cursor })
      const page = feedPageSchema.parse(raw)
      setState((current) => cursor === null ? appendFeedPage(createFeedState(), page) : appendFeedPage(current, page))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Feed could not be loaded.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setState(createFeedState())
    void load(null)
  }, [client, view])

  return {
    ...state,
    error,
    initialLoading: loading && state.items.length === 0,
    loadingMore: loading && state.items.length > 0,
    loadMore: (): Promise<void> => load(state.cursor),
    retry: (): Promise<void> => load(state.items.length === 0 ? null : state.cursor),
    refresh: (): Promise<void> => load(null),
  }
}
