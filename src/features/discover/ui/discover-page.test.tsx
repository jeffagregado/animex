// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { AnimeSummary, DiscoverPageData } from '../shared/discover-contracts'
import { DiscoverPage } from './discover-page'
import type { DiscoverUrlSearchState } from './discover-ui.types'

const serverMocks = vi.hoisted(() => ({ refreshDiscoverSection: vi.fn(), searchAnime: vi.fn() }))

vi.mock('../server/discover.functions', () => ({
  refreshDiscoverSection: serverMocks.refreshDiscoverSection,
  searchAnime: serverMocks.searchAnime,
}))

const searchState: DiscoverUrlSearchState = { query: null, genre: null, format: null, season: null, year: null, sort: 'relevance' }
const anime: AnimeSummary = {
  anilistId: 1, slug: 'frieren', titles: { display: 'Frieren', english: 'Frieren', romaji: 'Sousou no Frieren', native: null }, coverImageUrl: 'https://example.test/frieren.jpg', bannerImageUrl: null, format: 'TV', season: 'FALL', seasonYear: 2023, episodes: 28, genres: ['Adventure'], popularity: 1, averageScore: 90, trending: 2, startDate: null, nextAiringAt: null,
}
const ready = (key: 'trending' | 'seasonal' | 'recommendations' | 'upcoming') => ({ status: 'ready' as const, section: { key, items: [anime], refreshedAt: 1, expiresAt: 2 } })
const data: DiscoverPageData = { sections: { trending: ready('trending'), seasonal: ready('seasonal'), recommendations: ready('recommendations'), upcoming: ready('upcoming') } }

const renderPage = (pageData: DiscoverPageData | null, isLoading: boolean): void => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}><DiscoverPage data={pageData} isLoading={isLoading} searchState={searchState} onSearchStateChange={vi.fn()} /></QueryClientProvider>)
}

afterEach(() => {
  cleanup()
  serverMocks.refreshDiscoverSection.mockReset()
  serverMocks.searchAnime.mockReset()
})

describe('DiscoverPage', () => {
  it('uses compact Upcoming modules and one manga placeholder for each responsive branch', () => {
    renderPage(data, false)

    expect(screen.getAllByRole('heading', { name: 'Upcoming' })).toHaveLength(2)
    expect(document.querySelectorAll('#upcoming-mobile-heading')).toHaveLength(1)
    expect(document.querySelectorAll('#upcoming-desktop-heading')).toHaveLength(1)
    expect(screen.getAllByText('Manga lists later')).toHaveLength(2)
  })

  it('keeps poster cards display-only and shows an explicit image failure state', () => {
    renderPage(data, false)

    const image = screen.getAllByAltText('Frieren cover')[0]
    const card = image.closest('article')
    fireEvent.error(image)
    expect(screen.getAllByText('Image unavailable').length).toBeGreaterThan(0)
    expect(card).toBeTruthy()
    expect(card?.querySelector('a,button') ?? null).toBeNull()
  })

  it('renders rail skeletons while page data is loading', () => {
    renderPage(null, true)

    expect(screen.getByLabelText('Trending Anime loading')).toBeTruthy()
  })

  it('keeps a section error visible when its refresh request rejects', async () => {
    const errorData: DiscoverPageData = {
      sections: { ...data.sections, trending: { status: 'error', key: 'trending', code: 'UPSTREAM', retryAfterSeconds: null } },
    }
    serverMocks.refreshDiscoverSection.mockRejectedValueOnce(new Error('AniList unavailable'))
    renderPage(errorData, false)

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
    renderPage(errorData, false)

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
