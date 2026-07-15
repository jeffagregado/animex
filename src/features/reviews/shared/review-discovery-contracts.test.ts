import { describe, expect, test } from 'vitest'

import {
  normalizeReviewDiscoveryVisibility,
  reviewDiscoveryCursorSchema,
  reviewDiscoveryInputSchema,
  reviewDiscoveryPageSchema,
  reviewDiscoveryQuerySchema,
  reviewDiscoveryRatingBandSchema,
  reviewDiscoverySortSchema,
  reviewDiscoveryVisibilitySchema,
  storedReviewRatingBandSchema,
} from './review-discovery-contracts'

const review = {
  anime: { anilistId: 1, coverImageUrl: null, slug: 'frieren', title: 'Frieren' },
  author: { avatarUrl: null, displayName: 'Fern', id: 'author-1', username: 'fern' },
  id: 'review-1',
  publishedAt: 100,
  rating: 95,
  state: 'published' as const,
  summary: 'Worth watching.',
  containsSpoiler: false,
  updatedAt: 100,
  visibility: 'public' as const,
}

const removedSpoilerField = ['summary', 'HasSpoiler'].join('')

describe('review discovery contracts', () => {
  test('trims a valid discovery query', () => {
    expect(reviewDiscoveryQuerySchema.parse('  Frieren  ')).toBe('Frieren')
  })

  test('requires queries from two through 100 characters after trimming', () => {
    expect(reviewDiscoveryQuerySchema.safeParse(' a ').success).toBe(false)
    expect(reviewDiscoveryQuerySchema.parse(` ${'a'.repeat(100)} `)).toHaveLength(100)
    expect(reviewDiscoveryQuerySchema.safeParse('a'.repeat(101)).success).toBe(false)
  })

  test('parses only approved sort, rating, storage, and visibility values', () => {
    expect(reviewDiscoverySortSchema.options).toEqual(['newest', 'rating-high', 'rating-low'])
    expect(reviewDiscoveryRatingBandSchema.options).toEqual([
      '90-100', '80-89', '70-79', '60-69', '50-59',
      '40-49', '30-39', '20-29', '10-19', '0-9',
    ])
    expect(storedReviewRatingBandSchema.parse('none')).toBe('none')
    expect(reviewDiscoveryRatingBandSchema.safeParse('none').success).toBe(false)
    expect(reviewDiscoveryVisibilitySchema.options).toEqual(['all', 'public', 'followers', 'private'])
    expect(reviewDiscoverySortSchema.safeParse('popular').success).toBe(false)
    expect(reviewDiscoveryRatingBandSchema.safeParse('91-100').success).toBe(false)
    expect(reviewDiscoveryVisibilitySchema.safeParse('friends').success).toBe(false)
  })

  test('normalizes every public-viewer visibility request to public', () => {
    for (const visibility of reviewDiscoveryVisibilitySchema.options) {
      expect(normalizeReviewDiscoveryVisibility(visibility, false)).toBe('public')
    }
    expect(normalizeReviewDiscoveryVisibility('private', true)).toBe('private')
  })

  test('accepts a strict discovery input with a nullable cursor', () => {
    const input = { cursor: null, query: '  fern  ', ratingBand: '90-100', sort: 'newest', visibility: 'all' }
    expect(reviewDiscoveryInputSchema.parse(input)).toEqual({ ...input, query: 'fern' })
    expect(reviewDiscoveryInputSchema.safeParse({ ...input, viewerId: 'client-auth-id' }).success).toBe(false)
    expect(reviewDiscoveryCursorSchema.safeParse('').success).toBe(false)
    expect(reviewDiscoveryCursorSchema.parse(null)).toBeNull()
  })

  test('accepts strict pages containing at most 12 shared Review items', () => {
    expect(reviewDiscoveryPageSchema.parse({ cursor: null, hasMore: false, items: [review] }).items[0]).toEqual(review)
    expect(reviewDiscoveryPageSchema.safeParse({ cursor: null, hasMore: false, items: [{ ...review, containsSpoiler: undefined, [removedSpoilerField]: false }] }).success).toBe(false)
    expect(reviewDiscoveryPageSchema.safeParse({ cursor: null, hasMore: false, items: Array.from({ length: 13 }, () => review) }).success).toBe(false)
    expect(reviewDiscoveryPageSchema.safeParse({ cursor: null, hasMore: false, items: [], extra: true }).success).toBe(false)
  })
})
