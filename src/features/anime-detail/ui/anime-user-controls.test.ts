// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { afterEach, beforeEach, vi } from 'vitest'

import type { ClientAuthState } from '#/features/auth/use-auth-state'
import type { UserAnimeEntry } from '../shared/anime-detail-contracts'
import { AnimeUserControls, canQueryUserAnime, getAnimeAuthDestination, reconcileRewatchItems } from './anime-user-controls'

const controlState = vi.hoisted(() => ({
  auth: { status: 'ready', authState: { status: 'complete', email: 'a@example.com', profile: { id: '1', username: 'a', name: 'A', avatarUrl: null, visibility: 'private' } } } as ClientAuthState,
  convexAuth: { isAuthenticated: true, isLoading: false },
  entry: { anilistId: 1, status: 'watching', score: 7, isFavorite: true, favoriteChangedAt: 1, rewatchCount: 0, createdAt: 1, updatedAt: 1 } as UserAnimeEntry | undefined,
  favorite: vi.fn(async () => null),
  mutationIndex: 0,
  query: vi.fn(),
  score: vi.fn(async () => null),
  status: vi.fn(async () => null),
}))

vi.mock('#/features/shell/public-auth-context', () => ({ usePublicAuthState: () => controlState.auth }))
vi.mock('convex/react', () => ({
  useConvexAuth: () => controlState.convexAuth,
  useMutation: () => [controlState.status, controlState.score, controlState.favorite][controlState.mutationIndex++ % 3],
  useQuery: (...args: unknown[]) => { controlState.query(...args); return controlState.entry },
}))

beforeEach(() => {
  controlState.auth = { status: 'ready', authState: { status: 'complete', email: 'a@example.com', profile: { id: '1', username: 'a', name: 'A', avatarUrl: null, visibility: 'private' } } }
  controlState.convexAuth = { isAuthenticated: true, isLoading: false }
  controlState.entry = { anilistId: 1, status: 'watching', score: 7, isFavorite: true, favoriteChangedAt: 1, rewatchCount: 0, createdAt: 1, updatedAt: 1 }
  controlState.mutationIndex = 0
  vi.clearAllMocks()
})

afterEach(cleanup)

describe('anime user control policies', () => {
  it('routes only settled incomplete auth states to their required destination', () => {
    const loading: ClientAuthState = { status: 'loading' }
    expect(getAnimeAuthDestination(loading, '/anime/1/frieren')).toBeNull()
    expect(getAnimeAuthDestination({ status: 'ready', authState: { status: 'signedOut' } }, '/anime/1/frieren?tab=staff')).toBe('/auth/sign-in?returnTo=%2Fanime%2F1%2Ffrieren%3Ftab%3Dstaff')
    expect(getAnimeAuthDestination({ status: 'ready', authState: { status: 'emailUnverified', email: 'a@example.com' } }, '/anime/1/frieren')).toContain('/auth/verify-email')
    expect(getAnimeAuthDestination({ status: 'ready', authState: { status: 'needsProfile', email: 'a@example.com', signupMethod: 'password', suggestedUsername: null } }, '/anime/1/frieren?tab=characters')).toBe('/auth/username?returnTo=%2Fanime%2F1%2Ffrieren%3Ftab%3Dcharacters')
    expect(getAnimeAuthDestination({ status: 'ready', authState: { status: 'complete', email: 'a@example.com', profile: { id: '1', username: 'a', name: 'A', avatarUrl: null, visibility: 'private' } } }, '/anime/1/frieren')).toBeNull()
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

  it('saves and clears scores, toggles favorites, and keeps rewatch history owner-only', async () => {
    render(createElement(AnimeUserControls, { anilistId: 1, canonicalPath: '/anime/1/frieren' }))

    fireEvent.change(screen.getByLabelText('Score'), { target: { value: '8.5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(controlState.score).toHaveBeenCalledWith({ anilistId: 1, score: 8.5 }))

    fireEvent.click(screen.getByRole('button', { name: 'Clear score' }))
    await waitFor(() => expect(controlState.score).toHaveBeenCalledWith({ anilistId: 1, score: null }))

    fireEvent.click(screen.getByRole('button', { name: 'Favorite' }))
    await waitFor(() => expect(controlState.favorite).toHaveBeenCalledWith({ anilistId: 1, isFavorite: false }))

    expect(screen.getByRole('combobox').textContent).toContain('watching')
    expect(screen.getByRole('button', { name: 'Rewatch history' })).toBeTruthy()
  })

  it('skips private state and hides rewatch history while signed out', () => {
    controlState.auth = { status: 'ready', authState: { status: 'signedOut' } }
    controlState.convexAuth = { isAuthenticated: false, isLoading: false }
    controlState.entry = undefined
    render(createElement(AnimeUserControls, { anilistId: 1, canonicalPath: '/anime/1/frieren?tab=staff' }))

    expect(controlState.query.mock.calls[0]?.[1]).toBe('skip')
    expect(screen.queryByRole('button', { name: 'Rewatch history' })).toBeNull()
  })
})
