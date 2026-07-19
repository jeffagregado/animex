import { describe, expect, test } from 'vitest'

import {
  createAniListDependencies,
  fetchDiscoverSectionFromAniList,
  searchAnimeFromAniList,
} from './anilist.server'
import type { AnimeSummaryProvider } from './discover-provider-cache-contracts.server'

const runLive = process.env.ANILIST_LIVE === '1'
const rateHeaders: Array<{ limit: string | null; remaining: string | null; retryAfter: string | null }> = []
const baseLive = createAniListDependencies()
const live = {
  ...baseLive,
  fetch: async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const response = await baseLive.fetch(input, init)
    rateHeaders.push({
      limit: response.headers.get('x-ratelimit-limit'),
      remaining: response.headers.get('x-ratelimit-remaining'),
      retryAfter: response.headers.get('retry-after'),
    })
    return response
  },
}

const reportRateHeaders = (): void => {
  console.info('AniList live rate headers:', JSON.stringify(rateHeaders))
}

const expectNormalizedAnime = (item: AnimeSummaryProvider): void => {
  expect(item.anilistId).toBeGreaterThan(0)
  expect(item.titles.display.trim()).not.toBe('')
  expect(item.slug.trim()).not.toBe('')
}

describe.runIf(runLive)('AniList live smoke', () => {
  test('fetches curated Discover rails sequentially', async () => {
    for (const key of ['trending', 'seasonal', 'upcoming', 'recommendations'] as const) {
      const items = await fetchDiscoverSectionFromAniList(key, live)
      expect(items.length).toBeGreaterThan(0)
      items.forEach(expectNormalizedAnime)
    }
    reportRateHeaders()
  }, 60_000)

  test('searches title, filters, second page, and 100-character input', async () => {
    const queries = [
      { query: 'naruto', genre: null, format: null, season: null, year: null, sort: 'relevance' as const, page: 1, expectItems: true },
      { query: null, genre: 'Action' as const, format: null, season: null, year: null, sort: 'popularity' as const, page: 1, expectItems: false },
      { query: null, genre: null, format: 'TV' as const, season: null, year: null, sort: 'trending' as const, page: 1, expectItems: false },
      { query: null, genre: null, format: null, season: 'FALL' as const, year: 2023, sort: 'score' as const, page: 1, expectItems: false },
      { query: 'naruto', genre: null, format: null, season: null, year: null, sort: 'relevance' as const, page: 2, expectItems: false },
      { query: 'a'.repeat(100), genre: null, format: null, season: null, year: null, sort: 'relevance' as const, page: 1, expectItems: false },
    ]
    for (const { expectItems, ...input } of queries) {
      const page = await searchAnimeFromAniList(input, live)
      expect(page.perPage).toBe(20)
      expect(page.currentPage).toBe(input.page)
      if (expectItems) expect(page.items.length, JSON.stringify(input)).toBeGreaterThan(0)
      expect(typeof page.hasNextPage).toBe('boolean')
      page.items.forEach(expectNormalizedAnime)
    }
    reportRateHeaders()
  }, 60_000)
})
