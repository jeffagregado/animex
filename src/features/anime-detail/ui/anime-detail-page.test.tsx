// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { AnimeDetail, PublicAnimeDetailState } from '../shared/anime-detail-contracts'
import { AnimeDetailPage } from './anime-detail-page'

vi.mock('./anime-user-controls', () => ({ AnimeUserControls: () => <div>User controls</div> }))
vi.mock('../server/anime-detail.functions', () => ({ getAnimePeoplePage: vi.fn() }))

const page = { items: [], currentPage: 1, hasNextPage: false, perPage: 24 as const }
const detail: AnimeDetail = {
  anilistId: 1,
  slug: 'frieren',
  titles: { display: 'Frieren', english: 'Frieren', romaji: 'Sousou no Frieren', native: '葬送のフリーレン' },
  coverImageUrl: null,
  bannerImageUrl: null,
  synopsis: 'An elven mage learns about humanity.',
  format: 'TV',
  status: 'FINISHED',
  source: 'MANGA',
  season: 'FALL',
  seasonYear: 2023,
  episodes: 28,
  durationMinutes: 24,
  startDate: null,
  endDate: null,
  genres: ['Adventure'],
  mainStudio: { name: 'Madhouse', siteUrl: null },
  related: [{ anilistId: 2, slug: 'fern', title: 'Fern', coverImageUrl: null, format: 'TV', seasonYear: 2024 }],
  recommendations: [{ anilistId: 3, slug: 'apothecary-diaries', title: 'The Apothecary Diaries', coverImageUrl: null, format: 'TV', seasonYear: 2023 }],
  trailer: { youtubeId: 'abc123', thumbnailUrl: null },
  externalLinks: [{ site: 'Crunchyroll', url: 'https://www.crunchyroll.com/series/abc' }],
  charactersPage: page,
  staffPage: page,
}
const state: PublicAnimeDetailState = { status: 'ready', entry: { detail, refreshedAt: 1, expiresAt: 86_400_001 } }

afterEach(cleanup)

describe('AnimeDetailPage', () => {
  it('renders one shell, explicit missing artwork, and changes tabs through public intent', () => {
    const onTabChange = vi.fn()
    render(<AnimeDetailPage state={state} tab="overview" onTabChange={onTabChange} />)
    expect(screen.getByRole('main').className).toContain('grid-cols-[minmax(0,1fr)]')
    expect(screen.getByRole('heading', { name: 'Frieren' })).toBeTruthy()
    expect(screen.getAllByText('Image unavailable').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('tab', { name: 'Staff' }))
    expect(onTabChange).toHaveBeenCalledWith('staff')
  })

  it('shows truthful empty Reviews state', () => {
    render(<AnimeDetailPage state={state} tab="reviews" onTabChange={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'No reviews yet' })).toBeTruthy()
    expect(screen.getByText('Average rating unavailable · 0 reviews')).toBeTruthy()
  })

  it('keeps compact sidebar rows, secure outbound links, and tabs stable', () => {
    render(<AnimeDetailPage state={state} tab="staff" onTabChange={vi.fn()} />)

    const sidebar = screen.getByLabelText('More anime information')
    expect(within(sidebar).getAllByRole('heading').map((heading) => heading.textContent)).toEqual(['Related Anime', 'Recommendations', 'Trailer', 'External Links'])
    expect(screen.getByRole('tabpanel').compareDocumentPosition(sidebar) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(Node.DOCUMENT_POSITION_FOLLOWING)

    expect(screen.getByRole('link', { name: /Fern/ }).textContent).toContain('Fern')
    expect(screen.getByText('TV · 2024')).toBeTruthy()
    expect(screen.getByRole('link', { name: /The Apothecary Diaries/ }).textContent).toContain('The Apothecary Diaries')
    expect(screen.getByText('TV · 2023')).toBeTruthy()

    const trailer = screen.getByRole('link', { name: /Watch on YouTube/ })
    expect(trailer.getAttribute('href')).toBe('https://www.youtube.com/watch?v=abc123')
    expect(trailer.getAttribute('target')).toBe('_blank')
    expect(trailer.getAttribute('rel')).toBe('noreferrer')

    const external = screen.getByRole('link', { name: 'Crunchyroll' })
    expect(external.getAttribute('href')).toBe('https://www.crunchyroll.com/series/abc')
    expect(external.getAttribute('target')).toBe('_blank')
    expect(external.getAttribute('rel')).toBe('noreferrer')

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Overview', 'Reviews', 'Characters', 'Staff'])
    expect(screen.getByRole('tab', { name: 'Staff' }).getAttribute('aria-selected')).toBe('true')
  })

  it('shows populated and unavailable Overview metadata without changing the tab panel', () => {
    const { rerender } = render(<AnimeDetailPage state={state} tab="overview" onTabChange={vi.fn()} />)
    expect(screen.getByText('TV').tagName).toBe('DD')
    expect(screen.getByText('Finished').tagName).toBe('DD')
    expect(screen.getByText('Fall 2023').tagName).toBe('DD')
    expect(screen.getByText('Adventure').tagName).toBe('DD')
    expect(screen.getByText('Unknown to Unknown').tagName).toBe('DD')

    const unavailable: AnimeDetail = { ...detail, format: null, status: null, source: null, season: null, seasonYear: null, episodes: null, durationMinutes: null, genres: [], mainStudio: null, titles: { ...detail.titles, english: null, native: null } }
    rerender(<AnimeDetailPage state={{ status: 'ready', entry: { detail: unavailable, refreshedAt: 1, expiresAt: 86_400_001 } }} tab="overview" onTabChange={vi.fn()} />)
    expect(screen.getAllByText('Unknown').length).toBeGreaterThanOrEqual(9)
    expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe('anime-tab-overview')
  })

  it('supports roving keyboard tabs with linked tabpanel semantics', () => {
    const onTabChange = vi.fn()
    render(<AnimeDetailPage state={state} tab="overview" onTabChange={onTabChange} />)
    const overview = screen.getByRole('tab', { name: 'Overview' })
    const reviews = screen.getByRole('tab', { name: 'Reviews' })
    expect(overview.tabIndex).toBe(0); expect(reviews.tabIndex).toBe(-1)
    fireEvent.keyDown(overview, { key: 'ArrowRight' })
    expect(onTabChange).toHaveBeenCalledWith('reviews')
    expect(reviews.getAttribute('aria-controls')).toBe('anime-panel-reviews')
    expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe('anime-tab-overview')
  })

  it('shows distinct not-found and rate-limit states', () => {
    const { rerender } = render(<AnimeDetailPage state={{ status: 'not-found', code: 'NOT_FOUND', message: 'Missing.' }} tab="overview" onTabChange={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Anime not found' })).toBeTruthy()
    rerender(<AnimeDetailPage state={{ status: 'error', code: 'RATE_LIMITED', message: 'Wait.', retryAfterSeconds: 10 }} tab="overview" onTabChange={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'AniList rate limit reached' })).toBeTruthy()
  })
})
