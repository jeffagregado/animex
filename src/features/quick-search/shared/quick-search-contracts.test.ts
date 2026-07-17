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
  id: '52991',
  label: "Frieren: Beyond Journey's End",
  imageUrl: 'https://img.example/frieren.webp',
  metadata: 'TV · 2023',
  destination: '/anime/52991/frieren-beyond-journeys-end',
}

describe('quick search contracts', () => {
  test('locks query, debounce, group, and page limits', () => {
    expect(QUICK_SEARCH_MIN_LENGTH).toBe(2)
    expect(QUICK_SEARCH_MAX_LENGTH).toBe(100)
    expect(QUICK_SEARCH_DEBOUNCE_MS).toBe(300)
    expect(QUICK_SEARCH_GROUP_LIMIT).toBe(5)
    expect(SEARCH_RESULTS_PAGE_SIZE).toBe(20)
  })

  test('trims and collapses a valid query', () => {
    expect(normalizeSearchQuery('  frieren  ')).toBe('frieren')
    expect(normalizeSearchQuery('Frieren   Himmel')).toBe('Frieren Himmel')
    expect(normalizeSearchQuery('x'.repeat(QUICK_SEARCH_MAX_LENGTH))).toHaveLength(QUICK_SEARCH_MAX_LENGTH)
  })

  test('rejects invalid query lengths and non-string input', () => {
    expect(() => normalizeSearchQuery('a')).toThrow('QUICK_SEARCH_INVALID')
    expect(() => normalizeSearchQuery('x'.repeat(QUICK_SEARCH_MAX_LENGTH + 1))).toThrow('QUICK_SEARCH_INVALID')
    expect(() => normalizeSearchQuery(null)).toThrow('QUICK_SEARCH_INVALID')
  })

  test('creates canonical entity and View all destinations', () => {
    expect(createQuickSearchDestination({
      kind: 'anime',
      id: 52991,
      slug: 'frieren-beyond-journeys-end',
    })).toBe('/anime/52991/frieren-beyond-journeys-end')
    expect(createQuickSearchDestination({
      kind: 'character',
      id: 12,
      label: 'Frieren',
    })).toBe('/characters/12/frieren')
    expect(createQuickSearchDestination({
      kind: 'staff',
      id: 21,
      label: 'Atsumi Tanezaki',
    })).toBe('/staff/21/atsumi-tanezaki')
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
