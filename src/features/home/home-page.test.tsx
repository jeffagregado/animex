// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { getFunctionName } from 'convex/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { type AuthState } from '../auth/profile-actions'
import type { AnimeSummary, DiscoverPageData } from '../discover/shared/discover-contracts'
import { PublicAuthStateProvider } from '../shell/public-auth-context'
import { HomePage } from './home-page'
import { HomeWeeklyList } from './home-weekly-list'

const convex = vi.hoisted(() => {
  const query = vi.fn(async (..._args: unknown[]): Promise<unknown> => ({ items: [], cursor: null, hasMore: false }))
  return { authenticated: true, query, client: { query }, mutation: vi.fn(() => vi.fn()) }
})
const serverMocks = vi.hoisted(() => ({ refreshDiscoverSection: vi.fn() }))
vi.mock('convex/react', () => ({ useConvexAuth: () => ({ isAuthenticated: convex.authenticated, isLoading: false }), useConvex: () => convex.client, useMutation: convex.mutation }))
vi.mock('../discover/server/discover.functions', () => ({ refreshDiscoverSection: serverMocks.refreshDiscoverSection }))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, params, className }: { children: React.ReactNode; to: string; params?: Record<string, string>; className?: string }) => <a className={className} href={params ? to.replace('$anilistId', params.anilistId).replace('$slug', params.slug) : to}>{children}</a>,
}))

const anime: AnimeSummary = {
  anilistId: 1, slug: 'loader-anime', titles: { display: 'Loader Anime', english: 'Loader Anime', romaji: null, native: null }, coverImageUrl: 'https://example.test/loader.jpg', bannerImageUrl: null, format: 'TV', season: 'SUMMER', seasonYear: 2026, episodes: 12, genres: ['Action'], popularity: 100, averageScore: 80, trending: 90, startDate: null, nextAiringAt: null,
}
const ready = (key: 'trending' | 'seasonal' | 'recommendations' | 'upcoming', items: AnimeSummary[] = [anime]) => ({ status: 'ready' as const, section: { key, items, refreshedAt: 1, expiresAt: 2 } })
const data: DiscoverPageData = { sections: { trending: ready('trending'), seasonal: ready('seasonal'), recommendations: ready('recommendations'), upcoming: ready('upcoming') } }
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
const home = <QueryClientProvider client={client}><HomePage data={data} onSearchChange={() => undefined} search={{ feed: 'home', compose: false }} /></QueryClientProvider>

const mockAuthState = (state: AuthState): void => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      return {
        ok: true,
        json: async () => state,
      } as Response
    }),
  )
}

const mockPendingAuthState = (): void => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise(() => {})),
  )
}

const defaultQuery = async (...args: unknown[]): Promise<unknown> => {
  const name = getFunctionName(args[0] as Parameters<typeof getFunctionName>[0])
  if (name === 'reviews:listLatestPublic') return []
  if (name === 'userAnime:getMyProgress') return { watching: 0, completed: 0, planned: 0, dropped: 0 }
  return { items: [], cursor: null, hasMore: false }
}

beforeEach(() => {
  convex.query.mockReset()
  convex.query.mockImplementation(defaultQuery)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  convex.authenticated = true
  convex.query.mockReset()
  convex.mutation.mockClear()
  serverMocks.refreshDiscoverSection.mockReset()
})

describe('HomePage', () => {
  it('renders Seasonal from hydrated Discover data with rail controls', () => {
    mockAuthState({ status: 'signedOut' })

    render(<PublicAuthStateProvider>{home}</PublicAuthStateProvider>)

    const seasonal = screen.getByRole('heading', { name: 'Seasonal Anime' }).closest('section')
    if (seasonal === null) throw new TypeError('Seasonal section is required.')
    expect(within(seasonal).getByText('Loader Anime')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Previous Seasonal Anime' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Next Seasonal Anime' })).toBeTruthy()
  })

  it('preserves Seasonal loading, empty, and image-error states', () => {
    mockAuthState({ status: 'signedOut' })
    const view = render(<PublicAuthStateProvider><QueryClientProvider client={client}><HomePage onSearchChange={() => undefined} search={{ feed: 'home', compose: false }} /></QueryClientProvider></PublicAuthStateProvider>)
    expect(screen.getByLabelText('Seasonal Anime loading')).toBeTruthy()

    const emptyData: DiscoverPageData = { sections: { ...data.sections, seasonal: ready('seasonal', []) } }
    view.rerender(<PublicAuthStateProvider><QueryClientProvider client={client}><HomePage data={emptyData} onSearchChange={() => undefined} search={{ feed: 'home', compose: false }} /></QueryClientProvider></PublicAuthStateProvider>)
    expect(screen.getByText('No anime available in this section.')).toBeTruthy()

    view.rerender(<PublicAuthStateProvider><QueryClientProvider client={client}><HomePage data={data} onSearchChange={() => undefined} search={{ feed: 'home', compose: false }} /></QueryClientProvider></PublicAuthStateProvider>)
    const seasonal = screen.getByRole('heading', { name: 'Seasonal Anime' }).closest('section')
    if (seasonal === null) throw new TypeError('Seasonal section is required.')
    fireEvent.error(within(seasonal).getByAltText('Loader Anime cover'))
    expect(screen.getByText('Image unavailable')).toBeTruthy()
  })

  it('retries Seasonal through the shared section refresh path', async () => {
    mockAuthState({ status: 'signedOut' })
    const errorData: DiscoverPageData = { sections: { ...data.sections, seasonal: { status: 'error', key: 'seasonal', code: 'RATE_LIMITED', retryAfterSeconds: 12 } } }
    serverMocks.refreshDiscoverSection.mockResolvedValueOnce(ready('seasonal'))

    render(<PublicAuthStateProvider><QueryClientProvider client={client}><HomePage data={errorData} onSearchChange={() => undefined} search={{ feed: 'home', compose: false }} /></QueryClientProvider></PublicAuthStateProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Retry Seasonal Anime' }))

    await waitFor(() => expect(serverMocks.refreshDiscoverSection).toHaveBeenCalledWith({ data: 'seasonal' }))
    await waitFor(() => {
      const seasonal = screen.getByRole('heading', { name: 'Seasonal Anime' }).closest('section')
      if (seasonal === null) throw new TypeError('Seasonal section is required.')
      expect(within(seasonal).getByText('Loader Anime')).toBeTruthy()
    })
  })

  it('adapts Trending state to the shared top-five weekly list', () => {
    const weeklyItems = Array.from({ length: 6 }, (_, index) => ({ ...anime, anilistId: index + 1, slug: `anime-${index + 1}`, titles: { ...anime.titles, display: `Anime ${index + 1}` } }))

    render(<HomeWeeklyList state={ready('trending', weeklyItems)} onRetry={vi.fn()} isRetrying={false} retryError={null} variant="desktop" />)

    expect(screen.getByText('Anime 5')).toBeTruthy()
    expect(screen.queryByText('Anime 6')).toBeNull()
  })

  it('keeps mobile weekly loading rows from collapsing', () => {
    render(<HomeWeeklyList state={undefined} onRetry={vi.fn()} isRetrying={false} retryError={null} variant="mobile" />)

    const skeletons = screen.getByLabelText('This Week loading').querySelectorAll('.animate-pulse')
    expect(skeletons).toHaveLength(3)
    for (const skeleton of skeletons) {
      expect(skeleton.className).toContain('w-44')
      expect(skeleton.className).toContain('shrink-0')
    }
  })

  it('shows an explicit weekly empty state', () => {
    render(<HomeWeeklyList state={ready('trending', [])} onRetry={vi.fn()} isRetrying={false} retryError={null} variant="desktop" />)

    expect(screen.getByText('No trending anime is available this week.')).toBeTruthy()
    expect(screen.queryByText('This week is unavailable.')).toBeNull()
  })

  it('shows weekly errors and retries only Trending', () => {
    const retry = vi.fn()
    render(<HomeWeeklyList state={{ status: 'error', key: 'trending', code: 'RATE_LIMITED', retryAfterSeconds: 12 }} onRetry={retry} isRetrying={false} retryError="Refresh failed" variant="desktop" />)

    expect(screen.getByRole('alert').textContent).toContain('Try again in 12 seconds.')
    expect(screen.getByRole('status').textContent).toBe('Refresh failed')
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(retry).toHaveBeenCalledWith('trending')
  })

  it('disables weekly retry while refresh is pending', () => {
    render(<HomeWeeklyList state={{ status: 'error', key: 'trending', code: 'UPSTREAM', retryAfterSeconds: null }} onRetry={vi.fn()} isRetrying retryError={null} variant="desktop" />)

    expect(screen.getByRole('button', { name: 'Retrying' })).toHaveProperty('disabled', true)
  })

  it('renders content without duplicating the public shell', () => {
    mockAuthState({
      status: 'signedOut',
    })

    render(<PublicAuthStateProvider>{home}</PublicAuthStateProvider>)

    expect(screen.queryByRole('link', { name: /AnimeX/i })).toBeNull()
    expect(screen.queryByRole('navigation', { name: 'Primary' })).toBeNull()
    expect(screen.queryByRole('navigation', { name: 'Mobile' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Community' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Stats' })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Seasonal Anime' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Latest Reviews' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'This Week' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Upcoming' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'My Anime' })).toBeNull()
    expect(screen.queryByText('Community feed')).toBeNull()
    expect(screen.queryByText('What are you watching?')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Following' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Global' })).toBeNull()
    expect(screen.queryByText('Create')).toBeNull()
    expect(screen.queryByText('Profile')).toBeNull()
  })

  it('shows no shell auth controls for signed-out users', () => {
    mockAuthState({
      status: 'signedOut',
    })

    render(<PublicAuthStateProvider>{home}</PublicAuthStateProvider>)

    expect(screen.queryByRole('button', { name: 'Auth' })).toBeNull()

    expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull()
  })

  it('does not render shell loading chrome while auth state loads', () => {
    mockPendingAuthState()

    render(<PublicAuthStateProvider>{home}</PublicAuthStateProvider>)

    expect(document.querySelector('[data-testid="header-auth-skeleton"]')).toBeNull()
  })

  it('shows private content for signed-in users', async () => {
    mockAuthState({
      status: 'complete',
      email: 'mika@example.com',
      profile: {
        id: 'profile-1',
        username: 'mika',
        name: 'Mika',
        avatarUrl: null,
        visibility: 'private',
      },
    })

    render(<PublicAuthStateProvider>{home}</PublicAuthStateProvider>)

    await waitFor(() => expect(screen.getByRole('tab', { name: 'home' })).toBeTruthy())
    expect(screen.queryByRole('heading', { name: 'My Anime' })).toBeNull()
    expect(screen.queryByText('What are you watching?')).toBeNull()
    expect(screen.getByRole('button', { name: 'Create Post' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'List Progress' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'following' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'global' })).toBeTruthy()
  })

  it('keeps pending users signed in but hides private actions', async () => {
    mockAuthState({
      status: 'needsProfile',
      email: 'mika@example.com',
      signupMethod: 'password',
      suggestedUsername: null,
    })

    render(<PublicAuthStateProvider>{home}</PublicAuthStateProvider>)

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Seasonal Anime' })).toBeTruthy())
    expect(screen.queryByText('What are you watching?')).toBeNull()
  })

  it('waits for Convex auth before mounting private Home actions', async () => {
    convex.authenticated = false
    convex.query.mockImplementation(async (...args: unknown[]): Promise<unknown> => {
      const name = getFunctionName(args[0] as Parameters<typeof getFunctionName>[0])
      if (name === 'reviews:listLatestPublic') return []
      if (name === 'userAnime:getMyProgress') return { watching: 0, completed: 0, planned: 0, dropped: 0 }
      return { items: [{ id: 'card', kind: 'post', postId: 'post', author: { id: 'profile-1', username: 'mika', displayName: 'Mika', avatarUrl: null }, text: 'Public card', media: null, hasSpoiler: false, visibility: 'public', createdAt: 1, updatedAt: 1 }], cursor: null, hasMore: false } as never
    })
    mockAuthState({ status: 'complete', email: 'mika@example.com', profile: { id: 'profile-1', username: 'mika', name: 'Mika', avatarUrl: null, visibility: 'private' } })
    const view = render(<PublicAuthStateProvider>{home}</PublicAuthStateProvider>)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Global' })).toBeTruthy())
    await waitFor(() => expect(getFunctionName(convex.query.mock.calls.at(-1)?.[0] as Parameters<typeof getFunctionName>[0])).toBe('feed:listGlobal'))
    await screen.findByText('Public card')
    expect(screen.queryByText('What are you watching?')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Owner actions' })).toBeNull()
    expect(convex.mutation).not.toHaveBeenCalled()
    convex.authenticated = true
    view.rerender(<PublicAuthStateProvider><QueryClientProvider client={client}><HomePage data={data} onSearchChange={() => undefined} search={{ feed: 'home', compose: false }} /></QueryClientProvider></PublicAuthStateProvider>)
    await waitFor(() => expect(screen.getByRole('tab', { name: 'home' })).toBeTruthy())
    await waitFor(() => expect(getFunctionName(convex.query.mock.calls.at(-1)?.[0] as Parameters<typeof getFunctionName>[0])).toBe('feed:listHome'))
    expect(screen.queryByText('What are you watching?')).toBeNull()
    expect(screen.getByRole('button', { name: 'Create Post' })).toBeTruthy()
  })
})
