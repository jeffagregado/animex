import { describe, expect, test } from 'vitest'

import {
  CatalogIdentityGatewayError,
  type CatalogProviderRef,
} from '../../catalog-identity/server/catalog-identity.server'
import { mapAnimeDetail, mapAnimePeoplePage } from './anime-detail-public-mapper.server'
import { type AnimeDetailProvider } from './anime-detail-provider-cache-contracts.server'

const detail: AnimeDetailProvider = {
  anilistId: 1,
  slug: 'one',
  titles: { display: 'One', english: 'One', romaji: null, native: null },
  coverImageUrl: null,
  bannerImageUrl: null,
  synopsis: null,
  format: 'TV',
  status: 'FINISHED',
  source: null,
  season: null,
  seasonYear: null,
  episodes: 1,
  durationMinutes: 24,
  startDate: null,
  endDate: null,
  genres: [],
  mainStudio: null,
  related: [
    { anilistId: 2, slug: 'two', title: 'Two', coverImageUrl: null, format: 'TV', seasonYear: 2024 },
  ],
  recommendations: [
    { anilistId: 3, slug: 'three', title: 'Three', coverImageUrl: null, format: 'MOVIE', seasonYear: 2025 },
  ],
  trailer: null,
  externalLinks: [],
  charactersPage: {
    items: [{
      anilistId: 4,
      name: 'Character',
      role: 'MAIN',
      imageUrl: null,
      japaneseVoiceActor: {
        anilistId: 5,
        name: 'Voice Actor',
        imageUrl: null,
        language: 'Japanese',
      },
    }],
    currentPage: 1,
    hasNextPage: false,
    perPage: 24,
  },
  staffPage: {
    items: [{ anilistId: 6, name: 'Staff', role: 'Director', imageUrl: null }],
    currentPage: 1,
    hasNextPage: false,
    perPage: 24,
  },
}

const resolve = async (refs: readonly CatalogProviderRef[]) => refs.map((ref) => ({
  publicId: `${ref.kind}_${ref.providerId}`,
  kind: ref.kind,
}))

describe('anime detail public metadata mapper', () => {
  test('maps root and every nested provider identity without leaking numeric IDs', async () => {
    const mapped = await mapAnimeDetail(detail, resolve)

    expect(mapped).toMatchObject({
      publicId: 'anime_1',
      related: [{ publicId: 'anime_2' }],
      recommendations: [{ publicId: 'anime_3' }],
      charactersPage: {
        items: [{
          publicId: 'character_4',
          japaneseVoiceActor: { publicId: 'staff_5' },
        }],
      },
      staffPage: { items: [{ publicId: 'staff_6' }] },
    })
    expect(JSON.stringify(mapped)).not.toContain('anilistId')
  })

  test('deduplicates paginated people by public ID while preserving first-seen order', async () => {
    const page = {
      items: [
        { anilistId: 4, name: 'First', role: 'MAIN' as const, imageUrl: null, japaneseVoiceActor: null },
        { anilistId: 4, name: 'Duplicate', role: 'SUPPORTING' as const, imageUrl: null, japaneseVoiceActor: null },
      ],
      currentPage: 2,
      hasNextPage: false,
      perPage: 24 as const,
    }

    await expect(mapAnimePeoplePage(page, 'characters', resolve)).resolves.toMatchObject({
      items: [{ publicId: 'character_4', name: 'First' }],
      currentPage: 2,
    })
  })

  test('throws an explicit missing-identity error without provider fallback', async () => {
    await expect(mapAnimeDetail(detail, async () => [])).rejects.toEqual(
      new CatalogIdentityGatewayError('CATALOG_IDENTITY_MISSING'),
    )
  })
})
