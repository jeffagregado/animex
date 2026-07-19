// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { AnimeSummary } from '../shared/discover-contracts'
import { DiscoverWeeklyList } from './discover-weekly-list'

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
  publicId: 'anime_frieren',
  slug: 'frieren',
  titles: { display: 'Frieren', english: 'Frieren', romaji: 'Sousou no Frieren', native: null },
  coverImageUrl: 'https://example.test/frieren.jpg',
  bannerImageUrl: null,
  format: 'TV',
  season: 'FALL',
  seasonYear: 2023,
  episodes: 28,
  genres: ['Adventure'],
  popularity: 100,
  averageScore: 90,
  trending: 42,
  startDate: null,
  nextAiringAt: null,
}

afterEach(cleanup)

describe('DiscoverWeeklyList', () => {
  it.each(['desktop', 'mobile'] as const)('links the %s row to its canonical anime route', (variant) => {
    render(<DiscoverWeeklyList items={[anime]} variant={variant} />)

    const link = screen.getByRole('link', { name: /Frieren/ })
    expect(link.dataset.to).toBe('/anime/$publicId/$slug')
    expect(link.getAttribute('href')).toBe('/anime/anime_frieren/frieren')
    expect(link.className).toContain('focus-visible:ring-2')
  })
  it('matches the desktop weekly row content and metric hierarchy', () => {
    render(<DiscoverWeeklyList items={[anime]} variant="desktop" />)

    expect(screen.getByText('1')).toBeTruthy()
    expect(screen.getByAltText('Frieren cover')).toBeTruthy()
    expect(screen.getByText('Frieren')).toBeTruthy()
    expect(screen.getByText('2023 · TV')).toBeTruthy()
    expect(screen.getByLabelText('Trending: 42')).toBeTruthy()
    expect(document.querySelectorAll('.text-coral-400')).toHaveLength(2)
  })

  it('shows an explicit image fallback after a desktop cover fails', () => {
    render(<DiscoverWeeklyList items={[anime]} variant="desktop" />)

    fireEvent.error(screen.getByAltText('Frieren cover'))

    expect(screen.getByLabelText('Image unavailable')).toBeTruthy()
  })

  it('shows an explicit image fallback when a desktop cover is missing', () => {
    render(<DiscoverWeeklyList items={[{ ...anime, coverImageUrl: null }]} variant="desktop" />)

    expect(screen.getByLabelText('Image unavailable')).toBeTruthy()
  })

  it('preserves the compact mobile row without desktop-only details', () => {
    render(<DiscoverWeeklyList items={[anime]} variant="mobile" />)

    expect(screen.getByText('1')).toBeTruthy()
    expect(screen.getByText('Frieren')).toBeTruthy()
    expect(screen.getByText('42')).toBeTruthy()
    expect(screen.queryByAltText('Frieren cover')).toBeNull()
    expect(screen.queryByText('2023 · TV')).toBeNull()
  })
})
