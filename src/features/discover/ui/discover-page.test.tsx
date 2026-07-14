// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { AnimeSummary, DiscoverPageData } from '../shared/discover-contracts'
import { DiscoverPage } from './discover-page'
import type { DiscoverSearchStateChange, DiscoverUrlSearchState } from './discover-ui.types'

const serverMocks = vi.hoisted(() => ({ refreshDiscoverSection: vi.fn(), searchAnime: vi.fn() }))

vi.mock('../server/discover.functions', () => ({
  refreshDiscoverSection: serverMocks.refreshDiscoverSection,
  searchAnime: serverMocks.searchAnime,
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, params, className }: { children: React.ReactNode; to: string; params: Record<string, string>; className?: string }) => {
    const href = to.replace(/\$([A-Za-z0-9_]+)/g, (_, key: string) => {
      const value = params[key]
      if (value === undefined) throw new Error(`Missing route param: ${key}`)
      return value
    })
    return <a data-to={to} href={href} className={className}>{children}</a>
  },
}))

const searchState: DiscoverUrlSearchState = { query: null, genre: null, format: null, season: null, year: null, sort: 'relevance' }
const anime: AnimeSummary = {
  anilistId: 1, slug: 'frieren', titles: { display: 'Frieren', english: 'Frieren', romaji: 'Sousou no Frieren', native: null }, coverImageUrl: 'https://example.test/frieren.jpg', bannerImageUrl: null, format: 'TV', season: 'FALL', seasonYear: 2023, episodes: 28, genres: ['Adventure'], popularity: 1, averageScore: 90, trending: 2, startDate: null, nextAiringAt: null,
}
const ready = (key: 'trending' | 'seasonal' | 'recommendations' | 'upcoming') => ({ status: 'ready' as const, section: { key, items: [anime], refreshedAt: 1, expiresAt: 2 } })
const data: DiscoverPageData = { sections: { trending: ready('trending'), seasonal: ready('seasonal'), recommendations: ready('recommendations'), upcoming: ready('upcoming') } }

const renderPage = (pageData: DiscoverPageData | null, isLoading: boolean, onSearchStateChange: DiscoverSearchStateChange): void => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}><DiscoverPage data={pageData} isLoading={isLoading} searchState={searchState} onSearchStateChange={onSearchStateChange} /></QueryClientProvider>)
}

afterEach(() => {
  cleanup()
  serverMocks.refreshDiscoverSection.mockReset()
  serverMocks.searchAnime.mockReset()
})

describe('DiscoverPage', () => {
  it('uses compact Upcoming modules and one manga placeholder for each responsive branch', () => {
    renderPage(data, false, vi.fn())

    expect(screen.getAllByRole('heading', { name: 'Upcoming' })).toHaveLength(2)
    expect(document.querySelectorAll('#upcoming-mobile-heading')).toHaveLength(1)
    expect(document.querySelectorAll('#upcoming-desktop-heading')).toHaveLength(1)
    expect(screen.getAllByText('Manga lists later')).toHaveLength(2)
  })

  it('removes main Genres while retaining Top Genres and genre filter selection', () => {
    const onSearchStateChange = vi.fn()
    renderPage(data, false, onSearchStateChange)

    const topGenres = screen.getByRole('heading', { name: 'Top Genres' }).closest('section')
    if (topGenres === null) throw new Error('Top Genres section is missing.')
    const action = topGenres.querySelector<HTMLButtonElement>('button')
    if (action === null) throw new Error('Top Genres options are missing.')
    fireEvent.click(action)
    expect(onSearchStateChange).toHaveBeenCalledWith({ ...searchState, genre: 'Action' }, 'push')

    fireEvent.click(screen.getByRole('combobox', { name: 'Genre' }))
    const comedy = screen.getByRole('option', { name: 'Comedy' })
    fireEvent.pointerDown(comedy, { pointerType: 'mouse' })
    fireEvent.click(comedy)
    expect(onSearchStateChange).toHaveBeenCalledWith({ ...searchState, genre: 'Comedy' }, 'push')
    expect(screen.queryByRole('heading', { name: 'Genres' })).toBeNull()
  })

  it('links poster cards and shows an explicit image failure state', () => {
    renderPage(data, false, vi.fn())

    const image = screen.getAllByAltText('Frieren cover')[0]
    const card = image.closest('article')
    fireEvent.error(image)
    expect(screen.getAllByText('Image unavailable').length).toBeGreaterThan(0)
    expect(card).toBeTruthy()
    const link = card?.closest('a')
    expect(link?.dataset.to).toBe('/anime/$anilistId/$slug')
    expect(link?.getAttribute('href')).toBe('/anime/1/frieren')
    expect(link?.className).toContain('focus-visible:ring-2')
  })

  it('renders rail skeletons while page data is loading', () => {
    renderPage(null, true, vi.fn())

    expect(screen.getByLabelText('Trending Anime loading')).toBeTruthy()
  })

  it('keeps a section error visible when its refresh request rejects', async () => {
    const errorData: DiscoverPageData = {
      sections: { ...data.sections, trending: { status: 'error', key: 'trending', code: 'UPSTREAM', retryAfterSeconds: null } },
    }
    serverMocks.refreshDiscoverSection.mockRejectedValueOnce(new Error('AniList unavailable'))
    renderPage(errorData, false, vi.fn())

    fireEvent.click(screen.getByRole('button', { name: 'Retry Trending Anime' }))

    expect(await screen.findByText('AniList unavailable')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Retry Trending Anime' })).toBeTruthy()
  })

  it('tracks concurrent section retries independently and blocks duplicate same-section refreshes', async () => {
    const pendingTrending = new Promise(() => {})
    const pendingSeasonal = new Promise(() => {})
    const errorData: DiscoverPageData = {
      sections: {
        ...data.sections,
        trending: { status: 'error', key: 'trending', code: 'UPSTREAM', retryAfterSeconds: null },
        seasonal: { status: 'error', key: 'seasonal', code: 'UPSTREAM', retryAfterSeconds: null },
      },
    }
    serverMocks.refreshDiscoverSection.mockImplementation(({ data: key }: { data: string }) => key === 'trending' ? pendingTrending : pendingSeasonal)
    renderPage(errorData, false, vi.fn())

    const trendingRetry = screen.getByRole('button', { name: 'Retry Trending Anime' })
    const seasonalRetry = screen.getByRole('button', { name: 'Retry Seasonal Anime' })
    fireEvent.click(trendingRetry)
    fireEvent.click(seasonalRetry)
    fireEvent.click(trendingRetry)

    await waitFor(() => expect(serverMocks.refreshDiscoverSection).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('button', { name: 'Retry Trending Anime' })).toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: 'Retry Seasonal Anime' })).toHaveProperty('disabled', true)
  })
})
