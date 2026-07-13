// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { AnimeSummary } from '../shared/discover-contracts'
import { DiscoverWeeklyList } from './discover-weekly-list'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, params }: { children: React.ReactNode; params: { anilistId: string; slug: string } }) => <a href={`/anime/${params.anilistId}/${params.slug}`}>{children}</a>,
}))

const anime: AnimeSummary = {
  anilistId: 1,
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

    expect(screen.getByRole('link', { name: /Frieren/ }).getAttribute('href')).toBe('/anime/1/frieren')
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
