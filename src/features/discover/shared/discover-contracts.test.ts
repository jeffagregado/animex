import { describe, expect, test } from 'vitest'
import { ZodError } from 'zod'

import {
  DISCOVER_GENRES,
  DISCOVER_SECTION_CONFIG,
  animeSearchInputSchema,
  getAnimeSeason,
  normalizeAnimeSummary,
  slugifyAnimeTitle,
  type AnimeGenre,
  type DiscoverPageData,
  type DiscoverSectionState,
} from './discover-contracts'

const validMedia = {
  id: 52991,
  type: 'ANIME',
  isAdult: false,
  title: {
    english: 'Frieren: Beyond Journey\'s End',
    romaji: 'Sousou no Frieren',
    native: '\u846c\u9001\u306e\u30d5\u30ea\u30fc\u30ec\u30f3',
  },
  coverImage: { large: 'https://img.example/frieren.jpg' },
  bannerImage: null,
  format: 'TV',
  season: 'FALL',
  seasonYear: 2023,
  episodes: 28,
  genres: [' Adventure ', 'Drama', 'Adventure', ''],
  popularity: 1_234_567,
  averageScore: 91,
  trending: 12_345,
  startDate: { year: 2023, month: 9, day: 29 },
  nextAiringEpisode: { airingAt: 1_735_689_600 },
}

describe('discover contracts', () => {
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

  test('normalizes valid lightweight AniList media', () => {
    expect(normalizeAnimeSummary(validMedia)).toEqual({
      anilistId: 52991,
      slug: 'frieren-beyond-journeys-end',
      titles: {
        display: 'Frieren: Beyond Journey\'s End',
        english: 'Frieren: Beyond Journey\'s End',
        romaji: 'Sousou no Frieren',
        native: '\u846c\u9001\u306e\u30d5\u30ea\u30fc\u30ec\u30f3',
      },
      coverImageUrl: 'https://img.example/frieren.jpg',
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
      nextAiringAt: 1_735_689_600,
    })
  })

  test('uses Romaji then Native when higher-priority titles are absent', () => {
    expect(normalizeAnimeSummary({
      ...validMedia,
      title: { english: null, romaji: 'Kimi no Na wa.', native: '\u541b\u306e\u540d\u306f\u3002' },
    }).titles.display).toBe('Kimi no Na wa.')
    expect(normalizeAnimeSummary({
      ...validMedia,
      title: { english: null, romaji: null, native: '\u541b\u306e\u540d\u306f\u3002' },
    }).titles.display).toBe('\u541b\u306e\u540d\u306f\u3002')
  })

  test('rejects adult, non-anime, untitled, invalid-id, and malformed metric media', () => {
    expect(() => normalizeAnimeSummary({ ...validMedia, isAdult: true })).toThrow('Adult media is not supported.')
    expect(() => normalizeAnimeSummary({ ...validMedia, type: 'MANGA' })).toThrow('Invalid AniList media')
    expect(() => normalizeAnimeSummary({ ...validMedia, id: 0 })).toThrow('Invalid AniList media')
    expect(() => normalizeAnimeSummary({
      ...validMedia,
      title: { english: null, romaji: null, native: null },
    })).toThrow('AniList media requires a title.')
    expect(() => normalizeAnimeSummary({ ...validMedia, popularity: 'many' })).toThrow('Invalid AniList media')
  })

  test('reports Zod validation paths without exposing media payloads', () => {
    try {
      normalizeAnimeSummary({
        ...validMedia,
        startDate: { year: 2023, month: 13, day: 32 },
      })
      throw new Error('Expected normalization to fail.')
    } catch (error) {
      expect(error).toBeInstanceOf(TypeError)
      expect((error as Error).message).toContain('startDate.month')
      expect((error as Error).message).toContain('Too big')
      expect((error as Error).cause).toBeInstanceOf(ZodError)
    }
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
