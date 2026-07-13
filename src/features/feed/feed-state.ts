import type { FeedCard, FeedPage } from '../social/shared/social-contracts'

export interface FeedState {
  items: FeedCard[]
  cursor: string | null
  hasMore: boolean
}

/** Creates empty manual cursor state. */
export const createFeedState = (): FeedState => ({ items: [], cursor: null, hasMore: true })

/** Appends one strict page while deduplicating by feed-card ID. */
export const appendFeedPage = (state: FeedState, page: FeedPage<FeedCard>): FeedState => {
  const seen = new Set(state.items.map((item) => item.id))
  const appended = page.items.filter((item) => !seen.has(item.id))
  return { items: [...state.items, ...appended], cursor: page.cursor, hasMore: page.hasMore }
}
