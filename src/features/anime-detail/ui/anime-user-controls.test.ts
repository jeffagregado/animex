import { describe, expect, it } from 'vitest'

import type { ClientAuthState } from '#/features/auth/use-auth-state'
import { canQueryUserAnime, getAnimeAuthDestination, reconcileRewatchItems } from './anime-user-controls'

describe('anime user control policies', () => {
  it('routes only settled incomplete auth states to their required destination', () => {
    const loading: ClientAuthState = { status: 'loading' }
    expect(getAnimeAuthDestination(loading, '/anime/1/frieren')).toBeNull()
    expect(getAnimeAuthDestination({ status: 'ready', authState: { status: 'signedOut' } }, '/anime/1/frieren?tab=staff')).toBe('/auth/sign-in?returnTo=%2Fanime%2F1%2Ffrieren%3Ftab%3Dstaff')
    expect(getAnimeAuthDestination({ status: 'ready', authState: { status: 'emailUnverified', email: 'a@example.com' } }, '/anime/1/frieren')).toContain('/auth/verify-email')
  })

  it('gates private queries until public and Convex auth both complete', () => {
    const complete: ClientAuthState = { status: 'ready', authState: { status: 'complete', email: 'a@example.com', profile: { id: '1', username: 'a', name: 'A', avatarUrl: null, visibility: 'private' } } }
    expect(canQueryUserAnime(complete, false)).toBe(false)
    expect(canQueryUserAnime(complete, true)).toBe(true)
    expect(canQueryUserAnime({ status: 'loading' }, true)).toBe(false)
  })

  it('replaces first-page history after mutation and deduplicates cursor pages', () => {
    const first = [{ id: 'a', anilistId: 1, completedAt: 1 }]
    const next = [{ id: 'a', anilistId: 1, completedAt: 1 }, { id: 'b', anilistId: 1, completedAt: 2 }]
    expect(reconcileRewatchItems(first, next, null)).toEqual(next)
    expect(reconcileRewatchItems(first, next, 'cursor')).toEqual([first[0], next[1]])
  })
})
