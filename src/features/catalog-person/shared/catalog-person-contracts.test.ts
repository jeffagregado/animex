import { describe, expect, test } from 'vitest'

import {
  CATALOG_PERSON_CACHE_TTL_MS,
  CATALOG_PERSON_PAGE_SIZE,
  catalogPersonDetailSchema,
  catalogPersonSearchPageSchema,
  catalogPersonWorkPageSchema,
  createCatalogPersonPath,
  parseCatalogPersonTab,
  slugifyCatalogPerson,
  type CatalogPersonDetail,
} from './catalog-person-contracts'

const character: CatalogPersonDetail = {
  kind: 'character',
  publicId: 'character_12',
  name: 'Frieren',
  nativeName: 'フリーレン',
  imageUrl: 'https://img.example/frieren.webp',
  description: 'An elf mage.',
  age: '1000+',
  gender: 'Female',
  birthday: null,
  bloodType: null,
  voiceActorScope: 'all-languages',
  voiceActors: [{
    publicId: 'staff_21',
    name: 'Atsumi Tanezaki',
    imageUrl: 'https://img.example/atsumi.webp',
    language: 'Japanese',
  }],
}

const anime = {
  publicId: 'anime_52991',
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

  test('creates Unicode-safe canonical destinations', () => {
    expect(slugifyCatalogPerson('Frieren')).toBe('frieren')
    expect(slugifyCatalogPerson('  葬送 の フリーレン  ')).toBe('葬送-の-フリーレン')
    expect(createCatalogPersonPath('character', 'character_12', 'Frieren')).toBe('/characters/character_12/frieren')
    expect(createCatalogPersonPath('staff', 'staff_21', 'Atsumi Tanezaki')).toBe('/staff/staff_21/atsumi-tanezaki')
    expect(() => createCatalogPersonPath('staff', '21', 'Atsumi Tanezaki')).toThrow('CATALOG_PUBLIC_ID_INVALID')
    expect(() => slugifyCatalogPerson(' !!! ')).toThrow('CATALOG_PERSON_SLUG_INVALID')
  })

  test('accepts only kind-specific tabs', () => {
    expect(parseCatalogPersonTab('character', undefined)).toBe('overview')
    expect(parseCatalogPersonTab('character', 'anime')).toBe('anime')
    expect(parseCatalogPersonTab('character', 'voice-actors')).toBe('voice-actors')
    expect(parseCatalogPersonTab('staff', undefined)).toBe('overview')
    expect(parseCatalogPersonTab('staff', 'anime')).toBe('anime')
    expect(() => parseCatalogPersonTab('staff', 'voice-actors')).toThrow('CATALOG_PERSON_TAB_INVALID')
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
      id: 12,
    })).toThrow()
    expect(() => catalogPersonDetailSchema.parse({
      ...character,
      kind: 'staff',
    })).toThrow()
    const dubbedCharacter = catalogPersonDetailSchema.parse({
      ...character,
      voiceActors: [{ ...character.voiceActors[0], language: 'English' }],
    })
    expect(dubbedCharacter.kind).toBe('character')
    if (dubbedCharacter.kind !== 'character') throw new TypeError('Expected Character detail.')
    expect(dubbedCharacter.voiceActors[0]?.language).toBe('English')
    expect(() => catalogPersonDetailSchema.parse({
      ...character,
      voiceActors: [{ ...character.voiceActors[0], language: ' ' }],
    })).toThrow()
    expect(() => catalogPersonDetailSchema.parse({
      ...character,
      voiceActors: [
        character.voiceActors[0],
        { ...character.voiceActors[0], language: 'English' },
      ],
    })).toThrow()
    const { voiceActorScope: _voiceActorScope, ...legacyCharacter } = character
    expect(() => catalogPersonDetailSchema.parse(legacyCharacter)).toThrow()
    expect(() => catalogPersonDetailSchema.parse({
      ...character,
      voiceActors: [{ ...character.voiceActors[0], imageUrl: 'http://img.example/atsumi.webp' }],
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
      publicId: 'character_12',
      name: 'Frieren',
      nativeName: null,
      imageUrl: null,
      destination: '/characters/character_12/frieren',
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
      items: [{ ...row, id: 12 }],
    })).toThrow()
    expect(() => catalogPersonSearchPageSchema.parse({
      ...page,
      items: [{ ...row, publicId: '12' }],
    })).toThrow()
  })
})
