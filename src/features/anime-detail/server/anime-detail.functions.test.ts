import { describe, expect, test } from 'vitest'

import { AniListRequestError } from '../../../lib/anilist-client.server'
import { type AnimeDetailCacheDependencies } from './anime-detail-cache.server'
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

const dependencies = (): AnimeDetailCacheDependencies => ({
  client: {
    readDetail: async () => ({ status: 'fresh', entry: { payload: detail, refreshedAt: 1, expiresAt: 86_400_001 } }),
    readPeoplePage: async () => ({ status: 'missing', entry: null }),
    acquireLease: async () => ({ acquired: true, leaseUntil: 30_000 }),
    commitDetail: async () => {}, commitPeoplePage: async () => {}, releaseLease: async () => true,
  },
  writeToken: 'token', createLeaseId: () => 'lease', delay: async () => {}, warn: () => {},
  fetchDetail: async () => null, fetchPeople: async () => null,
})

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
    const ready = await runAnimeDetailGet({ anilistId: 1 }, dependencies())
    expect(ready).toMatchObject({ status: 'ready', entry: { detail } })
    expectSerializable(ready)

    const missing = dependencies()
    missing.client.readDetail = async () => ({ status: 'missing', entry: null })
    const notFound = await runAnimeDetailGet({ anilistId: 1 }, missing)
    expect(notFound).toMatchObject({ status: 'not-found', code: 'NOT_FOUND' })
    expectSerializable(notFound)
  })

  test('returns serializable upstream and rate-limit states', async () => {
    const unavailable = dependencies()
    unavailable.client.readDetail = async () => { throw new Error('cache unavailable') }
    const upstream = await runAnimeDetailGet({ anilistId: 1 }, unavailable)
    expect(upstream).toMatchObject({ status: 'error', code: 'UPSTREAM' })
    expectSerializable(upstream)

    const limited = dependencies()
    limited.client.readDetail = async () => ({ status: 'missing', entry: null })
    limited.fetchDetail = async () => { throw new AniListRequestError('RATE_LIMITED', 'AniList rate limit exceeded.', 12) }
    const rateLimited = await runAnimeDetailGet({ anilistId: 1 }, limited)
    expect(rateLimited).toMatchObject({ status: 'error', code: 'RATE_LIMITED', retryAfterSeconds: 12 })
    expectSerializable(rateLimited)
  })

  test('returns serializable people-page ready and not-found states', async () => {
    const readyDependencies = dependencies()
    readyDependencies.client.readPeoplePage = async () => ({
      status: 'fresh',
      entry: { payload: emptyPage, refreshedAt: 1, expiresAt: 86_400_001 },
    })
    const ready = await runAnimePeopleGet({ anilistId: 1, kind: 'characters', page: 1 }, readyDependencies)
    expect(ready).toEqual({ status: 'ready', page: emptyPage })
    expectSerializable(ready)

    const missingDependencies = dependencies()
    const notFound = await runAnimePeopleGet({ anilistId: 1, kind: 'staff', page: 2 }, missingDependencies)
    expect(notFound).toEqual({ status: 'not-found' })
    expectSerializable(notFound)
  })

  test('returns serializable people-page upstream and rate-limit states', async () => {
    const unavailable = dependencies()
    unavailable.client.readPeoplePage = async () => { throw new Error('cache unavailable') }
    const upstream = await runAnimePeopleGet({ anilistId: 1, kind: 'characters', page: 1 }, unavailable)
    expect(upstream).toMatchObject({ status: 'error', code: 'UPSTREAM' })
    expectSerializable(upstream)

    const limited = dependencies()
    limited.fetchPeople = async () => { throw new AniListRequestError('RATE_LIMITED', 'AniList rate limit exceeded.', 12) }
    const rateLimited = await runAnimePeopleGet({ anilistId: 1, kind: 'staff', page: 2 }, limited)
    expect(rateLimited).toMatchObject({ status: 'error', code: 'RATE_LIMITED', retryAfterSeconds: 12 })
    expectSerializable(rateLimited)
  })
})
