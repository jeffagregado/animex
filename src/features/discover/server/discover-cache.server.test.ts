import { describe, expect, test } from 'vitest'

import {
  getDiscoverPageServer,
  refreshDiscoverSectionServer,
  type DiscoverCacheDependencies,
} from './discover-cache.server'
import { AniListRequestError } from './anilist.server'

const summary = (id: number) => ({
  anilistId: id,
  slug: `anime-${id}`,
  titles: { display: `Anime ${id}`, english: `Anime ${id}`, romaji: null, native: null },
  coverImageUrl: null,
  bannerImageUrl: null,
  format: 'TV' as const,
  season: 'SUMMER' as const,
  seasonYear: 2026,
  episodes: 12,
  genres: ['Action'],
  popularity: 10,
  averageScore: 80,
  trending: 3,
  startDate: { year: 2026, month: 7, day: 1 },
  nextAiringAt: null,
})

type CacheClient = {
  readSections: (keys: string[]) => Promise<unknown>
  acquireSectionLease: (key: string, leaseId: string, token: string) => Promise<unknown>
  commitSection: (key: string, leaseId: string, summaries: unknown[], token: string) => Promise<unknown>
  releaseSectionLease: (key: string, leaseId: string, token: string) => Promise<unknown>
}

const createDependencies = (client: CacheClient): { dependencies: DiscoverCacheDependencies; fetched: string[]; delays: number[] } => {
  const fetched: string[] = []
  const delays: number[] = []
  return {
    dependencies: {
      createClient: (_url) => client as unknown as import('./discover-cache.server').DiscoverCacheClient,
      convexUrl: 'https://example.convex.cloud',
      writeToken: 'token',
      createLeaseId: () => 'lease-1',
      delay: async (milliseconds) => { delays.push(milliseconds) },
      fetchSection: async (key) => { fetched.push(key); return [summary(1)] },
    },
    fetched,
    delays,
  }
}

const fresh = (key: string, id: number) => ({
  key,
  status: 'fresh',
  section: { key, items: [summary(id)], refreshedAt: 1, expiresAt: 2 },
})

describe('Discover cache server orchestration', () => {
  test('returns fresh page sections without calling AniList', async () => {
    const client: CacheClient = {
      readSections: async () => ['trending', 'seasonal', 'recommendations', 'upcoming'].map((key, index) => fresh(key, index + 1)),
      acquireSectionLease: async () => ({ acquired: false, leaseUntil: null }),
      commitSection: async () => null,
      releaseSectionLease: async () => false,
    }
    const fixture = createDependencies(client)

    const page = await getDiscoverPageServer(fixture.dependencies)

    expect(page.sections.trending.status).toBe('ready')
    expect(fixture.fetched).toEqual([])
  })

  test('starts every missing section resolution before any section settles', async () => {
    const keys = ['trending', 'seasonal', 'recommendations', 'upcoming'] as const
    const started: string[] = []
    const pendingReads = new Map<string, (result: unknown) => void>()
    const client: CacheClient = {
      readSections: async (readKeys) => {
        if (readKeys.length === keys.length) {
          return keys.map((key) => ({ key, status: 'missing', section: null }))
        }
        const key = readKeys[0]
        started.push(key)
        return await new Promise((resolve) => pendingReads.set(key, resolve))
      },
      acquireSectionLease: async () => ({ acquired: false, leaseUntil: null }),
      commitSection: async () => null,
      releaseSectionLease: async () => false,
    }
    const fixture = createDependencies(client)

    const pagePromise = getDiscoverPageServer(fixture.dependencies)
    await Promise.resolve()
    await Promise.resolve()

    expect(started).toEqual(keys)
    for (const [index, key] of keys.entries()) {
      const resolve = pendingReads.get(key)
      if (!resolve) throw new TypeError(`Missing deferred read for ${key}.`)
      resolve([fresh(key, index + 1)])
    }

    await expect(pagePromise).resolves.toMatchObject({
      sections: {
        trending: { status: 'ready' },
        seasonal: { status: 'ready' },
        recommendations: { status: 'ready' },
        upcoming: { status: 'ready' },
      },
    })
  })

  test('refreshes missing section under owned lease, commits, then rereads fresh data', async () => {
    let reads = 0
    const mutations: string[] = []
    const client: CacheClient = {
      readSections: async () => {
        reads += 1
        return reads === 1 ? [{ key: 'trending', status: 'missing', section: null }] : [fresh('trending', 1)]
      },
      acquireSectionLease: async () => { mutations.push('acquire'); return { acquired: true, leaseUntil: 30_000 } },
      commitSection: async () => { mutations.push('commit'); return null },
      releaseSectionLease: async () => { mutations.push('release'); return true },
    }
    const fixture = createDependencies(client)

    const state = await refreshDiscoverSectionServer('trending', fixture.dependencies)

    expect(state.status).toBe('ready')
    expect(fixture.fetched).toEqual(['trending'])
    expect(mutations).toEqual(['acquire', 'commit'])
  })

  test('waits six bounded rereads for a competing lease before returning cache refresh error', async () => {
    const client: CacheClient = {
      readSections: async () => [{ key: 'trending', status: 'missing', section: null }],
      acquireSectionLease: async () => ({ acquired: false, leaseUntil: 30_000 }),
      commitSection: async () => null,
      releaseSectionLease: async () => false,
    }
    const fixture = createDependencies(client)

    const state = await refreshDiscoverSectionServer('trending', fixture.dependencies)

    expect(state).toMatchObject({ status: 'error', code: 'CACHE_REFRESH', key: 'trending' })
    expect(fixture.delays).toEqual([500, 500, 500, 500, 500, 500])
    expect(fixture.fetched).toEqual([])
  })

  test('preserves rate-limit classification when refresh and lease release fail', async () => {
    const mutations: string[] = []
    const client: CacheClient = {
      readSections: async () => [{ key: 'upcoming', status: 'expired', section: null }],
      acquireSectionLease: async () => { mutations.push('acquire'); return { acquired: true, leaseUntil: 30_000 } },
      commitSection: async () => null,
      releaseSectionLease: async () => { mutations.push('release'); throw new Error('release failed') },
    }
    const fixture = createDependencies(client)
    fixture.dependencies.fetchSection = async () => { throw new AniListRequestError('RATE_LIMITED', 'AniList rate limit exceeded.', 12) }

    const state = await refreshDiscoverSectionServer('upcoming', fixture.dependencies)

    expect(state).toEqual({ status: 'error', key: 'upcoming', code: 'RATE_LIMITED', retryAfterSeconds: 12 })
    expect(mutations).toEqual(['acquire', 'release'])
  })

  test('returns cache refresh error after a commit failure and releases its owned lease', async () => {
    const mutations: string[] = []
    const client: CacheClient = {
      readSections: async () => [{ key: 'seasonal', status: 'missing', section: null }],
      acquireSectionLease: async () => { mutations.push('acquire'); return { acquired: true, leaseUntil: 30_000 } },
      commitSection: async () => { mutations.push('commit'); throw new Error('commit failed') },
      releaseSectionLease: async () => { mutations.push('release'); return true },
    }
    const fixture = createDependencies(client)

    await expect(refreshDiscoverSectionServer('seasonal', fixture.dependencies)).resolves.toEqual({
      status: 'error', key: 'seasonal', code: 'CACHE_REFRESH', retryAfterSeconds: null,
    })
    expect(mutations).toEqual(['acquire', 'commit', 'release'])
  })

  test('returns cache refresh error after committed data cannot be reread', async () => {
    let reads = 0
    const mutations: string[] = []
    const client: CacheClient = {
      readSections: async () => {
        reads += 1
        if (reads === 1) return [{ key: 'recommendations', status: 'missing', section: null }]
        throw new Error('reread failed')
      },
      acquireSectionLease: async () => { mutations.push('acquire'); return { acquired: true, leaseUntil: 30_000 } },
      commitSection: async () => { mutations.push('commit'); return null },
      releaseSectionLease: async () => { mutations.push('release'); return true },
    }
    const fixture = createDependencies(client)

    await expect(refreshDiscoverSectionServer('recommendations', fixture.dependencies)).resolves.toEqual({
      status: 'error', key: 'recommendations', code: 'CACHE_REFRESH', retryAfterSeconds: null,
    })
    expect(mutations).toEqual(['acquire', 'commit', 'release'])
  })
})
