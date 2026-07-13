import { describe, expect, test } from 'vitest'

import { AniListRequestError } from '../../../lib/anilist-client.server'
import { getAnimeDetailServer, getAnimePeoplePageServer, type AnimeDetailCacheDependencies } from './anime-detail-cache.server'

const emptyPage = { items: [], currentPage: 1, hasNextPage: false, perPage: 24 as const }
const detail = { anilistId: 1, slug: 'one', titles: { display: 'One', english: 'One', romaji: null, native: null }, coverImageUrl: null, bannerImageUrl: null, synopsis: null, format: 'TV' as const, status: 'FINISHED' as const, source: null, season: null, seasonYear: null, episodes: 1, durationMinutes: 24, startDate: null, endDate: null, genres: [], mainStudio: null, related: [], recommendations: [], trailer: null, externalLinks: [], charactersPage: emptyPage, staffPage: emptyPage }

const createDeps = (read: AnimeDetailCacheDependencies['client']['readDetail']): AnimeDetailCacheDependencies => ({
  client: { readDetail: read, readPeoplePage: async () => ({ status: 'missing', entry: null }), acquireLease: async () => ({ acquired: false, leaseUntil: 10 }), commitDetail: async () => {}, commitPeoplePage: async () => {}, releaseLease: async () => true },
  writeToken: 'token', createLeaseId: () => 'lease', delay: async () => {},
  warn: () => {},
  fetchDetail: async () => ({ detail, summary: { anilistId: 1, slug: 'one', titles: detail.titles, coverImageUrl: null, bannerImageUrl: null, format: 'TV', season: null, seasonYear: null, episodes: 1, genres: [], popularity: 0, averageScore: null, trending: null, startDate: null, nextAiringAt: null } }),
  fetchPeople: async () => emptyPage,
})

describe('anime detail cache orchestration', () => {
  test('returns fresh entries without upstream work', async () => {
    const deps = createDeps(async () => ({ status: 'fresh', entry: { payload: detail, refreshedAt: 1, expiresAt: 86_400_001 } }))
    deps.fetchDetail = async () => { throw new Error('must not fetch') }
    await expect(getAnimeDetailServer(1, deps)).resolves.toMatchObject({ status: 'ready', entry: { detail } })
  })

  test('never returns expired data when lease contention remains unresolved', async () => {
    const deps = createDeps(async () => ({ status: 'expired', entry: null }))
    await expect(getAnimeDetailServer(1, deps)).resolves.toMatchObject({ status: 'error', code: 'UPSTREAM' })
  })

  test('returns an explicit error when a people-page contention reread fails', async () => {
    const deps = createDeps(async () => ({ status: 'expired', entry: null }))
    let reads = 0
    deps.client.readPeoplePage = async () => {
      reads += 1
      if (reads === 1) return { status: 'expired', entry: null }
      throw new Error('cache unavailable')
    }

    await expect(getAnimePeoplePageServer(1, 'characters', 1, deps)).resolves.toMatchObject({
      status: 'error',
      code: 'UPSTREAM',
    })
  })

  test('commits and rereads detail after acquiring a refresh lease', async () => {
    let reads = 0
    let committed = false
    const deps = createDeps(async () => {
      reads += 1
      return reads === 1
        ? { status: 'expired', entry: null }
        : { status: 'fresh', entry: { payload: detail, refreshedAt: 1, expiresAt: 86_400_001 } }
    })
    deps.client.acquireLease = async () => ({ acquired: true, leaseUntil: 30_000 })
    deps.client.commitDetail = async () => { committed = true }

    await expect(getAnimeDetailServer(1, deps)).resolves.toMatchObject({ status: 'ready', entry: { detail } })
    expect(committed).toBe(true)
  })

  test('releases its lease and returns not found for a missing anime', async () => {
    let released = false
    const deps = createDeps(async () => ({ status: 'missing', entry: null }))
    deps.client.acquireLease = async () => ({ acquired: true, leaseUntil: 30_000 })
    deps.fetchDetail = async () => null
    deps.client.releaseLease = async () => { released = true; return true }

    await expect(getAnimeDetailServer(1, deps)).resolves.toMatchObject({ status: 'not-found', code: 'NOT_FOUND' })
    expect(released).toBe(true)
  })

  test('preserves a rate-limit error and warns when lease cleanup also fails', async () => {
    const warnings: string[] = []
    const deps = createDeps(async () => ({ status: 'missing', entry: null }))
    deps.client.acquireLease = async () => ({ acquired: true, leaseUntil: 30_000 })
    deps.fetchDetail = async () => { throw new AniListRequestError('RATE_LIMITED', 'AniList rate limit exceeded.', 12) }
    deps.client.releaseLease = async () => { throw new Error('release unavailable') }
    deps.warn = (message) => warnings.push(message)

    await expect(getAnimeDetailServer(1, deps)).resolves.toMatchObject({ status: 'error', code: 'RATE_LIMITED', retryAfterSeconds: 12 })
    expect(warnings).toEqual(['Anime detail cache lease release failed while preserving the primary error.'])
  })

  test('returns an explicit error when not-found lease cleanup fails', async () => {
    const deps = createDeps(async () => ({ status: 'missing', entry: null }))
    deps.client.acquireLease = async () => ({ acquired: true, leaseUntil: 30_000 })
    deps.fetchDetail = async () => null
    deps.client.releaseLease = async () => { throw new Error('release unavailable') }

    await expect(getAnimeDetailServer(1, deps)).resolves.toMatchObject({ status: 'error', code: 'UPSTREAM' })
  })

  test('returns an explicit error when lease cleanup reports false', async () => {
    const deps = createDeps(async () => ({ status: 'missing', entry: null }))
    deps.client.acquireLease = async () => ({ acquired: true, leaseUntil: 30_000 })
    deps.fetchDetail = async () => null
    deps.client.releaseLease = async () => false

    await expect(getAnimeDetailServer(1, deps)).resolves.toMatchObject({ status: 'error', code: 'UPSTREAM' })
  })
})
