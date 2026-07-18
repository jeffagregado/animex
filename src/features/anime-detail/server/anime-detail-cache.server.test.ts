import { describe, expect, test } from 'vitest'

import { AniListRequestError } from '../../../lib/anilist-client.server'
import { CatalogIdentityGatewayError } from '../../catalog-identity/server/catalog-identity.server'
import { getAnimeDetailServer, getAnimePeoplePageServer, type AnimeDetailCacheDependencies } from './anime-detail-cache.server'

const emptyPage = { items: [], currentPage: 1, hasNextPage: false, perPage: 24 as const }
const detail = { anilistId: 1, slug: 'one', titles: { display: 'One', english: 'One', romaji: null, native: null }, coverImageUrl: null, bannerImageUrl: null, synopsis: null, format: 'TV' as const, status: 'FINISHED' as const, source: null, season: null, seasonYear: null, episodes: 1, durationMinutes: 24, startDate: null, endDate: null, genres: [], mainStudio: null, related: [], recommendations: [], trailer: null, externalLinks: [], charactersPage: emptyPage, staffPage: emptyPage }

const createDeps = (read: AnimeDetailCacheDependencies['client']['readDetail']): AnimeDetailCacheDependencies => ({
  client: { readDetail: read, readPeoplePage: async () => ({ status: 'missing', entry: null }), acquireLease: async () => ({ acquired: false, leaseUntil: 10 }), commitDetail: async () => {}, commitPeoplePage: async () => {}, releaseLease: async () => true },
  writeToken: 'token', createLeaseId: () => 'lease', delay: async () => {},
  warn: () => {},
  fetchDetail: async () => ({ detail, summary: { anilistId: 1, slug: 'one', titles: detail.titles, coverImageUrl: null, bannerImageUrl: null, format: 'TV', season: null, seasonYear: null, episodes: 1, genres: [], popularity: 0, averageScore: null, trending: null, startDate: null, nextAiringAt: null } }),
  fetchPeople: async () => emptyPage,
  identity: {
    ensurePublicIds: async (refs) => refs.map((ref) => ({ publicId: `${ref.kind}_${ref.providerId}`, kind: ref.kind })),
    resolvePublicIds: async (refs) => refs.map((ref) => ({ publicId: `${ref.kind}_${ref.providerId}`, kind: ref.kind })),
    resolveProviderByPublicId: async () => ({ provider: 'anilist', kind: 'anime', providerId: 1 }),
  },
})

describe('anime detail cache orchestration', () => {
  test('maps a verified cached detail with read-only public identity resolution', async () => {
    const calls: string[] = []
    const deps = createDeps(async () => ({
      status: 'fresh',
      entry: { payload: detail, refreshedAt: 1, expiresAt: 86_400_001 },
    }))
    deps.identity.resolvePublicIds = async (refs) => {
      calls.push('resolve')
      return refs.map((ref) => ({ publicId: `${ref.kind}_${ref.providerId}`, kind: ref.kind }))
    }
    deps.identity.ensurePublicIds = async () => {
      calls.push('ensure')
      throw new Error('must not ensure cached identities')
    }

    const result = await getAnimeDetailServer('anime_1', deps)

    expect(result).toMatchObject({
      status: 'ready',
      entry: { detail: { publicId: 'anime_1' } },
    })
    expect(calls).toEqual(['resolve'])
    expect(JSON.stringify(result)).not.toContain('anilistId')
  })

  test('returns explicit missing identity state without refetching cached metadata', async () => {
    const deps = createDeps(async () => ({
      status: 'fresh',
      entry: { payload: detail, refreshedAt: 1, expiresAt: 86_400_001 },
    }))
    deps.identity.resolvePublicIds = async () => {
      throw new CatalogIdentityGatewayError('CATALOG_IDENTITY_MISSING')
    }
    deps.fetchDetail = async () => {
      throw new Error('must not refetch')
    }

    await expect(getAnimeDetailServer('anime_1', deps)).resolves.toEqual({
      status: 'error',
      code: 'CATALOG_IDENTITY_MISSING',
      message: 'CATALOG_IDENTITY_MISSING',
      retryAfterSeconds: null,
    })
  })

  test('returns explicit missing identity state when the root public ID cannot resolve', async () => {
    const deps = createDeps(async () => {
      throw new Error('must not read cache')
    })
    deps.identity.resolveProviderByPublicId = async () => {
      throw new CatalogIdentityGatewayError('CATALOG_IDENTITY_MISSING')
    }

    await expect(getAnimeDetailServer('anime_missing', deps)).resolves.toMatchObject({
      status: 'error',
      code: 'CATALOG_IDENTITY_MISSING',
    })
  })

  test('ensures identities only for an uncached provider result', async () => {
    const calls: string[] = []
    let reads = 0
    const deps = createDeps(async () => {
      reads += 1
      return reads === 1
        ? { status: 'missing', entry: null }
        : { status: 'fresh', entry: { payload: detail, refreshedAt: 1, expiresAt: 86_400_001 } }
    })
    deps.client.acquireLease = async () => ({ acquired: true, leaseUntil: 30_000 })
    deps.identity.ensurePublicIds = async (refs) => {
      calls.push('ensure')
      return refs.map((ref) => ({ publicId: `${ref.kind}_${ref.providerId}`, kind: ref.kind }))
    }
    deps.identity.resolvePublicIds = async () => {
      calls.push('resolve')
      throw new Error('must not resolve fetched identities')
    }

    await expect(getAnimeDetailServer('anime_1', deps)).resolves.toMatchObject({
      status: 'ready',
      entry: { detail: { publicId: 'anime_1' } },
    })
    expect(calls).toEqual(['ensure'])
  })

  test('passes the configured server token to raw detail and people reads', async () => {
    const detailTokens: Array<string | undefined> = []
    const peopleTokens: Array<string | undefined> = []
    const deps = createDeps(async (_anilistId, token) => {
      detailTokens.push(token)
      return { status: 'fresh', entry: { payload: detail, refreshedAt: 1, expiresAt: 86_400_001 } }
    })
    deps.client.readPeoplePage = async (_anilistId, _kind, _page, token) => {
      peopleTokens.push(token)
      return { status: 'fresh', entry: { payload: emptyPage, refreshedAt: 1, expiresAt: 86_400_001 } }
    }

    await getAnimeDetailServer('anime_1', deps)
    await getAnimePeoplePageServer('anime_1', 'characters', 1, deps)

    expect(detailTokens).toEqual(['token'])
    expect(peopleTokens).toEqual(['token'])
  })

  test('returns fresh entries without upstream work', async () => {
    const deps = createDeps(async () => ({ status: 'fresh', entry: { payload: detail, refreshedAt: 1, expiresAt: 86_400_001 } }))
    deps.fetchDetail = async () => { throw new Error('must not fetch') }
    await expect(getAnimeDetailServer('anime_1', deps)).resolves.toMatchObject({ status: 'ready', entry: { detail: { publicId: 'anime_1' } } })
  })

  test('never returns expired data when lease contention remains unresolved', async () => {
    const deps = createDeps(async () => ({ status: 'expired', entry: null }))
    await expect(getAnimeDetailServer('anime_1', deps)).resolves.toMatchObject({ status: 'error', code: 'UPSTREAM' })
  })

  test('returns an explicit error when a people-page contention reread fails', async () => {
    const deps = createDeps(async () => ({ status: 'expired', entry: null }))
    let reads = 0
    deps.client.readPeoplePage = async () => {
      reads += 1
      if (reads === 1) return { status: 'expired', entry: null }
      throw new Error('cache unavailable')
    }

    await expect(getAnimePeoplePageServer('anime_1', 'characters', 1, deps)).resolves.toMatchObject({
      status: 'error',
      code: 'UPSTREAM',
    })
  })

  test('returns a fresh people page without acquiring a lease', async () => {
    const deps = createDeps(async () => ({ status: 'expired', entry: null }))
    deps.client.readPeoplePage = async () => ({ status: 'fresh', entry: { payload: emptyPage, refreshedAt: 1, expiresAt: 86_400_001 } })
    deps.client.acquireLease = async () => { throw new Error('must not acquire') }

    await expect(getAnimePeoplePageServer('anime_1', 'characters', 1, deps)).resolves.toEqual({ status: 'ready', page: emptyPage })
  })

  test('returns a people page refreshed by the lease holder during contention', async () => {
    let reads = 0
    let delays = 0
    const deps = createDeps(async () => ({ status: 'expired', entry: null }))
    deps.client.readPeoplePage = async () => {
      reads += 1
      return reads < 3
        ? { status: 'expired', entry: null }
        : { status: 'fresh', entry: { payload: emptyPage, refreshedAt: 1, expiresAt: 86_400_001 } }
    }
    deps.delay = async () => { delays += 1 }

    await expect(getAnimePeoplePageServer('anime_1', 'characters', 1, deps)).resolves.toEqual({ status: 'ready', page: emptyPage })
    expect(delays).toBe(2)
  })

  test('commits and rereads a people page after acquiring a refresh lease', async () => {
    let reads = 0
    let committed = false
    const deps = createDeps(async () => ({ status: 'expired', entry: null }))
    deps.client.readPeoplePage = async () => {
      reads += 1
      return reads === 1
        ? { status: 'missing', entry: null }
        : { status: 'fresh', entry: { payload: emptyPage, refreshedAt: 1, expiresAt: 86_400_001 } }
    }
    deps.client.acquireLease = async () => ({ acquired: true, leaseUntil: 30_000 })
    deps.client.commitPeoplePage = async () => { committed = true }

    await expect(getAnimePeoplePageServer('anime_1', 'characters', 1, deps)).resolves.toEqual({ status: 'ready', page: emptyPage })
    expect(committed).toBe(true)
  })

  test('releases its lease when a people page is not found', async () => {
    let released = false
    const deps = createDeps(async () => ({ status: 'expired', entry: null }))
    deps.client.acquireLease = async () => ({ acquired: true, leaseUntil: 30_000 })
    deps.fetchPeople = async () => null
    deps.client.releaseLease = async () => { released = true; return true }

    await expect(getAnimePeoplePageServer('anime_1', 'staff', 1, deps)).resolves.toEqual({ status: 'not-found' })
    expect(released).toBe(true)
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

    await expect(getAnimeDetailServer('anime_1', deps)).resolves.toMatchObject({ status: 'ready', entry: { detail: { publicId: 'anime_1' } } })
    expect(committed).toBe(true)
  })

  test('releases its lease and returns not found for a missing anime', async () => {
    let released = false
    const deps = createDeps(async () => ({ status: 'missing', entry: null }))
    deps.client.acquireLease = async () => ({ acquired: true, leaseUntil: 30_000 })
    deps.fetchDetail = async () => null
    deps.client.releaseLease = async () => { released = true; return true }

    await expect(getAnimeDetailServer('anime_1', deps)).resolves.toMatchObject({ status: 'not-found', code: 'NOT_FOUND' })
    expect(released).toBe(true)
  })

  test('preserves a rate-limit error and warns when lease cleanup also fails', async () => {
    const warnings: string[] = []
    const deps = createDeps(async () => ({ status: 'missing', entry: null }))
    deps.client.acquireLease = async () => ({ acquired: true, leaseUntil: 30_000 })
    deps.fetchDetail = async () => { throw new AniListRequestError('RATE_LIMITED', 'AniList rate limit exceeded.', 12) }
    deps.client.releaseLease = async () => { throw new Error('release unavailable') }
    deps.warn = (message) => warnings.push(message)

    await expect(getAnimeDetailServer('anime_1', deps)).resolves.toMatchObject({ status: 'error', code: 'RATE_LIMITED', retryAfterSeconds: 12 })
    expect(warnings).toEqual(['Anime detail cache lease release failed while preserving the primary error.'])
  })

  test('returns an explicit error when not-found lease cleanup fails', async () => {
    const deps = createDeps(async () => ({ status: 'missing', entry: null }))
    deps.client.acquireLease = async () => ({ acquired: true, leaseUntil: 30_000 })
    deps.fetchDetail = async () => null
    deps.client.releaseLease = async () => { throw new Error('release unavailable') }

    await expect(getAnimeDetailServer('anime_1', deps)).resolves.toMatchObject({ status: 'error', code: 'UPSTREAM' })
  })

  test('returns an explicit error when lease cleanup reports false', async () => {
    const deps = createDeps(async () => ({ status: 'missing', entry: null }))
    deps.client.acquireLease = async () => ({ acquired: true, leaseUntil: 30_000 })
    deps.fetchDetail = async () => null
    deps.client.releaseLease = async () => false

    await expect(getAnimeDetailServer('anime_1', deps)).resolves.toMatchObject({ status: 'error', code: 'UPSTREAM' })
  })
})
