import { describe, expect, test } from 'vitest'

import {
  QUICK_SEARCH_DEBOUNCE_MS,
  QUICK_SEARCH_GROUP_LIMIT,
  QUICK_SEARCH_MAX_LENGTH,
  QUICK_SEARCH_MIN_LENGTH,
  SEARCH_RESULTS_PAGE_SIZE,
  createQuickSearchDestination,
  normalizeSearchQuery,
  quickSearchGroupsSchema,
} from './quick-search-contracts'

const animeRow = {
  id: 'anime_frieren',
  publicId: 'anime_frieren',
  label: "Frieren: Beyond Journey's End",
  imageUrl: 'https://img.example/frieren.webp',
  metadata: 'TV · 2023',
  destination: '/anime/anime_frieren/frieren-beyond-journeys-end',
}

describe('quick search contracts', () => {
  test('locks query, debounce, group, and page limits', () => {
    expect(QUICK_SEARCH_MIN_LENGTH).toBe(2)
    expect(QUICK_SEARCH_MAX_LENGTH).toBe(100)
    expect(QUICK_SEARCH_DEBOUNCE_MS).toBe(300)
    expect(QUICK_SEARCH_GROUP_LIMIT).toBe(5)
    expect(SEARCH_RESULTS_PAGE_SIZE).toBe(20)
  })

  test('trims a valid query without rewriting internal whitespace', () => {
    expect(normalizeSearchQuery('  frieren  ')).toBe('frieren')
    expect(normalizeSearchQuery('Frieren   Himmel')).toBe('Frieren   Himmel')
    expect(normalizeSearchQuery('x'.repeat(QUICK_SEARCH_MAX_LENGTH))).toHaveLength(QUICK_SEARCH_MAX_LENGTH)
  })

  test('rejects invalid query lengths and non-string input', () => {
    expect(() => normalizeSearchQuery('a')).toThrow('QUICK_SEARCH_INVALID')
    expect(() => normalizeSearchQuery('x'.repeat(QUICK_SEARCH_MAX_LENGTH + 1))).toThrow('QUICK_SEARCH_INVALID')
    expect(() => normalizeSearchQuery(`a${' '.repeat(99)}b`)).toThrow('QUICK_SEARCH_INVALID')
    expect(() => normalizeSearchQuery(null)).toThrow('QUICK_SEARCH_INVALID')
  })

  test('creates canonical entity and View all destinations', () => {
    expect(createQuickSearchDestination({
      kind: 'anime',
      publicId: 'anime_frieren',
      slug: 'frieren-beyond-journeys-end',
    })).toBe('/anime/anime_frieren/frieren-beyond-journeys-end')
    expect(createQuickSearchDestination({
      kind: 'character',
      publicId: 'character_flamme',
      label: 'Frieren',
    })).toBe('/characters/character_flamme/frieren')
    expect(createQuickSearchDestination({
      kind: 'staff',
      publicId: 'staff_tanezaki',
      label: 'Atsumi Tanezaki',
    })).toBe('/staff/staff_tanezaki/atsumi-tanezaki')
    expect(createQuickSearchDestination({
      kind: 'user',
      username: 'mika',
    })).toBe('/users/mika')
    expect(createQuickSearchDestination({
      kind: 'results',
      group: 'anime',
      query: 'Frieren Himmel',
    })).toBe('/discover?q=Frieren%20Himmel')
    expect(createQuickSearchDestination({
      kind: 'results',
      group: 'characters',
      query: 'Frieren Himmel',
    })).toBe('/search/characters?q=Frieren%20Himmel')
    expect(createQuickSearchDestination({
      kind: 'results',
      group: 'staff',
      query: 'Frieren Himmel',
    })).toBe('/search/staff?q=Frieren%20Himmel')
    expect(createQuickSearchDestination({
      kind: 'results',
      group: 'users',
      query: 'Mika',
    })).toBe('/search/users?q=Mika')
  })

  test('rejects provider IDs and mismatched public row IDs', () => {
    expect(() => createQuickSearchDestination({
      kind: 'anime',
      publicId: '52991',
      slug: 'frieren',
    })).toThrow('QUICK_SEARCH_DESTINATION_INVALID')
    expect(() => quickSearchGroupsSchema.parse({
      anime: [{ ...animeRow, publicId: '52991', id: '52991' }],
      characters: [],
      staff: [],
      users: [],
    })).toThrow()
    expect(() => quickSearchGroupsSchema.parse({
      anime: [{ ...animeRow, id: 'different_public_id' }],
      characters: [],
      staff: [],
      users: [],
    })).toThrow()
    expect(() => quickSearchGroupsSchema.parse({
      anime: [{ ...animeRow, anilistId: 52991 }],
      characters: [],
      staff: [],
      users: [],
    })).toThrow()
  })

  test('validates strict grouped rows and five-row caps', () => {
    const groups = {
      anime: [animeRow],
      characters: [],
      staff: [],
      users: [],
    }

    expect(quickSearchGroupsSchema.parse(groups)).toEqual(groups)
    expect(() => quickSearchGroupsSchema.parse({
      ...groups,
      anime: Array.from({ length: QUICK_SEARCH_GROUP_LIMIT + 1 }, () => animeRow),
    })).toThrow()
    expect(() => quickSearchGroupsSchema.parse({
      ...groups,
      anime: [{ ...animeRow, imageUrl: 'http://img.example/frieren.webp' }],
    })).toThrow()
    expect(() => quickSearchGroupsSchema.parse({
      ...groups,
      anime: [{ ...animeRow, providerId: 52991 }],
    })).toThrow()
    expect(() => quickSearchGroupsSchema.parse({
      ...groups,
      manga: [],
    })).toThrow()
  })
})
