// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { AnimeSummary } from '../shared/discover-contracts'
import { DiscoverSectionRail } from './discover-section'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, params }: { children: React.ReactNode; params: { anilistId: string; slug: string } }) => <a href={`/anime/${params.anilistId}/${params.slug}`}>{children}</a>,
}))

const anime: AnimeSummary = {
  anilistId: 1, slug: 'frieren', titles: { display: 'Frieren', english: 'Frieren', romaji: 'Sousou no Frieren', native: null }, coverImageUrl: 'https://example.test/first.jpg', bannerImageUrl: null, format: 'TV', season: 'FALL', seasonYear: 2023, episodes: 28, genres: ['Adventure'], popularity: 1, averageScore: 90, trending: 2, startDate: null, nextAiringAt: null,
}

afterEach(() => {
  cleanup()
})

describe('DiscoverSectionRail', () => {
  it('links a rail card to its canonical anime route', () => {
    render(<DiscoverSectionRail title="Trending Anime" state={{ status: 'ready', section: { key: 'trending', items: [anime], refreshedAt: 1, expiresAt: 2 } }} onRetry={vi.fn()} isRetrying={false} retryError={null} />)

    expect(screen.getByRole('link', { name: /Frieren/ }).getAttribute('href')).toBe('/anime/1/frieren')
  })
  it('shows a clear section error and retries only that section', () => {
    const onRetry = vi.fn()

    render(
      <DiscoverSectionRail
        title="Trending Anime"
        state={{ status: 'error', key: 'trending', code: 'UPSTREAM', retryAfterSeconds: null }}
        onRetry={onRetry}
        isRetrying={false}
        retryError={null}
      />,
    )

    expect(screen.getByRole('alert').textContent).toContain('Trending Anime is unavailable.')
    fireEvent.click(screen.getByRole('button', { name: 'Retry Trending Anime' }))
    expect(onRetry).toHaveBeenCalledWith('trending')
  })

  it('disables only its retry control while a refresh is pending', () => {
    render(
      <DiscoverSectionRail
        title="Trending Anime"
        state={{ status: 'error', key: 'trending', code: 'UPSTREAM', retryAfterSeconds: null }}
        onRetry={vi.fn()}
        isRetrying={true}
        retryError={null}
      />,
    )

    expect(screen.getByRole('button', { name: 'Retry Trending Anime' })).toHaveProperty('disabled', true)
  })

  it('resets a failed rail image when the same anime receives a new cover URL', () => {
    const props = { title: 'Trending Anime', onRetry: vi.fn(), isRetrying: false, retryError: null }
    const view = render(<DiscoverSectionRail {...props} state={{ status: 'ready', section: { key: 'trending', items: [anime], refreshedAt: 1, expiresAt: 2 } }} />)

    fireEvent.error(screen.getByAltText('Frieren cover'))
    expect(screen.getByText('Image unavailable')).toBeTruthy()
    view.rerender(<DiscoverSectionRail {...props} state={{ status: 'ready', section: { key: 'trending', items: [{ ...anime, coverImageUrl: 'https://example.test/second.jpg' }], refreshedAt: 1, expiresAt: 2 } }} />)

    expect(screen.getByAltText('Frieren cover').getAttribute('src')).toBe('https://example.test/second.jpg')
  })

  it('adds accessible horizontal controls only when a section is ready with items', () => {
    const props = { title: 'Trending Anime', onRetry: vi.fn(), isRetrying: false, retryError: null }
    const view = render(<DiscoverSectionRail {...props} state={{ status: 'ready', section: { key: 'trending', items: [anime], refreshedAt: 1, expiresAt: 2 } }} />)

    expect(screen.getByRole('button', { name: 'Previous Trending Anime' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Next Trending Anime' })).toBeTruthy()

    view.rerender(<DiscoverSectionRail {...props} state={undefined} />)
    expect(screen.queryByRole('button', { name: 'Previous Trending Anime' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Next Trending Anime' })).toBeNull()
  })
})
