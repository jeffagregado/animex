import { describe, expect, test } from 'vitest'

import { mergeFeedCards } from './feed-ranking'
import type { FeedCard } from './social-contracts'

const card = (id: string): FeedCard => ({
  id,
  kind: 'post',
  author: { id: `author-${id}`, username: id, displayName: id, avatarUrl: null },
  text: id,
  imageUrls: [],
  hasSpoiler: false,
  visibility: 'public',
  createdAt: 1,
  updatedAt: 1,
})

describe('feed ranking', () => {
  test('merges stable two-prioritized then one-global groups without mutating inputs', () => {
    const prioritized = [card('p1'), card('p2'), card('p3'), card('p4')]
    const global = [card('g1'), card('g2')]
    const prioritizedSnapshot = structuredClone(prioritized)
    const globalSnapshot = structuredClone(global)

    const result = mergeFeedCards(prioritized, global, 6)
    expect(result.items.map(({ id }) => id)).toEqual(['p1', 'p2', 'g1', 'p3', 'p4', 'g2'])
    expect(result).toMatchObject({ prioritizedConsumed: 4, globalConsumed: 2 })
    expect(prioritized).toEqual(prioritizedSnapshot)
    expect(global).toEqual(globalSnapshot)
  })

  test('deduplicates by card ID and fills from either short stream', () => {
    const deduplicated = mergeFeedCards([card('same'), card('p2')], [card('same'), card('g2'), card('g3')], 4)
    expect(deduplicated.items.map(({ id }) => id)).toEqual(['same', 'p2', 'g2', 'g3'])
    expect(deduplicated).toMatchObject({ prioritizedConsumed: 2, globalConsumed: 3 })
    expect(mergeFeedCards([], [card('g1'), card('g2')], 2).items.map(({ id }) => id)).toEqual(['g1', 'g2'])
    expect(mergeFeedCards([card('p1'), card('p2')], [], 2).items.map(({ id }) => id)).toEqual(['p1', 'p2'])
  })

  test('does not consume prefetched candidates beyond a full page', () => {
    const result = mergeFeedCards([card('p1'), card('p2'), card('p3')], [card('g1'), card('g2')], 3)

    expect(result.items.map(({ id }) => id)).toEqual(['p1', 'p2', 'g1'])
    expect(result).toMatchObject({ prioritizedConsumed: 2, globalConsumed: 1 })
  })

  test('requires an explicit positive limit no greater than feed page size', () => {
    expect(() => mergeFeedCards([], [], 0)).toThrow(RangeError)
    expect(() => mergeFeedCards([], [], 21)).toThrow(RangeError)
    expect(() => mergeFeedCards([], [], 1.5)).toThrow(RangeError)
  })
})
