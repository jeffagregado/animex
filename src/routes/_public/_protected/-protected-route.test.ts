import { describe, expect, it } from 'vitest'

import type { ClientAuthState } from '#/features/auth/use-auth-state'
import { canMountProtectedReviews, getProtectedReviewDestination } from './route'

const loading: ClientAuthState = { status: 'loading' }
const signedOut: ClientAuthState = { status: 'ready', authState: { status: 'signedOut' } }
const unverified: ClientAuthState = { status: 'ready', authState: { status: 'emailUnverified', email: 'fan@example.com' } }
const profile: ClientAuthState = { status: 'ready', authState: { status: 'needsProfile', email: 'fan@example.com', signupMethod: 'password', suggestedUsername: null } }
const complete: ClientAuthState = { status: 'ready', authState: { status: 'complete', email: 'fan@example.com', profile: { id: '1', username: 'fan', name: 'Fan', avatarUrl: null, visibility: 'public' } } }

describe('protected Review route gate', () => {
  it('never mounts private children before both auth sources agree', () => {
    expect(canMountProtectedReviews(loading, false)).toBe(false)
    expect(canMountProtectedReviews(complete, false)).toBe(false)
    expect(canMountProtectedReviews(complete, true)).toBe(true)
  })

  it('routes auth states while preserving intended Review target', () => {
    const returnTo = '/reviews/review-1/edit'
    expect(getProtectedReviewDestination(signedOut, returnTo)).toBe('/home')
    expect(getProtectedReviewDestination(unverified, returnTo)).toBe('/auth/verify-email?returnTo=%2Freviews%2Freview-1%2Fedit')
    expect(getProtectedReviewDestination(profile, returnTo)).toBe('/auth/username?returnTo=%2Freviews%2Freview-1%2Fedit')
    expect(getProtectedReviewDestination(complete, returnTo)).toBeNull()
  })
})
