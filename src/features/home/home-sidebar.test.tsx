// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { getFunctionName } from 'convex/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { AnimeSummary } from '../discover/shared/discover-contracts'
import type { ReviewListItem } from '../social/shared/social-contracts'
import { HomeLatestReviews } from './home-latest-reviews'
import { HomeListProgress } from './home-list-progress'
import { HomeSidebar } from './home-sidebar'

const mocks = vi.hoisted(() => {
  const query = vi.fn()
  return { authenticated: false, query, client: { query } }
})

vi.mock('convex/react', () => ({
  useConvex: () => mocks.client,
  useConvexAuth: () => ({ isAuthenticated: mocks.authenticated, isLoading: false }),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, params, className }: { children: React.ReactNode; to: string; params?: Record<string, string>; className?: string }) => {
    const href = params ? to.replace('$anilistId', params.anilistId).replace('$slug', params.slug) : to
    return <a className={className} href={href}>{children}</a>
  },
}))

const anime: AnimeSummary = {
  anilistId: 1, slug: 'loader-anime', titles: { display: 'Loader Anime', english: null, romaji: null, native: null }, coverImageUrl: 'https://example.test/loader.jpg', bannerImageUrl: null, format: 'TV', season: 'SUMMER', seasonYear: 2026, episodes: 12, genres: ['Action'], popularity: 100, averageScore: 80, trending: 90, startDate: null, nextAiringAt: null,
}
const ready = (key: 'trending' | 'upcoming') => ({ status: 'ready' as const, section: { key, items: [anime], refreshedAt: 1, expiresAt: 2 } })
const retryProps = { onRetry: vi.fn(), isRetrying: false, retryError: null }
const review: ReviewListItem = {
  id: 'review-1', author: { id: 'author-1', username: 'mika', displayName: 'Mika', avatarUrl: null }, anime: { anilistId: 1, slug: 'loader-anime', title: 'Loader Anime', coverImageUrl: 'https://example.test/loader.jpg' }, state: 'published', rating: 91, summary: 'A patient and thoughtful journey.', containsSpoiler: false, visibility: 'public', publishedAt: Date.now() - 120_000, updatedAt: Date.now() - 120_000,
}

afterEach(() => {
  cleanup()
  mocks.authenticated = false
  mocks.query.mockReset()
})

describe('HomeSidebar', () => {
  it('renders exact public order without requesting private progress', async () => {
    mocks.query.mockResolvedValue([])
    render(<HomeSidebar signedIn={false} trending={ready('trending')} trendingRetry={retryProps} upcoming={ready('upcoming')} upcomingRetry={retryProps} />)

    expect(screen.getByLabelText('Home utility column').className).toContain('hidden')
    expect(screen.getByLabelText('Home utility column').className).toContain('lg:block')
    expect(headings()).toEqual(['Latest Reviews', 'This Week', 'Upcoming'])
    await waitFor(() => expect(queryNames()).toContain('reviews:listLatestPublic'))
    expect(queryNames()).not.toContain('userAnime:getMyProgress')
  })

  it('renders exact signed-in order', async () => {
    mocks.authenticated = true
    mocks.query.mockImplementation(async (reference: Parameters<typeof getFunctionName>[0]) => getFunctionName(reference) === 'userAnime:getMyProgress' ? { watching: 1, completed: 2, planned: 3, dropped: 4 } : [])
    render(<HomeSidebar signedIn trending={ready('trending')} trendingRetry={retryProps} upcoming={ready('upcoming')} upcomingRetry={retryProps} />)

    expect(headings()).toEqual(['List Progress', 'Latest Reviews', 'This Week', 'Upcoming'])
    await waitFor(() => expect(queryNames()).toContain('userAnime:getMyProgress'))
  })

  it('matches Discover card surfaces for This Week and Upcoming', () => {
    mocks.query.mockResolvedValue([])
    render(<HomeSidebar signedIn={false} trending={ready('trending')} trendingRetry={retryProps} upcoming={ready('upcoming')} upcomingRetry={retryProps} />)

    const sidebar = screen.getByLabelText('Home utility column')
    const expectedSurface = 'rounded-lg border border-border bg-card p-4'
    const thisWeek = Array.from(sidebar.children).find((child) => child.querySelector('h2')?.textContent === 'This Week')
    const upcoming = Array.from(sidebar.children).find((child) => child.querySelector('h2')?.textContent === 'Upcoming')

    expect(thisWeek?.className).toBe(expectedSurface)
    expect(upcoming?.className).toBe(expectedSurface)
  })
})

describe('Home utility data states', () => {
  it('shows each Latest Review as a compact whole-row link with optional spoiler warning', async () => {
    mocks.query.mockResolvedValue([{ ...review, containsSpoiler: true }])
    render(<HomeLatestReviews />)

    expect(await screen.findByText('A patient and thoughtful journey.')).toBeTruthy()
    expect(screen.getByText('Mika')).toBeTruthy()
    expect(screen.getByText('2m ago')).toBeTruthy()
    expect(screen.getByAltText('Loader Anime cover')).toBeTruthy()
    const title = screen.getByText('Loader Anime')
    expect(title.closest('article')?.className).toContain('pr-20')
    expect(screen.getByText('Spoiler')).toBeTruthy()
    const reviewLink = screen.getByRole('link', { name: 'Read Loader Anime review by Mika' })
    expect(reviewLink.getAttribute('href')).toBe('/reviews/review-1')
    expect(reviewLink.className).toContain('flex')
    expect(reviewLink.textContent).toContain('Loader Anime')
    expect(reviewLink.textContent).toContain('Mika')
    expect(reviewLink.textContent).toContain('2m ago')
    expect(reviewLink.textContent).toContain('A patient and thoughtful journey.')
    expect(screen.queryByText(/read\s+review/i)).toBeNull()
    expect(screen.getByRole('link', { name: 'See more reviews' }).getAttribute('href')).toBe('/reviews')
    expect(screen.queryByText(/91/)).toBeNull()
  })

  it('preserves loaded reviews when refresh fails and retries', async () => {
    mocks.query.mockResolvedValueOnce([review]).mockRejectedValueOnce(new Error('Review refresh failed.')).mockResolvedValueOnce([review])
    render(<HomeLatestReviews />)
    await screen.findByText('A patient and thoughtful journey.')

    fireEvent.click(screen.getByRole('button', { name: 'Refresh Latest Reviews' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Review refresh failed.')
    expect(screen.getByText('A patient and thoughtful journey.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Retry Latest Reviews' }))
    await waitFor(() => expect(mocks.query).toHaveBeenCalledTimes(3))
  })

  it.each([
    { state: 'draft', publishedAt: null },
    { state: 'published', publishedAt: null },
  ])('rejects a $state Review without published truth', async ({ state, publishedAt }) => {
    mocks.query.mockResolvedValue([{ ...review, state, publishedAt }])
    render(<HomeLatestReviews />)

    expect((await screen.findByRole('alert')).textContent).toContain('Latest Reviews requires published Reviews with publish times.')
    expect(screen.queryByText('A patient and thoughtful journey.')).toBeNull()
  })

  it('renders proportional List Progress and preserves it on refresh failure', async () => {
    mocks.query.mockResolvedValueOnce({ watching: 1, completed: 2, planned: 3, dropped: 4 }).mockRejectedValueOnce(new Error('Progress refresh failed.'))
    render(<HomeListProgress />)

    expect(await screen.findByText('Watching')).toBeTruthy()
    expect(screen.getByRole('progressbar', { name: 'Watching' }).getAttribute('aria-valuenow')).toBe('10')
    fireEvent.click(screen.getByRole('button', { name: 'Refresh List Progress' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Progress refresh failed.')
    expect(screen.getByText('Watching')).toBeTruthy()
  })
})

const headings = (): string[] => screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent ?? '')
const queryNames = (): string[] => mocks.query.mock.calls.map((call) => getFunctionName(call[0] as Parameters<typeof getFunctionName>[0]))
