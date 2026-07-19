// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'

import { CatalogPersonDescription } from './catalog-person-description'

afterEach(cleanup)

describe('CatalogPersonDescription', () => {
  test('renders opaque internal paths and safe external links', () => {
    render(<CatalogPersonDescription description={[
      '[Anime](/anime/anime_1/anime)',
      '[Character](/characters/character_2/character)',
      '[Staff](/staff/staff_3/staff)',
      '[Website](https://example.test/about)',
    ].join(' ')} />)

    expect(screen.getByRole('link', { name: 'Anime' }).getAttribute('href'))
      .toBe('/anime/anime_1/anime')
    expect(screen.getByRole('link', { name: 'Character' }).getAttribute('href'))
      .toBe('/characters/character_2/character')
    expect(screen.getByRole('link', { name: 'Staff' }).getAttribute('href'))
      .toBe('/staff/staff_3/staff')
    const website = screen.getByRole('link', { name: 'Website' })
    expect(website.getAttribute('href')).toBe('https://example.test/about')
    expect(website.getAttribute('target')).toBe('_blank')
    expect(website.getAttribute('rel')).toBe('noopener noreferrer')
  })

  test('does not link numeric internal IDs or unsafe schemes', () => {
    render(<CatalogPersonDescription description={[
      '[Numeric](/staff/21/person)',
      '[Unsafe](javascript:alert)',
    ].join(' ')} />)

    expect(screen.queryByRole('link', { name: 'Numeric' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Unsafe' })).toBeNull()
    expect(screen.getByText(/Numeric Unsafe/)).toBeTruthy()
  })

  test('treats AniList URLs as external instead of parsing provider IDs', () => {
    render(<CatalogPersonDescription description={
      '[Provider](https://anilist.co/staff/21/person)'
    } />)

    const provider = screen.getByRole('link', { name: 'Provider' })
    expect(provider.getAttribute('href')).toBe('https://anilist.co/staff/21/person')
    expect(provider.getAttribute('target')).toBe('_blank')
  })
})
