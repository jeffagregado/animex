import { describe, expect, test } from 'vitest'

import {
  CatalogIdentityGatewayError,
  type CatalogProviderRef,
} from '../../catalog-identity/server/catalog-identity.server'
import type { AnimeSummaryProvider } from './discover-provider-cache-contracts.server'
import {
  toPublicAnimeSearchPage,
  toPublicDiscoverPage,
  type DiscoverIdentityDependencies,
} from './discover-public-metadata.server'

const summary = (anilistId: number): AnimeSummaryProvider => ({
  anilistId,
  slug: `anime-${anilistId}`,
  titles: { display: `Anime ${anilistId}`, english: null, romaji: null, native: null },
  coverImageUrl: null,
  bannerImageUrl: null,
  format: 'TV',
  season: null,
  seasonYear: null,
  episodes: null,
  genres: ['Action'],
  popularity: 10,
  averageScore: null,
  trending: null,
  startDate: null,
  nextAiringAt: null,
})

const createDependencies = (): {
  dependencies: DiscoverIdentityDependencies
  resolved: CatalogProviderRef[][]
} => {
  const resolved: CatalogProviderRef[][] = []
  return {
    dependencies: {
      ensurePublicIds: async () => {
        throw new Error('Ensure must not run for verified cache data.')
      },
      resolvePublicIds: async (refs) => {
        resolved.push([...refs])
        return refs.map((ref) => ({ publicId: `anime_${ref.providerId}`, kind: ref.kind }))
      },
    },
    resolved,
  }
}

describe('Discover public metadata', () => {
  test('resolves all ready cached rails once and strips provider identity', async () => {
    const fixture = createDependencies()

    const page = await toPublicDiscoverPage({
      sections: {
        trending: {
          status: 'ready',
          section: {
            key: 'trending',
            items: [summary(1), summary(2)],
            refreshedAt: 1,
            expiresAt: 2,
          },
        },
        seasonal: {
          status: 'ready',
          section: {
            key: 'seasonal',
            items: [summary(2)],
            refreshedAt: 1,
            expiresAt: 2,
          },
        },
        recommendations: {
          status: 'error',
          key: 'recommendations',
          code: 'UPSTREAM',
          retryAfterSeconds: null,
        },
        upcoming: {
          status: 'error',
          key: 'upcoming',
          code: 'CACHE_REFRESH',
          retryAfterSeconds: null,
        },
      },
    }, fixture.dependencies)

    expect(fixture.resolved).toEqual([[
      { provider: 'anilist', kind: 'anime', providerId: 1 },
      { provider: 'anilist', kind: 'anime', providerId: 2 },
    ]])
    expect(page.sections.trending).toMatchObject({
      status: 'ready',
      section: {
        items: [
          { publicId: 'anime_1', slug: 'anime-1' },
          { publicId: 'anime_2', slug: 'anime-2' },
        ],
      },
    })
    expect(JSON.stringify(page)).not.toContain('anilistId')
  })

  test('ensures one bounded live search response and returns public summaries', async () => {
    const ensured: CatalogProviderRef[][] = []
    const dependencies: DiscoverIdentityDependencies = {
      ensurePublicIds: async (refs) => {
        ensured.push([...refs])
        return refs.map((ref) => ({ publicId: `anime_${ref.providerId}`, kind: ref.kind }))
      },
      resolvePublicIds: async () => {
        throw new Error('Resolve must not run for live provider data.')
      },
    }

    const page = await toPublicAnimeSearchPage({
      items: [summary(4), summary(5)],
      currentPage: 2,
      hasNextPage: true,
      perPage: 20,
    }, dependencies)

    expect(ensured).toHaveLength(1)
    expect(page).toMatchObject({
      items: [{ publicId: 'anime_4' }, { publicId: 'anime_5' }],
      currentPage: 2,
      hasNextPage: true,
      perPage: 20,
    })
    expect(JSON.stringify(page)).not.toContain('anilistId')
  })

  test('raises missing mapping from verified cache reads', async () => {
    const fixture = createDependencies()
    fixture.dependencies.resolvePublicIds = async () => {
      throw new CatalogIdentityGatewayError('CATALOG_IDENTITY_MISSING')
    }

    await expect(toPublicDiscoverPage({
      sections: {
        trending: {
          status: 'ready',
          section: {
            key: 'trending',
            items: [summary(1)],
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
          code: 'UPSTREAM',
          retryAfterSeconds: null,
        },
        upcoming: {
          status: 'error',
          key: 'upcoming',
          code: 'UPSTREAM',
          retryAfterSeconds: null,
        },
      },
    }, fixture.dependencies)).rejects.toMatchObject({
      code: 'CATALOG_IDENTITY_MISSING',
    })
  })
})
