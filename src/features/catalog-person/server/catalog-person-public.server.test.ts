import { describe, expect, test } from 'vitest'

import {
  CatalogIdentityGatewayError,
  type CatalogProviderRef,
  type CatalogPublicIdentity,
} from '../../catalog-identity/server/catalog-identity.server'
import {
  mapCatalogPersonDetail,
  mapCatalogPersonSearchPage,
  mapCatalogPersonWorkPage,
  type CatalogPersonIdentityResolver,
} from './catalog-person-public.server'
import {
  type CatalogPersonProviderDetail,
  type CatalogPersonProviderSearchPage,
  type CatalogPersonProviderWorkPage,
} from './catalog-person-provider-cache-contracts.server'

const publicIdFor = (ref: CatalogProviderRef): string => `${ref.kind}_${ref.providerId}`

const identities = (): {
  ensure: CatalogPersonIdentityResolver
  resolve: CatalogPersonIdentityResolver
  ensured: CatalogProviderRef[][]
  resolved: CatalogProviderRef[][]
} => {
  const ensured: CatalogProviderRef[][] = []
  const resolved: CatalogProviderRef[][] = []
  const map = (refs: readonly CatalogProviderRef[]): CatalogPublicIdentity[] => refs.map((ref) => ({
    kind: ref.kind,
    publicId: publicIdFor(ref),
  }))
  return {
    ensured,
    resolved,
    ensure: async (refs) => {
      ensured.push([...refs])
      return map(refs)
    },
    resolve: async (refs) => {
      resolved.push([...refs])
      return map(refs)
    },
  }
}

const character: CatalogPersonProviderDetail = {
  kind: 'character',
  id: 12,
  name: 'Frieren',
  nativeName: null,
  imageUrl: null,
  description: [
    '[Series](https://anilist.co/anime/52991/frieren)',
    '[Friend](https://www.anilist.co/character/13/himmel)',
    '[Creator](https://anilist.co/staff/21/atsumi-tanezaki)',
    '[Site](https://example.test/about)',
  ].join(' '),
  age: null,
  gender: null,
  birthday: null,
  bloodType: null,
  voiceActorScope: 'all-languages',
  voiceActors: [{
    id: 21,
    name: 'Atsumi Tanezaki',
    imageUrl: null,
    language: 'Japanese',
  }],
}

describe('catalog person public mapping', () => {
  test('resolves cached detail identities and rewrites supported biography links', async () => {
    const { resolve, resolved } = identities()

    const detail = await mapCatalogPersonDetail(character, resolve)

    expect(resolved).toEqual([[
      { provider: 'anilist', kind: 'character', providerId: 12 },
      { provider: 'anilist', kind: 'staff', providerId: 21 },
      { provider: 'anilist', kind: 'anime', providerId: 52991 },
      { provider: 'anilist', kind: 'character', providerId: 13 },
    ]])
    expect(detail).toMatchObject({
      kind: 'character',
      publicId: 'character_12',
      voiceActors: [{ publicId: 'staff_21' }],
    })
    expect(detail).not.toHaveProperty('id')
    expect(detail.description).toContain('[Series](/anime/anime_52991/series)')
    expect(detail.description).toContain('[Friend](/characters/character_13/friend)')
    expect(detail.description).toContain('[Creator](/staff/staff_21/creator)')
    expect(detail.description).toContain('[Site](https://example.test/about)')
  })

  test('resolves cached work rows without changing order', async () => {
    const { resolve, resolved } = identities()
    const page: CatalogPersonProviderWorkPage = {
      items: [
        {
          anime: {
            id: 2,
            slug: 'second',
            title: 'Second',
            coverImageUrl: null,
            format: 'TV',
            seasonYear: 2025,
          },
          role: null,
        },
        {
          anime: {
            id: 1,
            slug: 'first',
            title: 'First',
            coverImageUrl: null,
            format: 'MOVIE',
            seasonYear: 2024,
          },
          role: 'Main',
        },
      ],
      currentPage: 1,
      hasNextPage: false,
      perPage: 20,
    }

    const result = await mapCatalogPersonWorkPage(page, resolve)

    expect(result.items.map((item) => item.anime.publicId)).toEqual(['anime_2', 'anime_1'])
    expect(resolved).toEqual([[
      { provider: 'anilist', kind: 'anime', providerId: 2 },
      { provider: 'anilist', kind: 'anime', providerId: 1 },
    ]])
  })

  test('ensures live search identities once and emits internal destinations', async () => {
    const { ensure, ensured, resolved } = identities()
    const page: CatalogPersonProviderSearchPage = {
      items: [{
        kind: 'staff',
        id: 21,
        name: 'Atsumi Tanezaki',
        nativeName: null,
        imageUrl: null,
      }],
      currentPage: 1,
      hasNextPage: false,
      perPage: 20,
    }

    const result = await mapCatalogPersonSearchPage(page, ensure)

    expect(result.items).toEqual([{
      kind: 'staff',
      publicId: 'staff_21',
      name: 'Atsumi Tanezaki',
      nativeName: null,
      imageUrl: null,
      destination: '/staff/staff_21/atsumi-tanezaki',
    }])
    expect(ensured).toEqual([[
      { provider: 'anilist', kind: 'staff', providerId: 21 },
    ]])
    expect(resolved).toEqual([])
  })

  test('fails explicitly when a required cached identity is missing', async () => {
    const resolve: CatalogPersonIdentityResolver = async () => []

    await expect(mapCatalogPersonDetail(character, resolve)).rejects.toEqual(
      new CatalogIdentityGatewayError('CATALOG_IDENTITY_MISSING'),
    )
  })
})
