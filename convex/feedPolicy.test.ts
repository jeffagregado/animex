import { describe, expect, test } from 'vitest'

import { decodeFeedCursor, encodeFeedCursor, makeOrderKey } from './feedPolicy'

describe('feed policy', () => {
  test('orders equal timestamps by stable source key', () => {
    expect(makeOrderKey(100, 'a')).not.toBe(makeOrderKey(100, 'b'))
    expect(makeOrderKey(101, 'z') < makeOrderKey(100, 'a')).toBe(true)
  })

  test('round-trips a view and viewer-bound composite cursor', () => {
    const cursor = encodeFeedCursor({ view: 'home', viewerId: 'viewer', prioritizedAnchor: 'p', globalAnchor: 'g', cycleIndex: 2 })
    expect(decodeFeedCursor(cursor, 'home', 'viewer')).toEqual({ prioritizedAnchor: 'p', globalAnchor: 'g', cycleIndex: 2 })
    expect(() => decodeFeedCursor(cursor, 'global', 'viewer')).toThrow('view')
    expect(() => decodeFeedCursor(cursor, 'home', 'other')).toThrow('viewer')
    expect(() => decodeFeedCursor('forged', 'home', 'viewer')).toThrow('cursor')
  })
})
