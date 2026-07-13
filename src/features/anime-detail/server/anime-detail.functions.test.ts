import { describe, expect, test } from 'vitest'

import {
  animeDetailGetInputSchema,
  animePeopleGetInputSchema,
  getAnimeDetail,
  getAnimePeoplePage,
  runAnimeDetailGet,
  runAnimePeopleGet,
} from './anime-detail.functions'

const emptyPage = { items: [], currentPage: 1, hasNextPage: false, perPage: 24 as const }
const detail = {
  anilistId: 1, slug: 'one', titles: { display: 'One', english: 'One', romaji: null, native: null },
  coverImageUrl: null, bannerImageUrl: null, synopsis: null, format: 'TV' as const, status: 'FINISHED' as const,
  source: null, season: null, seasonYear: null, episodes: 1, durationMinutes: 24, startDate: null, endDate: null,
  genres: [], mainStudio: null, related: [], recommendations: [], trailer: null, externalLinks: [],
  charactersPage: emptyPage, staffPage: emptyPage,
}

const expectSerializable = (value: unknown): void => {
  expect(JSON.parse(JSON.stringify(value))).toEqual(value)
}

describe('anime detail GET functions', () => {
  test('export GET server functions with strict validated inputs', () => {
    expect(getAnimeDetail).toBeTypeOf('function')
    expect(getAnimePeoplePage).toBeTypeOf('function')
    expect(animeDetailGetInputSchema.parse({ anilistId: 1 })).toEqual({ anilistId: 1 })
    expect(animePeopleGetInputSchema.parse({ anilistId: 1, kind: 'staff', page: 2 })).toEqual({ anilistId: 1, kind: 'staff', page: 2 })
    expect(() => animeDetailGetInputSchema.parse({ anilistId: 1, extra: true })).toThrow()
    expect(() => animePeopleGetInputSchema.parse({ anilistId: 1, kind: 'reviews', page: 0 })).toThrow()
  })

  test('returns serializable ready and not-found states', async () => {
    const ready = await runAnimeDetailGet({ anilistId: 1 }, async () => ({
      status: 'ready',
      entry: { detail, refreshedAt: 1, expiresAt: 86_400_001 },
    }))
    expect(ready).toMatchObject({ status: 'ready', entry: { detail } })
    expectSerializable(ready)

    const notFound = await runAnimeDetailGet({ anilistId: 1 }, async () => ({
      status: 'not-found', code: 'NOT_FOUND', message: 'Anime was not found.',
    }))
    expect(notFound).toMatchObject({ status: 'not-found', code: 'NOT_FOUND' })
    expectSerializable(notFound)
  })

  test('returns serializable upstream and rate-limit states', async () => {
    const upstream = await runAnimeDetailGet({ anilistId: 1 }, async () => ({
      status: 'error', code: 'UPSTREAM', message: 'Anime detail is temporarily unavailable.', retryAfterSeconds: null,
    }))
    expect(upstream).toMatchObject({ status: 'error', code: 'UPSTREAM' })
    expectSerializable(upstream)

    const rateLimited = await runAnimeDetailGet({ anilistId: 1 }, async () => ({
      status: 'error', code: 'RATE_LIMITED', message: 'AniList rate limit exceeded.', retryAfterSeconds: 12,
    }))
    expect(rateLimited).toMatchObject({ status: 'error', code: 'RATE_LIMITED', retryAfterSeconds: 12 })
    expectSerializable(rateLimited)
  })

  test('returns serializable people-page ready and not-found states', async () => {
    const ready = await runAnimePeopleGet(
      { anilistId: 1, kind: 'characters', page: 1 },
      async () => ({ status: 'ready', page: emptyPage }),
    )
    expect(ready).toEqual({ status: 'ready', page: emptyPage })
    expectSerializable(ready)

    const notFound = await runAnimePeopleGet(
      { anilistId: 1, kind: 'staff', page: 2 },
      async () => ({ status: 'not-found' }),
    )
    expect(notFound).toEqual({ status: 'not-found' })
    expectSerializable(notFound)
  })

  test('returns serializable people-page upstream and rate-limit states', async () => {
    const upstream = await runAnimePeopleGet(
      { anilistId: 1, kind: 'characters', page: 1 },
      async () => ({ status: 'error', code: 'UPSTREAM', message: 'Anime people page is temporarily unavailable.', retryAfterSeconds: null }),
    )
    expect(upstream).toMatchObject({ status: 'error', code: 'UPSTREAM' })
    expectSerializable(upstream)

    const rateLimited = await runAnimePeopleGet(
      { anilistId: 1, kind: 'staff', page: 2 },
      async () => ({ status: 'error', code: 'RATE_LIMITED', message: 'AniList rate limit exceeded.', retryAfterSeconds: 12 }),
    )
    expect(rateLimited).toMatchObject({ status: 'error', code: 'RATE_LIMITED', retryAfterSeconds: 12 })
    expectSerializable(rateLimited)
  })
})
