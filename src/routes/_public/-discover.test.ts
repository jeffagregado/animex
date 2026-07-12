// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  useNavigate,
} from '@tanstack/react-router'

const discoverMocks = vi.hoisted(() => ({
  getDiscoverPage: vi.fn(),
}))

vi.mock('#/features/discover/server/discover.functions', () => ({
  getDiscoverPage: discoverMocks.getDiscoverPage,
}))

import { DiscoverRouteError, DiscoverRoutePending } from '#/features/shell/discover-route-states'

import { getDiscoverNavigationOptions, loadDiscoverPage, normalizeDiscoverSearch, serializeDiscoverSearch } from './discover'

afterEach(() => {
  cleanup()
  discoverMocks.getDiscoverPage.mockReset()
})

describe('Discover route search', () => {
  it('normalizes valid URL search keys into the Discover UI state', () => {
    expect(normalizeDiscoverSearch({
      q: '  frieren  ',
      genre: 'Action',
      format: 'TV',
      season: 'FALL',
      year: '2023',
      sort: 'popularity',
    })).toEqual({
      query: 'frieren',
      genre: 'Action',
      format: 'TV',
      season: 'FALL',
      year: 2023,
      sort: 'popularity',
    })
  })

  it('drops malformed external values so invalid search input never reaches the server', () => {
    expect(normalizeDiscoverSearch({
      q: 'x',
      genre: 'Not a genre',
      format: 'BOOK',
      season: 'MONSOON',
      year: '20.5',
      sort: 'unknown',
    })).toEqual({
      query: null,
      genre: null,
      format: null,
      season: null,
      year: null,
      sort: 'relevance',
    })
  })

  it('omits null values and the default sort from canonical URLs', () => {
    expect(serializeDiscoverSearch({
      query: null,
      genre: 'Action',
      format: null,
      season: null,
      year: null,
      sort: 'relevance',
    })).toEqual({ genre: 'Action' })
  })

  it('renders an accessible pending state with no enabled controls', () => {
    render(createElement(DiscoverRoutePending))

    expect(screen.getByRole('status').textContent).toContain('Loading Discover')
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('shows a loader failure and resets the route boundary on retry', async () => {
    const error = new Error('AniList unavailable')
    const reset = vi.fn()
    discoverMocks.getDiscoverPage.mockRejectedValueOnce(error)

    await expect(loadDiscoverPage()).rejects.toThrow('AniList unavailable')
    render(createElement(DiscoverRouteError, { error, reset }))

    expect(screen.getByRole('alert').textContent).toContain('Could not load Discover')
    fireEvent.click(screen.getByRole('button', { name: 'Retry Discover' }))
    expect(reset).toHaveBeenCalledTimes(1)
  })

  it('uses history push and replace intents without resetting scroll', async () => {
    vi.stubGlobal('scrollTo', vi.fn())
    const rootRoute = createRootRoute()
    const route = createRoute({
      getParentRoute: () => rootRoute,
      path: 'discover',
      validateSearch: (search: Record<string, unknown>) => search,
      component: DiscoverNavigationHarness,
    })
    const history = createMemoryHistory({ initialEntries: ['/discover'] })
    const router = createRouter({ routeTree: rootRoute.addChildren([route]), history })

    render(createElement(RouterProvider, { router }))

    fireEvent.click(await screen.findByRole('button', { name: 'Push search' }))
    await vi.waitFor(() => expect(history.length).toBe(2))
    expect(history.location.search).toBe('?q=frieren')

    fireEvent.click(screen.getByRole('button', { name: 'Replace search' }))
    await vi.waitFor(() => expect(history.length).toBe(2))
    expect(history.location.search).toBe('?q=frieren&genre=Action')
  })
})

function DiscoverNavigationHarness() {
  const navigate = useNavigate({ from: '/discover' })
  const state = { query: 'frieren', genre: null, format: null, season: null, year: null, sort: 'relevance' as const }

  return createElement('div', null,
    createElement('button', { type: 'button', onClick: () => void navigate(getDiscoverNavigationOptions(state, 'push')) }, 'Push search'),
    createElement('button', { type: 'button', onClick: () => void navigate(getDiscoverNavigationOptions({ ...state, genre: 'Action' }, 'replace')) }, 'Replace search'),
  )
}
