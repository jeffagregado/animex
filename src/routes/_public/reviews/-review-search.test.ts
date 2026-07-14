// @vitest-environment jsdom

import { createElement } from 'react'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ClientAuthState } from '#/features/auth/use-auth-state'
import { ReviewDiscoveryRoute } from '#/features/reviews/discovery/review-discovery-page'
import { getReviewDiscoveryRouteState, normalizeReviewDiscoverySearch } from '#/features/reviews/discovery/review-discovery-state'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  component: null as unknown,
  navigate: vi.fn(),
  pages: vi.fn(),
  search: {} as unknown,
  validate: null as unknown,
}))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: { component: unknown; validateSearch: unknown }) => {
    mocks.component = options.component
    mocks.validate = options.validateSearch
    return { useNavigate: () => mocks.navigate, useSearch: () => mocks.search }
  },
  lazyRouteComponent: () => () => null,
}))
vi.mock('#/features/shell/public-auth-context', () => ({ usePublicAuthState: mocks.auth }))
vi.mock('#/features/reviews/discovery/use-review-discovery-pages', () => ({ useReviewDiscoveryPages: mocks.pages }))
vi.mock('convex/react', () => ({ useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }) }))

await import('./index')

const signedOut: ClientAuthState = { status: 'ready', authState: { status: 'signedOut' } }
const signedIn: ClientAuthState = { status: 'ready', authState: { status: 'complete', email: 'fan@example.com', profile: { id: 'fan', username: 'fan', name: 'Fan', avatarUrl: null, visibility: 'public' } } }
const pages = { items: [], cursor: null, hasMore: false, error: null, initialLoading: false, loadingMore: false, loadMore: vi.fn(), retry: vi.fn() }

const mountRoute = (rawSearch: Record<string, unknown>, auth: ClientAuthState): void => {
  const validate = mocks.validate as (search: Record<string, unknown>) => unknown
  mocks.search = validate(rawSearch)
  mocks.auth.mockReturnValue(auth)
  render(createElement(ReviewDiscoveryRoute, { auth, routeState: getReviewDiscoveryRouteState(mocks.search as ReturnType<typeof normalizeReviewDiscoverySearch>), onNavigate: mocks.navigate }))
}

beforeEach(() => {
  mocks.navigate.mockReset()
  mocks.pages.mockReset()
  mocks.pages.mockReturnValue(pages)
})
afterEach(cleanup)

describe('Review discovery route state', () => {
  it('preserves absent visibility until signed-in auth replaces it with all', async () => {
    mountRoute({}, signedIn)
    expect(mocks.pages).not.toHaveBeenCalled()
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ search: { visibility: 'all' }, replace: true, resetScroll: false }))
  })

  it('replaces absent signed-out and invalid signed-in visibility with public', async () => {
    mountRoute({}, signedOut)
    expect(mocks.pages).not.toHaveBeenCalled()
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ search: { visibility: 'public' }, replace: true, resetScroll: false }))
    cleanup()
    mocks.navigate.mockReset()
    mountRoute({ visibility: 'friends' }, signedIn)
    expect(mocks.pages).not.toHaveBeenCalled()
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ search: { visibility: 'public' }, replace: true, resetScroll: false }))
    cleanup()
    mocks.navigate.mockReset()
    mountRoute({ visibility: 'friends' }, signedOut)
    expect(mocks.pages).not.toHaveBeenCalled()
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ search: { visibility: 'public' }, replace: true, resetScroll: false }))
  })

  it('queries resolved explicit values and locks signed-out non-public visibility', async () => {
    mountRoute({ q: ' frieren ', sort: 'rating-high', rating: '80-89', visibility: 'followers' }, signedIn)
    await waitFor(() => expect(mocks.pages).toHaveBeenCalled())
    expect(mocks.pages.mock.calls[0]?.[0]).toEqual({ query: 'frieren', sort: 'rating-high', ratingBand: '80-89', visibility: 'followers' })
    cleanup()
    mocks.pages.mockReset()
    mocks.navigate.mockReset()
    mountRoute({ visibility: 'private' }, signedOut)
    expect(mocks.pages).not.toHaveBeenCalled()
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ search: { visibility: 'public' }, replace: true, resetScroll: false }))
  })

  it('keeps auth errors query-disabled and renders the scoped message without false empty', () => {
    mountRoute({}, { status: 'error', message: 'Auth state check failed.' })
    expect(mocks.pages).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toContain('Auth state check failed.')
    expect(screen.queryByText('No reviews found')).toBeNull()
  })

  it('shape-normalizes invalid non-visibility values', () => {
    expect(getReviewDiscoveryRouteState(normalizeReviewDiscoverySearch({ q: ' x ', sort: 'popular', rating: 'none', visibility: 'public' }))).toMatchObject({
      query: null, ratingBand: null, sort: 'newest', visibility: 'public',
    })
  })
})
