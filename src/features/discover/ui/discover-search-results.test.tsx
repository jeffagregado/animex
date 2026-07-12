// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { AnimeSearchPage, AnimeSummary } from '../shared/discover-contracts'
import { DiscoverSearchResults } from './discover-search-results'
import type { DiscoverUrlSearchState } from './discover-ui.types'

const serverMocks = vi.hoisted(() => ({ searchAnime: vi.fn() }))
const observerCallbacks: IntersectionObserverCallback[] = []

class TestIntersectionObserver {
  constructor(callback: IntersectionObserverCallback) {
    observerCallbacks.push(callback)
  }

  disconnect(): void {}
  observe(): void {}
  takeRecords(): IntersectionObserverEntry[] { return [] }
  unobserve(): void {}
  root: Element | Document | null = null
  rootMargin = '0px'
  thresholds: ReadonlyArray<number> = []
}

vi.mock('../server/discover.functions', () => ({
  searchAnime: serverMocks.searchAnime,
}))

const searchState: DiscoverUrlSearchState = { query: 'frieren', genre: null, format: null, season: null, year: null, sort: 'relevance' }
const anime: AnimeSummary = {
  anilistId: 1, slug: 'frieren', titles: { display: 'Frieren', english: 'Frieren', romaji: 'Sousou no Frieren', native: null }, coverImageUrl: 'https://example.test/frieren.jpg', bannerImageUrl: null, format: 'TV', season: 'FALL', seasonYear: 2023, episodes: 28, genres: ['Adventure'], popularity: 1, averageScore: 90, trending: 2, startDate: null, nextAiringAt: null,
}

const page = (items: AnimeSummary[], currentPage: number, hasNextPage: boolean): AnimeSearchPage => ({ items, currentPage, hasNextPage, perPage: 20 })

const renderResults = (): void => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}><DiscoverSearchResults searchState={searchState} /></QueryClientProvider>)
}

afterEach(() => {
  cleanup()
  serverMocks.searchAnime.mockReset()
  observerCallbacks.length = 0
  vi.unstubAllGlobals()
})

describe('DiscoverSearchResults', () => {
  it('renders an average score badge', async () => {
    serverMocks.searchAnime.mockResolvedValueOnce(page([anime], 1, false))

    renderResults()

    expect(await screen.findByText('90%')).toBeTruthy()
    expect(screen.getByLabelText('Average score: 90 percent')).toBeTruthy()
  })

  it('renders an unavailable average score badge', async () => {
    serverMocks.searchAnime.mockResolvedValueOnce(page([{ ...anime, averageScore: null }], 1, false))

    renderResults()

    expect(await screen.findByText('—')).toBeTruthy()
    expect(screen.getByLabelText('Average score unavailable')).toBeTruthy()
  })

  it('keeps loaded results visible and exposes a specific retry when next page fails', async () => {
    serverMocks.searchAnime.mockResolvedValueOnce(page([anime], 1, true)).mockRejectedValueOnce({ code: 'RATE_LIMITED', retryAfterSeconds: 12 })

    renderResults()

    expect(await screen.findByText('Frieren')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
    expect((await screen.findByRole('status')).textContent).toContain('Try again in 12 seconds.')
    expect(screen.getByText('Frieren')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Retry loading more' })).toBeTruthy()
  })

  it('prevents manual next-page requests from racing each other', async () => {
    const nextPageResolver: { current: ((value: AnimeSearchPage) => void) | null } = { current: null }
    const nextPage = new Promise<AnimeSearchPage>((resolve) => {
      nextPageResolver.current = resolve
    })
    serverMocks.searchAnime.mockResolvedValueOnce(page([anime], 1, true)).mockReturnValueOnce(nextPage)

    renderResults()

    await screen.findByText('Frieren')
    const loadMore = screen.getByRole('button', { name: 'Load more' })
    fireEvent.click(loadMore)
    fireEvent.click(loadMore)
    expect(serverMocks.searchAnime).toHaveBeenCalledTimes(2)
    if (nextPageResolver.current === null) {
      throw new Error('Expected next page resolver.')
    }
    nextPageResolver.current(page([], 2, false))
  })

  it('keeps the next-page guard scoped to the active search after a query switch', async () => {
    vi.stubGlobal('IntersectionObserver', TestIntersectionObserver)
    const oldPageResolver: { current: ((value: AnimeSearchPage) => void) | null } = { current: null }
    const activePageResolver: { current: ((value: AnimeSearchPage) => void) | null } = { current: null }
    const oldPage = new Promise<AnimeSearchPage>((resolve) => { oldPageResolver.current = resolve })
    const activePage = new Promise<AnimeSearchPage>((resolve) => { activePageResolver.current = resolve })
    const demonSlayer = { ...anime, anilistId: 2, slug: 'demon-slayer', titles: { ...anime.titles, display: 'Demon Slayer' } }
    serverMocks.searchAnime
      .mockResolvedValueOnce(page([anime], 1, true))
      .mockReturnValueOnce(oldPage)
      .mockResolvedValueOnce(page([demonSlayer], 1, true))
      .mockReturnValueOnce(activePage)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const view = render(<QueryClientProvider client={client}><DiscoverSearchResults searchState={searchState} /></QueryClientProvider>)

    await screen.findByText('Frieren')
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
    view.rerender(<QueryClientProvider client={client}><DiscoverSearchResults searchState={{ ...searchState, query: 'demon' }} /></QueryClientProvider>)
    await screen.findByText('Demon Slayer')
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Loading more' })).toBeTruthy())
    if (oldPageResolver.current === null) {
      throw new Error('Expected old page resolver.')
    }
    oldPageResolver.current(page([], 2, false))
    await Promise.resolve()
    const observer = observerCallbacks.at(-1)
    if (observer === undefined) {
      throw new Error('Expected active search observer.')
    }
    observer([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)

    expect(serverMocks.searchAnime).toHaveBeenCalledTimes(4)
  })
})
