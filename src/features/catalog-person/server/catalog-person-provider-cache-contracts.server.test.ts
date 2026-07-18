import { readFile } from 'node:fs/promises'

import { describe, expect, test } from 'vitest'

import {
  catalogPersonProviderDetailSchema,
  catalogPersonProviderSearchPageSchema,
  parseProviderCatalogPersonId,
} from './catalog-person-provider-cache-contracts.server'

const source = async (path: string): Promise<string> => await readFile(
  new URL(path, import.meta.url),
  'utf8',
)

describe('catalog person provider and cache contracts', () => {
  test('keeps numeric AniList identity in provider payload validation', () => {
    const detail = {
      kind: 'staff',
      id: 21,
      name: 'Atsumi Tanezaki',
      nativeName: null,
      imageUrl: null,
      description: null,
      occupations: ['Voice Actor'],
      language: 'Japanese',
      hometown: null,
      activeYears: null,
    }

    expect(catalogPersonProviderDetailSchema.parse(detail)).toEqual(detail)
    expect(parseProviderCatalogPersonId(21)).toBe(21)
    expect(() => parseProviderCatalogPersonId('21')).toThrow(
      'AniList person ID must be a positive safe integer.',
    )

    const searchPage = {
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
    expect(catalogPersonProviderSearchPageSchema.parse(searchPage)).toEqual(searchPage)
    expect(() => catalogPersonProviderSearchPageSchema.parse({
      ...searchPage,
      items: [{ ...searchPage.items[0], publicId: 'staff_21' }],
    })).toThrow()
  })

  test('keeps provider and cache modules independent from browser-public person DTOs', async () => {
    const sources = await Promise.all([
      source('catalog-person-provider-cache-contracts.server.ts'),
      source('catalog-person-cache.server.ts'),
      source('../../../../convex/catalogPersonCache.ts'),
      source('../../../../convex/catalogPersonCachePolicy.ts'),
    ])

    for (const moduleSource of sources) {
      expect(moduleSource).not.toMatch(/\/shared\/[^']*contracts/)
    }

    const providerSource = await source('anilist-person.server.ts')
    const sharedImports = [
      ...providerSource.matchAll(/import\s*\{[^;]*?\}\s*from '[^']*\/shared\/[^']*contracts'/gs),
    ].map((match) => match[0])

    expect(providerSource).toContain("from './catalog-person-provider-cache-contracts.server'")
    expect(sharedImports).toHaveLength(0)
  })
})
