// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { AnimeSummary } from '../shared/discover-contracts'
import { DiscoverUpcomingList } from './discover-upcoming-list'

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

const anime: AnimeSummary = {
  publicId: 'anime_frieren', slug: 'frieren', titles: { display: 'Frieren', english: 'Frieren', romaji: 'Sousou no Frieren', native: null }, coverImageUrl: null, bannerImageUrl: null, format: 'TV', season: 'FALL', seasonYear: 2023, episodes: 28, genres: ['Adventure'], popularity: 100, averageScore: 90, trending: 42, startDate: null, nextAiringAt: null,
}

afterEach(cleanup)

describe('DiscoverUpcomingList', () => {
  it.each(['desktop', 'mobile'] as const)('links the %s row to its canonical anime route', (variant) => {
    render(<DiscoverUpcomingList state={{ status: 'ready', section: { key: 'upcoming', items: [anime], refreshedAt: 1, expiresAt: 2 } }} onRetry={vi.fn()} isRetrying={false} retryError={null} variant={variant} />)

    const link = screen.getByRole('link', { name: /Frieren/ })
    expect(link.dataset.to).toBe('/anime/$publicId/$slug')
    expect(link.getAttribute('href')).toBe('/anime/anime_frieren/frieren')
    expect(link.className).toContain('focus-visible:ring-2')
  })
})
