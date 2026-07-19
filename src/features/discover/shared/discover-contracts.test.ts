import { describe, expect, test } from 'vitest'

import {
  DISCOVER_GENRES,
  DISCOVER_SECTION_CONFIG,
  animeSearchInputSchema,
  animeSummarySchema,
  getAnimeSeason,
  slugifyAnimeTitle,
  type AnimeGenre,
  type DiscoverPageData,
  type DiscoverSectionState,
} from './discover-contracts'

describe('discover contracts', () => {
  test('accepts only strict browser summaries with opaque public IDs', () => {
    const summary = {
      publicId: 'anime_frieren_52991',
      slug: 'frieren-beyond-journeys-end',
      titles: {
        display: 'Frieren: Beyond Journey\'s End',
        english: 'Frieren: Beyond Journey\'s End',
        romaji: 'Sousou no Frieren',
        native: null,
      },
      coverImageUrl: null,
      bannerImageUrl: null,
      format: 'TV',
      season: 'FALL',
      seasonYear: 2023,
      episodes: 28,
      genres: ['Adventure', 'Drama'],
      popularity: 1_234_567,
      averageScore: 91,
      trending: 12_345,
      startDate: { year: 2023, month: 9, day: 29 },
      nextAiringAt: null,
    }

    expect(animeSummarySchema.parse(summary)).toEqual(summary)
    expect(() => animeSummarySchema.parse({ ...summary, publicId: '52991' })).toThrow(
      'CATALOG_PUBLIC_ID_INVALID',
    )
    expect(() => animeSummarySchema.parse({ ...summary, anilistId: 52991 })).toThrow()
  })

  test('defines the exact local Discover genre union', () => {
    const genre: AnimeGenre = 'Action'

    expect(genre).toBe('Action')
    expect(DISCOVER_GENRES).toEqual([
      'Action',
      'Adventure',
      'Comedy',
      'Drama',
      'Fantasy',
      'Romance',
      'Sci-Fi',
      'Slice of Life',
      'Mystery',
      'Supernatural',
    ])
  })

  test('defines exact discover cache TTLs and item limits', () => {
    expect(DISCOVER_SECTION_CONFIG).toEqual({
      trending: { ttlMs: 3 * 60 * 60 * 1000, itemLimit: 12 },
      seasonal: { ttlMs: 24 * 60 * 60 * 1000, itemLimit: 12 },
      recommendations: { ttlMs: 24 * 60 * 60 * 1000, itemLimit: 16 },
      upcoming: { ttlMs: 6 * 60 * 60 * 1000, itemLimit: 10 },
    })
  })

  test.each([
    [Date.UTC(2026, 0, 1), 'WINTER'],
    [Date.UTC(2026, 2, 31), 'WINTER'],
    [Date.UTC(2026, 3, 1), 'SPRING'],
    [Date.UTC(2026, 5, 30), 'SPRING'],
    [Date.UTC(2026, 6, 1), 'SUMMER'],
    [Date.UTC(2026, 8, 30), 'SUMMER'],
    [Date.UTC(2026, 9, 1), 'FALL'],
    [Date.UTC(2026, 11, 31), 'FALL'],
  ])('maps UTC timestamp %i to %s', (timestampMs, expectedSeason) => {
    expect(getAnimeSeason(timestampMs)).toBe(expectedSeason)
  })

  test('parses trimmed search input with exact filters', () => {
    expect(animeSearchInputSchema.parse({
      query: '  frieren  ',
      genre: 'Mystery',
      format: 'TV',
      season: 'FALL',
      year: 2023,
      sort: 'score',
      page: 2,
    })).toEqual({
      query: 'frieren',
      genre: 'Mystery',
      format: 'TV',
      season: 'FALL',
      year: 2023,
      sort: 'score',
      page: 2,
    })
  })

  test('rejects empty searches, invalid filters, and invalid pages', () => {
    const baseInput = {
      query: null,
      genre: null,
      format: null,
      season: null,
      year: null,
      sort: 'relevance',
      page: 1,
    }

    expect(() => animeSearchInputSchema.parse(baseInput)).toThrow('Choose a search term or filter.')
    expect(() => animeSearchInputSchema.parse({ ...baseInput, query: 'a' })).toThrow()
    expect(() => animeSearchInputSchema.parse({ ...baseInput, query: '   ' })).toThrow()
    expect(() => animeSearchInputSchema.parse({ ...baseInput, query: 'a'.repeat(101) })).toThrow()
    expect(animeSearchInputSchema.parse({ ...baseInput, query: 'a'.repeat(100) }).query).toHaveLength(100)
    expect(() => animeSearchInputSchema.parse({ ...baseInput, genre: 'Adventure', page: 0 })).toThrow()
    expect(() => animeSearchInputSchema.parse({ ...baseInput, genre: 'Adventure', format: 'MANGA' })).toThrow()
    expect(() => animeSearchInputSchema.parse({ ...baseInput, genre: 'Horror' })).toThrow()
    expect(animeSearchInputSchema.parse({ ...baseInput, year: 1 }).year).toBe(1)
    expect(() => animeSearchInputSchema.parse({ ...baseInput, year: 0 })).toThrow()
    expect(() => animeSearchInputSchema.parse({ ...baseInput, genre: 'Adventure', extra: true })).toThrow()
  })

  test('creates Unicode-safe normalized slugs without synthetic fallbacks', () => {
    expect(slugifyAnimeTitle('  \u846c\u9001\u306e\u30d5\u30ea\u30fc\u30ec\u30f3 !!!  ')).toBe('\u846c\u9001\u306e\u30d5\u30ea\u30fc\u30ec\u30f3')
    expect(slugifyAnimeTitle('My--Anime___List')).toBe('my-anime-list')
    expect(() => slugifyAnimeTitle(' !!! ')).toThrow('Anime title cannot produce a slug.')
  })

  test('keeps ready and error page states within shared contract types', () => {
    const sectionState: DiscoverSectionState = {
      status: 'error',
      key: 'upcoming',
      code: 'RATE_LIMITED',
      retryAfterSeconds: 30,
    }
    const pageData: DiscoverPageData = {
      sections: {
        trending: sectionState,
        seasonal: { status: 'ready', section: { key: 'seasonal', items: [], refreshedAt: 1, expiresAt: 2 } },
        recommendations: { status: 'error', key: 'recommendations', code: 'UPSTREAM', retryAfterSeconds: null },
        upcoming: { status: 'error', key: 'upcoming', code: 'CACHE_REFRESH', retryAfterSeconds: null },
      },
    }

    expect(pageData.sections.trending.status).toBe('error')
  })
})
