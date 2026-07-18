import { readFile } from 'node:fs/promises'

import { describe, expect, test } from 'vitest'

import {
  DISCOVER_PROVIDER_SECTION_CONFIG,
  DISCOVER_PROVIDER_SECTION_KEYS,
  animeSummaryProviderSchema,
  type AnimeSummaryProvider,
  type DiscoverPageDataProvider,
} from './discover-provider-cache-contracts.server'

const source = async (fileName: string): Promise<string> => await readFile(
  new URL(fileName, import.meta.url),
  'utf8',
)

const summary = {
  anilistId: 52991,
  slug: 'frieren-beyond-journeys-end',
  titles: {
    display: 'Frieren: Beyond Journey\'s End',
    english: 'Frieren: Beyond Journey\'s End',
    romaji: 'Sousou no Frieren',
    native: null,
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
  nextAiringAt: null,
} satisfies AnimeSummaryProvider

describe('Discover provider and cache contracts', () => {
  test('keeps exact numeric summary identity, section keys, and cache policy', () => {
    expect(animeSummaryProviderSchema.parse(summary)).toEqual(summary)
    expect(() => animeSummaryProviderSchema.parse({
      ...summary,
      anilistId: '52991',
    })).toThrow()
    expect(DISCOVER_PROVIDER_SECTION_KEYS).toEqual([
      'trending',
      'seasonal',
      'recommendations',
      'upcoming',
    ])
    expect(DISCOVER_PROVIDER_SECTION_CONFIG).toEqual({
      trending: { ttlMs: 3 * 60 * 60 * 1000, itemLimit: 12 },
      seasonal: { ttlMs: 24 * 60 * 60 * 1000, itemLimit: 12 },
      recommendations: { ttlMs: 24 * 60 * 60 * 1000, itemLimit: 16 },
      upcoming: { ttlMs: 6 * 60 * 60 * 1000, itemLimit: 10 },
    })
  })

  test('keeps exact ready and error page states', () => {
    const page: DiscoverPageDataProvider = {
      sections: {
        trending: {
          status: 'ready',
          section: {
            key: 'trending',
            items: [summary],
            refreshedAt: 1,
            expiresAt: 2,
          },
        },
        seasonal: {
          status: 'error',
          key: 'seasonal',
          code: 'UPSTREAM',
          retryAfterSeconds: null,
        },
        recommendations: {
          status: 'error',
          key: 'recommendations',
          code: 'RATE_LIMITED',
          retryAfterSeconds: 30,
        },
        upcoming: {
          status: 'error',
          key: 'upcoming',
          code: 'CACHE_REFRESH',
          retryAfterSeconds: null,
        },
      },
    }

    expect(page.sections).toMatchObject({
      trending: { status: 'ready' },
      seasonal: { code: 'UPSTREAM' },
      recommendations: { code: 'RATE_LIMITED' },
      upcoming: { code: 'CACHE_REFRESH' },
    })
  })

  test('keeps provider normalization and cache independent from browser DTOs', async () => {
    const sources = await Promise.all([
      source('discover-provider-cache-contracts.server.ts'),
      source('anilist-normalization.server.ts'),
      source('discover-cache.server.ts'),
    ])

    for (const moduleSource of sources) {
      expect(moduleSource).not.toContain('../shared/discover-contracts')
    }
  })
})
