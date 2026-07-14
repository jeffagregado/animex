import { describe, expect, it } from 'vitest'

import type { FeedCard, FeedPage } from '../social/shared/social-contracts'
import { appendFeedPage, createFeedState } from './feed-state'

const card = (id: string): FeedCard => ({
  id,
  kind: 'post',
  author: { id: 'author', username: 'author', displayName: 'Author', avatarUrl: null },
  createdAt: 1,
  updatedAt: 1,
  postId: `post-${id}`,
  text: id,
  media: null,
  hasSpoiler: false,
  visibility: 'public',
})

describe('feed pagination state', () => {
  it('appends pages by card ID and preserves opaque cursor state', () => {
    const first: FeedPage<FeedCard> = { items: [card('one'), card('two')], cursor: 'next', hasMore: true }
    const second: FeedPage<FeedCard> = { items: [card('two'), card('three')], cursor: null, hasMore: false }

    const state = appendFeedPage(appendFeedPage(createFeedState(), first), second)

    expect(state.items.map((item) => item.id)).toEqual(['one', 'two', 'three'])
    expect(state.cursor).toBeNull()
    expect(state.hasMore).toBe(false)
  })
})
