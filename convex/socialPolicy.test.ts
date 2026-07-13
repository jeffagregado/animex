import { describe, expect, test } from 'vitest'

import {
  assertImageMetadata,
  assertRequestId,
  assertStoredImageMetadata,
  canReadSocialRecord,
  decodeReviewCursor,
  encodeReviewCursor,
  mergeReviewPage,
  normalizePostContent,
  transitionReviewAggregate,
} from './socialPolicy'

describe('social policy', () => {
  test('keeps followers and private records owner-only in Phase 5', () => {
    expect(canReadSocialRecord('public', 'viewer', 'owner')).toBe(true)
    expect(canReadSocialRecord('followers', 'owner', 'owner')).toBe(true)
    expect(canReadSocialRecord('followers', 'viewer', 'owner')).toBe(false)
    expect(canReadSocialRecord('private', null, 'owner')).toBe(false)
  })

  test('validates post content and upload metadata', () => {
    expect(normalizePostContent('  hello  ', ['a'])).toEqual({ text: 'hello', imageIds: ['a'] })
    expect(() => normalizePostContent('', [])).toThrow('text or at least one image')
    expect(() => assertImageMetadata('image/svg+xml', 10)).toThrow('JPEG, PNG, WebP, or GIF')
    expect(() => assertImageMetadata('image/gif', 5 * 1024 * 1024 + 1)).toThrow('5 MiB')
    expect(() => assertStoredImageMetadata(null, 5, 'image/png', 5)).toThrow('content type')
    expect(() => assertStoredImageMetadata('image/jpeg', 5, 'image/png', 5)).toThrow('does not match')
    expect(() => assertStoredImageMetadata('image/png', 6, 'image/png', 5)).toThrow('does not match')
    expect(assertStoredImageMetadata('image/png', 5, 'image/png', 5)).toEqual({ mimeType: 'image/png', size: 5 })
  })

  test('rejects blank and oversized request or claim IDs', () => {
    expect(assertRequestId('  request-1  ')).toBe('request-1')
    expect(() => assertRequestId('   ')).toThrow('non-empty')
    expect(() => assertRequestId('x'.repeat(129))).toThrow('128')
  })

  test('computes exact public aggregate deltas for Review transitions', () => {
    expect(transitionReviewAggregate(null, { public: true, rating: 90 })).toEqual({ count: 1, ratingSum: 90, bandDeltas: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0] })
    expect(transitionReviewAggregate({ public: true, rating: 90 }, { public: true, rating: 0 })).toEqual({ count: 0, ratingSum: -90, bandDeltas: [-1, 0, 0, 0, 0, 0, 0, 0, 0, 1] })
    expect(transitionReviewAggregate({ public: true, rating: 0 }, null)).toEqual({ count: -1, ratingSum: 0, bandDeltas: [0, 0, 0, 0, 0, 0, 0, 0, 0, -1] })
  })

  test('maps every Review Rating boundary into ten descending bands', () => {
    const ratings = [100, 90, 89.9, 80, 79.9, 70, 69.9, 60, 59.9, 50, 49.9, 40, 39.9, 30, 29.9, 20, 19.9, 10, 9.9, 0]
    ratings.forEach((rating, index) => {
      const expectedBand = Math.floor(index / 2)
      const delta = transitionReviewAggregate(null, { public: true, rating })
      expect(delta.bandDeltas[expectedBand]).toBe(1)
      expect(delta.bandDeltas.reduce((sum, value) => sum + value, 0)).toBe(1)
    })
  })

  test('binds opaque Review cursors to viewer, anime, and sort', () => {
    const cursor = encodeReviewCursor({ viewerId: 'viewer', anilistId: 1, sort: 'newest', publicAnchor: 'p12', ownPending: true })
    expect(decodeReviewCursor(cursor, 'viewer', 1, 'newest')).toEqual({ publicAnchor: 'p12', ownPending: true })
    expect(() => decodeReviewCursor(cursor, 'other', 1, 'newest')).toThrow('viewer')
    expect(() => decodeReviewCursor(cursor, 'viewer', 2, 'newest')).toThrow('anime')
    expect(() => decodeReviewCursor(cursor, 'viewer', 1, 'rating-high')).toThrow('sort')
    expect(() => decodeReviewCursor('forged', 'viewer', 1, 'newest')).toThrow('cursor')
  })

  test('paginates one pending private Review exactly once at sort boundaries', () => {
    const publicItems = Array.from({ length: 13 }, (_, index) => ({ key: String(index + 1).padStart(2, '0'), value: `p${index + 1}` }))
    const middle = mergeReviewPage(publicItems, { key: '06.5', value: 'own' }, 12, true)
    expect(middle.items).toContain('own')
    expect(middle.items).toHaveLength(12)
    expect(middle).toMatchObject({ publicConsumed: 11, ownPending: false })

    const boundary = mergeReviewPage(publicItems, { key: '12.5', value: 'own' }, 12, true)
    expect(boundary.items).not.toContain('own')
    expect(boundary).toMatchObject({ publicConsumed: 12, ownPending: true })
    const next = mergeReviewPage(publicItems.slice(12), { key: '12.5', value: 'own' }, 12, boundary.ownPending)
    expect(next.items.filter((item) => item === 'own')).toHaveLength(1)

    const noOwnAgain = mergeReviewPage(publicItems.slice(12), { key: '12.5', value: 'own' }, 12, false)
    expect(noOwnAgain.items).not.toContain('own')
  })
})
