// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { AnimeSummary } from '../shared/discover-contracts'
import { DiscoverUpcomingList } from './discover-upcoming-list'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, params }: { children: React.ReactNode; params: { anilistId: string; slug: string } }) => <a href={`/anime/${params.anilistId}/${params.slug}`}>{children}</a>,
}))

const anime: AnimeSummary = {
  anilistId: 1, slug: 'frieren', titles: { display: 'Frieren', english: 'Frieren', romaji: 'Sousou no Frieren', native: null }, coverImageUrl: null, bannerImageUrl: null, format: 'TV', season: 'FALL', seasonYear: 2023, episodes: 28, genres: ['Adventure'], popularity: 100, averageScore: 90, trending: 42, startDate: null, nextAiringAt: null,
}

afterEach(cleanup)

describe('DiscoverUpcomingList', () => {
  it.each(['desktop', 'mobile'] as const)('links the %s row to its canonical anime route', (variant) => {
    render(<DiscoverUpcomingList state={{ status: 'ready', section: { key: 'upcoming', items: [anime], refreshedAt: 1, expiresAt: 2 } }} onRetry={vi.fn()} isRetrying={false} retryError={null} variant={variant} />)

    expect(screen.getByRole('link', { name: /Frieren/ }).getAttribute('href')).toBe('/anime/1/frieren')
  })
})
