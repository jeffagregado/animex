import { describe, expect, test } from 'vitest'

import {
  decodeReviewDiscoveryCursor,
  encodeReviewDiscoveryCursor,
  getStoredReviewRatingBand,
  mergeOrderedReviewLanes,
  normalizeReviewDiscoveryQuery,
  type ReviewDiscoveryCursorScope,
} from './reviewDiscoveryPolicy'

const scope: ReviewDiscoveryCursorScope = {
  viewerId: 'viewer',
  query: null,
  sort: 'newest',
  ratingBand: null,
  visibility: 'all',
}

describe('Review discovery policy', () => {
  test('maps decimal boundaries into every stored Rating band', () => {
    expect([
      100, 90, 89.9, 80, 79.9, 70, 69.9, 60, 59.9, 50,
      49.9, 40, 39.9, 30, 29.9, 20, 19.9, 10, 9.9, 0,
    ].map(getStoredReviewRatingBand)).toEqual([
      '90-100', '90-100', '80-89', '80-89', '70-79', '70-79', '60-69', '60-69', '50-59', '50-59',
      '40-49', '40-49', '30-39', '30-39', '20-29', '20-29', '10-19', '10-19', '0-9', '0-9',
    ])
    expect(getStoredReviewRatingBand(null)).toBe('none')
    expect(() => getStoredReviewRatingBand(100.1)).toThrow('between 0 and 100')
  })

  test('normalizes bounded search text', () => {
    expect(normalizeReviewDiscoveryQuery('  Frieren   Himmel  ')).toBe('frieren himmel')
    expect(() => normalizeReviewDiscoveryQuery('x')).toThrow('at least 2')
    expect(() => normalizeReviewDiscoveryQuery('x'.repeat(101))).toThrow('100')
  })

  test('scopes ordered cursor state to every access input', () => {
    const cursor = encodeReviewDiscoveryCursor({
      scope,
      state: {
        mode: 'ordered',
        lanes: {
          followers: { anchor: 'f', done: false },
          private: { anchor: null, done: true },
          public: { anchor: 'p', done: false },
        },
      },
    })

    expect(decodeReviewDiscoveryCursor(cursor, scope).state).toMatchObject({ mode: 'ordered' })
    expect(() => decodeReviewDiscoveryCursor(cursor, { ...scope, viewerId: null })).toThrow('viewer')
    expect(() => decodeReviewDiscoveryCursor(cursor, { ...scope, visibility: 'public' })).toThrow('visibility')
    expect(() => decodeReviewDiscoveryCursor(cursor, { ...scope, ratingBand: '90-100' })).toThrow('Rating band')
    expect(() => decodeReviewDiscoveryCursor(cursor, { ...scope, sort: 'rating-low' })).toThrow('sort')
    expect(() => decodeReviewDiscoveryCursor(cursor, { ...scope, query: 'frieren' })).toThrow('query')
  })

  test('round-trips Unicode cursor scope and continuation state for retries', () => {
    const unicodeScope = { ...scope, query: '葬送のフリーレン café' }
    const payload = {
      scope: unicodeScope,
      state: {
        mode: 'search' as const,
        phase: 'public' as const,
        cursors: { followers: null, private: null, public: '続き-カーソル' },
        done: { followers: true, private: true, public: false },
      },
    }

    const cursor = encodeReviewDiscoveryCursor(payload)
    expect(decodeReviewDiscoveryCursor(cursor, unicodeScope)).toEqual(payload)
    expect(decodeReviewDiscoveryCursor(cursor, unicodeScope)).toEqual(payload)
  })

  test('merges ordered lanes deterministically without duplicates', () => {
    const merged = mergeOrderedReviewLanes({
      followers: [{ key: '01', id: 'same' }, { key: '04', id: 'f' }],
      private: [{ key: '02', id: 'same' }, { key: '05', id: 'v' }],
      public: [{ key: '03', id: 'p' }],
    }, 4)

    expect(merged.items.map((item) => item.id)).toEqual(['same', 'p', 'f', 'v'])
    expect(merged.consumed).toEqual({ followers: 2, private: 2, public: 1 })
  })
})
