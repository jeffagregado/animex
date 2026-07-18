import { readFileSync } from 'node:fs'

import { describe, expect, test, vi } from 'vitest'

import {
  AniListRequestError,
  fetchDiscoverSectionFromAniList,
  searchAnimeFromAniList,
  type AniListDependencies,
} from './anilist.server'

const media = (id: number, title: string) => ({
  id,
  type: 'ANIME',
  isAdult: false,
  title: { english: title, romaji: title, native: null },
  coverImage: { large: 'https://img.example/cover.jpg' },
  bannerImage: null,
  format: 'TV',
  season: 'SUMMER',
  seasonYear: 2026,
  episodes: 12,
  genres: ['Action'],
  popularity: 100,
  averageScore: 80,
  trending: 20,
  startDate: { year: 2026, month: 7, day: 1 },
  nextAiringEpisode: null,
})

const response = (body: unknown, status: number): Response => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json' },
})

const createDependencies = (
  responses: Response[],
  now: number,
): {
  dependencies: AniListDependencies
  requests: Array<{ query: string; variables: unknown }>
  warnings: string[]
  delays: number[]
} => {
  const requests: Array<{ query: string; variables: unknown }> = []
  const warnings: string[] = []
  const delays: number[] = []
  return {
    dependencies: {
      fetch: async (_input, init) => {
        requests.push(JSON.parse(String(init?.body)) as { query: string; variables: unknown })
        const next = responses.shift()
        if (!next) throw new Error('Unexpected AniList request.')
        return next
      },
      delay: async (milliseconds) => {
        delays.push(milliseconds)
      },
      warn: (message) => warnings.push(message),
      now: () => now,
    },
    requests,
    warnings,
    delays,
  }
}

describe('AniList server transport', () => {
  test('imports provider normalization only from the server-only boundary', () => {
    const source = readFileSync(new URL('./anilist.server.ts', import.meta.url), 'utf8')
    const sharedImport = source.match(
      /import\s*\{[\s\S]*?\}\s*from '\.\.\/shared\/discover-contracts'/,
    )?.[0]

    expect(source).toContain("from './anilist-normalization.server'")
    expect(sharedImport).not.toContain('normalizeAnimeSummary')
  })

  test('retries network and 5xx failures no more than three total attempts', async () => {
    const fixture = createDependencies([
      response({}, 503),
      response({}, 502),
      response({ data: { Page: { media: [media(1, 'One')] } } }, 200),
    ], Date.UTC(2026, 6, 12))

    const section = await fetchDiscoverSectionFromAniList('trending', fixture.dependencies)

    expect(section).toHaveLength(1)
    expect(fixture.requests).toHaveLength(3)
    expect(fixture.warnings).toHaveLength(2)
  })

  test('returns a sanitized typed rate-limit error without retrying long Retry-After values', async () => {
    const fixture = createDependencies([
      new Response('provider detail must not escape', { status: 429, headers: { 'retry-after': '30' } }),
    ], Date.UTC(2026, 6, 12))

    await expect(fetchDiscoverSectionFromAniList('trending', fixture.dependencies)).rejects.toMatchObject({
      name: 'AniListRequestError',
      code: 'RATE_LIMITED',
      retryAfterSeconds: 30,
      message: 'AniList rate limit exceeded.',
    })
    expect(fixture.requests).toHaveLength(1)
  })

  test('waits for a short Retry-After value before one retry without transport backoff', async () => {
    const fixture = createDependencies([
      new Response('', { status: 429, headers: { 'retry-after': '1' } }),
      response({ data: { Page: { media: [media(1, 'One')] } } }, 200),
    ], Date.UTC(2026, 6, 12))

    const section = await fetchDiscoverSectionFromAniList('trending', fixture.dependencies)

    expect(section).toHaveLength(1)
    expect(fixture.requests).toHaveLength(2)
    expect(fixture.delays).toEqual([1_000])
    expect(fixture.warnings).toHaveLength(1)
  })

  test('throws the third short rate limit without waiting when no retry remains', async () => {
    const fixture = createDependencies([
      new Response('', { status: 429, headers: { 'retry-after': '1' } }),
      new Response('', { status: 429, headers: { 'retry-after': '1' } }),
      new Response('', { status: 429, headers: { 'retry-after': '1' } }),
    ], Date.UTC(2026, 6, 12))

    await expect(fetchDiscoverSectionFromAniList('trending', fixture.dependencies)).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      retryAfterSeconds: 1,
    })

    expect(fixture.requests).toHaveLength(3)
    expect(fixture.delays).toEqual([1_000, 1_000])
    expect(fixture.warnings).toHaveLength(2)
  })

  test('uses the frozen eight-second timeout signal for each request', async () => {
    const timeoutSignal = new AbortController().signal
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timeoutSignal)
    const fixture = createDependencies([], Date.UTC(2026, 6, 12))
    let requestSignal: AbortSignal | null = null
    fixture.dependencies.fetch = async (_input, init) => {
      requestSignal = init?.signal ?? null
      return response({ data: { Page: { media: [media(1, 'One')] } } }, 200)
    }

    try {
      await fetchDiscoverSectionFromAniList('trending', fixture.dependencies)

      expect(timeout).toHaveBeenCalledTimes(1)
      expect(timeout).toHaveBeenCalledWith(8_000)
      expect(requestSignal).toBe(timeoutSignal)
    } finally {
      timeout.mockRestore()
    }
  })

  test('uses section filters and current UTC season variables', async () => {
    const fixture = createDependencies([
      response({ data: { Page: { media: [media(1, 'One')] } } }, 200),
      response({ data: { Page: { media: [media(2, 'Two')] } } }, 200),
      response({ data: { Page: { media: [media(3, 'Three')] } } }, 200),
    ], Date.UTC(2026, 6, 12))

    await fetchDiscoverSectionFromAniList('trending', fixture.dependencies)
    await fetchDiscoverSectionFromAniList('seasonal', fixture.dependencies)
    await fetchDiscoverSectionFromAniList('upcoming', fixture.dependencies)

    expect(fixture.requests[0]?.query).toContain('TRENDING_DESC')
    expect(fixture.requests[1]?.query).toContain('POPULARITY_DESC')
    expect(fixture.requests[1]?.variables).toMatchObject({ season: 'SUMMER', year: 2026 })
    expect(fixture.requests[2]?.query).toContain('NOT_YET_RELEASED')
    expect(fixture.requests[2]?.query).toContain('START_DATE')
  })

  test('snapshots one UTC timestamp for seasonal season and year', async () => {
    const fixture = createDependencies([
      response({ data: { Page: { media: [media(2, 'Two')] } } }, 200),
    ], Date.UTC(2026, 6, 12))
    let calls = 0
    fixture.dependencies.now = () => {
      calls += 1
      return calls === 1 ? Date.UTC(2026, 2, 31, 23, 59, 59) : Date.UTC(2026, 3, 1)
    }

    await fetchDiscoverSectionFromAniList('seasonal', fixture.dependencies)

    expect(calls).toBe(1)
    expect(fixture.requests[0]?.variables).toMatchObject({ season: 'WINTER', year: 2026 })
  })

  test('normalizes, filters, deduplicates, and limits recommendation media', async () => {
    const fixture = createDependencies([
      response({ data: { Page: { recommendations: [
        { rating: 100, mediaRecommendation: media(1, 'One') },
        { rating: 90, mediaRecommendation: media(1, 'One again') },
        { rating: 80, mediaRecommendation: { ...media(2, 'Adult'), isAdult: true } },
        { rating: 70, mediaRecommendation: media(3, 'Three') },
      ] } } }, 200),
    ], Date.UTC(2026, 6, 12))

    const section = await fetchDiscoverSectionFromAniList('recommendations', fixture.dependencies)

    expect(section.map((item) => item.anilistId)).toEqual([1, 3])
    expect(fixture.requests[0]?.query).toContain('rating_greater: 0')
    expect(fixture.requests[0]?.query).toContain('RATING_DESC')
  })

  test('sends validated search filters and returns fixed pagination metadata', async () => {
    const fixture = createDependencies([
      response({ data: { Page: { pageInfo: { currentPage: 2, hasNextPage: true }, media: [media(4, 'Four')] } } }, 200),
    ], Date.UTC(2026, 6, 12))

    const page = await searchAnimeFromAniList({
      query: 'frieren', genre: 'Action', format: 'TV', season: 'FALL', year: 2023, sort: 'relevance', page: 2,
    }, fixture.dependencies)

    expect(page).toMatchObject({ currentPage: 2, hasNextPage: true, perPage: 20 })
    expect(fixture.requests[0]?.variables).toMatchObject({
      query: 'frieren', genre: 'Action', format: 'TV', season: 'FALL', year: 2023, sort: 'SEARCH_MATCH', page: 2, perPage: 20,
    })
  })

  test('omits absent filter arguments so a title search remains meaningful upstream', async () => {
    const fixture = createDependencies([
      response({ data: { Page: { pageInfo: { currentPage: 1, hasNextPage: true }, media: [media(5, 'Five')] } } }, 200),
    ], Date.UTC(2026, 6, 12))

    await searchAnimeFromAniList({
      query: 'naruto', genre: null, format: null, season: null, year: null, sort: 'relevance', page: 1,
    }, fixture.dependencies)

    expect(fixture.requests[0]?.query).not.toContain('genre: $genre')
    expect(fixture.requests[0]?.query).not.toContain('format: $format')
    expect(fixture.requests[0]?.variables).toEqual({ page: 1, perPage: 20, query: 'naruto', sort: 'SEARCH_MATCH' })
  })

  test('maps empty relevance search to popularity and rejects malformed provider data safely', async () => {
    const fixture = createDependencies([
      response({ data: { Page: { pageInfo: { currentPage: 1, hasNextPage: false }, media: [{ bad: true }] } } }, 200),
    ], Date.UTC(2026, 6, 12))

    await expect(searchAnimeFromAniList({
      query: null, genre: 'Action', format: null, season: null, year: null, sort: 'relevance', page: 1,
    }, fixture.dependencies)).rejects.toBeInstanceOf(AniListRequestError)
    expect(fixture.requests[0]?.variables).toMatchObject({ sort: 'POPULARITY_DESC' })
  })
})
