import { describe, expect, it } from 'vitest'

import {
  getReviewDiscoveryNavigationOptions,
  getReviewDiscoveryVisibilityReplacement,
  normalizeReviewDiscoverySearch,
  serializeReviewDiscoverySearch,
} from '#/features/reviews/discovery/review-discovery-state'

describe('Review discovery route state', () => {
  it('normalizes invalid URL values without widening visibility', () => {
    expect(normalizeReviewDiscoverySearch({ q: ' x ', sort: 'popular', rating: 'none', visibility: 'friends' })).toEqual({
      query: null,
      ratingBand: null,
      sort: 'newest',
      visibility: 'public',
    })
  })

  it('preserves valid signed-in visibility choices', () => {
    const state = normalizeReviewDiscoverySearch({ q: ' frieren ', sort: 'rating-high', rating: '80-89', visibility: 'followers' })
    expect(state).toEqual({ query: 'frieren', sort: 'rating-high', ratingBand: '80-89', visibility: 'followers' })
    expect(serializeReviewDiscoverySearch(state)).toEqual({ q: 'frieren', sort: 'rating-high', rating: '80-89', visibility: 'followers' })
  })

  it('replaces non-public visibility only after public auth is ready', () => {
    const state = normalizeReviewDiscoverySearch({ visibility: 'private' })
    expect(getReviewDiscoveryVisibilityReplacement(state, { status: 'loading' })).toBeNull()
    expect(getReviewDiscoveryVisibilityReplacement(state, { status: 'error', message: 'offline' })).toBeNull()
    expect(getReviewDiscoveryVisibilityReplacement(state, { status: 'ready', authState: { status: 'signedOut' } })).toEqual({ ...state, visibility: 'public' })
    expect(getReviewDiscoveryVisibilityReplacement(state, { status: 'ready', authState: { status: 'complete', email: 'fan@example.com', profile: { id: 'fan', username: 'fan', name: 'Fan', avatarUrl: null, visibility: 'public' } } })).toBeNull()
  })

  it('uses replace navigation and preserves scroll position', () => {
    const state = normalizeReviewDiscoverySearch({ q: 'frieren' })
    expect(getReviewDiscoveryNavigationOptions(state)).toEqual({ search: { q: 'frieren' }, replace: true, resetScroll: false })
  })
})
