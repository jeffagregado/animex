import { readFile } from 'node:fs/promises'

import { describe, expect, test } from 'vitest'
import { ZodError } from 'zod'

import { normalizeAnimeSummary } from './anilist-normalization.server'

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

describe('AniList server normalization', () => {
  test('stays independent from browser-public Discover contracts', async () => {
    const source = await readFile(
      new URL('./anilist-normalization.server.ts', import.meta.url),
      'utf8',
    )

    expect(source).not.toContain('../shared/discover-contracts')
  })

  test('normalizes valid lightweight media', () => {
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
})
