import { describe, expect, test } from 'vitest'

import {
  assertImageMetadata,
  assertRequestId,
  canReadSocialRecord,
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
})
