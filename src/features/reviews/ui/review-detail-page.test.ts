import { describe, expect, it } from 'vitest'

import type { ClientAuthState } from '#/features/auth/use-auth-state'
import { isReviewOwner } from './review-detail-page'

describe('Review Detail owner rules', () => {
  it('shows owner actions only after complete auth and Convex sync', () => {
    const complete: ClientAuthState = { status: 'ready', authState: { status: 'complete', email: 'fan@example.com', profile: { id: 'author-1', username: 'fan', name: 'Fan', avatarUrl: null, visibility: 'public' } } }
    expect(isReviewOwner(complete, true, 'author-1')).toBe(true)
    expect(isReviewOwner(complete, false, 'author-1')).toBe(false)
    expect(isReviewOwner({ status: 'ready', authState: { status: 'signedOut' } }, false, 'author-1')).toBe(false)
  })
})
