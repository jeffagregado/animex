import { describe, expect, test } from 'vitest'

import {
  CATALOG_PERSON_CACHE_TTL_MS,
  CATALOG_PERSON_PAGE_SIZE,
  catalogPersonDetailSchema,
  catalogPersonSearchPageSchema,
  catalogPersonWorkPageSchema,
  createCatalogPersonPath,
  parseCatalogPersonId,
  parseCatalogPersonTab,
  slugifyCatalogPerson,
  type CatalogPersonDetail,
} from './catalog-person-contracts'

const character: CatalogPersonDetail = {
  kind: 'character',
  id: 12,
  name: 'Frieren',
  nativeName: 'フリーレン',
  imageUrl: 'https://img.example/frieren.webp',
  description: 'An elf mage.',
  age: '1000+',
  gender: 'Female',
  birthday: null,
  bloodType: null,
}

const anime = {
  id: 52991,
  slug: 'frieren-beyond-journeys-end',
  title: "Frieren: Beyond Journey's End",
  coverImageUrl: 'https://img.example/anime.webp',
  format: 'TV',
  seasonYear: 2023,
}

describe('catalog person contracts', () => {
  test('locks cache and page limits', () => {
    expect(CATALOG_PERSON_PAGE_SIZE).toBe(20)
    expect(CATALOG_PERSON_CACHE_TTL_MS).toBe(24 * 60 * 60 * 1000)
  })

  test.each([1, 12, Number.MAX_SAFE_INTEGER])(
    'accepts positive provider-neutral ID %s',
    (value) => {
      expect(parseCatalogPersonId(value)).toBe(value)
      expect(parseCatalogPersonId(String(value))).toBe(value)
    },
  )

  test.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, '', '12.5', 'abc'])(
    'rejects unsafe ID %s',
    (value) => {
      expect(() => parseCatalogPersonId(value)).toThrow('CATALOG_PERSON_ID_INVALID')
    },
  )

  test('creates Unicode-safe canonical destinations', () => {
    expect(slugifyCatalogPerson('Frieren')).toBe('frieren')
    expect(slugifyCatalogPerson('  葬送 の フリーレン  ')).toBe('葬送-の-フリーレン')
    expect(createCatalogPersonPath('character', 12, 'Frieren')).toBe('/characters/12/frieren')
    expect(createCatalogPersonPath('staff', 21, 'Atsumi Tanezaki')).toBe('/staff/21/atsumi-tanezaki')
    expect(() => slugifyCatalogPerson(' !!! ')).toThrow('CATALOG_PERSON_SLUG_INVALID')
  })

  test('accepts only kind-specific tabs', () => {
    expect(parseCatalogPersonTab('character', undefined)).toBe('overview')
    expect(parseCatalogPersonTab('character', 'anime')).toBe('anime')
    expect(parseCatalogPersonTab('staff', undefined)).toBe('overview')
    expect(parseCatalogPersonTab('staff', 'anime')).toBe('anime')
    expect(() => parseCatalogPersonTab('character', 'works')).toThrow('CATALOG_PERSON_TAB_INVALID')
    expect(() => parseCatalogPersonTab('staff', 'works')).toThrow('CATALOG_PERSON_TAB_INVALID')
  })

  test('validates strict provider-neutral detail data and HTTPS images', () => {
    expect(catalogPersonDetailSchema.parse(character)).toEqual(character)
    expect(() => catalogPersonDetailSchema.parse({
      ...character,
      imageUrl: 'http://img.example/frieren.webp',
    })).toThrow()
    expect(() => catalogPersonDetailSchema.parse({
      ...character,
      providerSiteUrl: 'https://provider.example/character/12',
    })).toThrow()
    expect(() => catalogPersonDetailSchema.parse({
      ...character,
      kind: 'staff',
    })).toThrow()
  })

  test('validates exact 20-row work-page contract', () => {
    const row = { anime, role: 'MAIN' }
    const page = {
      items: [row],
      currentPage: 1,
      hasNextPage: false,
      perPage: CATALOG_PERSON_PAGE_SIZE,
    }

    expect(catalogPersonWorkPageSchema.parse(page)).toEqual(page)
    expect(() => catalogPersonWorkPageSchema.parse({
      ...page,
      items: Array.from({ length: CATALOG_PERSON_PAGE_SIZE + 1 }, () => row),
    })).toThrow()
    expect(() => catalogPersonWorkPageSchema.parse({
      ...page,
      perPage: CATALOG_PERSON_PAGE_SIZE - 1,
    })).toThrow()
    expect(() => catalogPersonWorkPageSchema.parse({
      ...page,
      items: [{ anime: { ...anime, coverImageUrl: 'http://img.example/anime.webp' }, role: null }],
    })).toThrow()
    expect(() => catalogPersonWorkPageSchema.parse({
      ...page,
      items: [{ anime: { ...anime, format: 'WEB_SERIES' }, role: null }],
    })).toThrow()
  })

  test('validates strict 20-row search pages', () => {
    const row = {
      kind: 'character',
      id: 12,
      name: 'Frieren',
      nativeName: null,
      imageUrl: null,
      destination: '/characters/12/frieren',
    }
    const page = {
      items: [row],
      currentPage: 1,
      hasNextPage: true,
      perPage: CATALOG_PERSON_PAGE_SIZE,
    }

    expect(catalogPersonSearchPageSchema.parse(page)).toEqual(page)
    expect(() => catalogPersonSearchPageSchema.parse({
      ...page,
      items: Array.from({ length: CATALOG_PERSON_PAGE_SIZE + 1 }, () => row),
    })).toThrow()
    expect(() => catalogPersonSearchPageSchema.parse({
      ...page,
      items: [{ ...row, providerId: 12 }],
    })).toThrow()
  })
})
