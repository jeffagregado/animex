/// <reference types="vite/client" />

import { makeFunctionReference } from 'convex/server'
import { convexTest } from 'convex-test'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import schema from './schema'

const modules = import.meta.glob(['./_generated/**/*.*', './{animeCache,catalogIdentityModel}.ts'])
const acquireSectionLease = makeFunctionReference<
  'mutation',
  { key: 'trending'; leaseId: string; token: string },
  { acquired: boolean; leaseUntil: number | null }
>('animeCache:acquireSectionLease')
const commitSection = makeFunctionReference<
  'mutation',
  { key: 'trending'; leaseId: string; summaries: typeof summary[]; token: string },
  null
>('animeCache:commitSection')

const token = 'discover-test-token'
const summary = {
  anilistId: 1,
  slug: 'one',
  titles: { display: 'One', english: 'One', romaji: null, native: null },
  coverImageUrl: 'https://example.com/cover.jpg',
  bannerImageUrl: 'https://example.com/banner.jpg',
  format: 'TV' as const,
  season: 'SUMMER' as const,
  seasonYear: 2026,
  episodes: 12,
  genres: ['Fantasy'],
  popularity: 100,
  averageScore: 80,
  trending: 10,
  startDate: { year: 2026, month: 7, day: 1 },
  nextAiringAt: 1_800_000_000,
}
const now = new Date('2026-07-18T00:00:00.000Z').getTime()
const createHarness = () => convexTest(schema, modules)

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(now)
  vi.stubEnv('DISCOVER_CACHE_WRITE_TOKEN', token)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('discover Convex cache identity bridge', () => {
  test('registers every committed anime while preserving cache fields, order, timing, and lease deletion', async () => {
    const t = createHarness()
    const second = {
      ...summary,
      anilistId: 2,
      slug: 'two',
      titles: { display: 'Two', english: 'Two', romaji: null, native: null },
    }
    await t.mutation(acquireSectionLease, {
      key: 'trending',
      leaseId: 'owner',
      token,
    })
    await t.mutation(commitSection, {
      key: 'trending',
      leaseId: 'owner',
      summaries: [second, summary],
      token,
    })

    const refs = await t.run(async (ctx) => await ctx.db.query('catalogProviderRefs').collect())
    expect(refs.map(({ provider, kind, providerId }) => ({ provider, kind, providerId })))
      .toEqual(expect.arrayContaining([
        { provider: 'anilist', kind: 'anime', providerId: 1 },
        { provider: 'anilist', kind: 'anime', providerId: 2 },
      ]))
    expect(refs).toHaveLength(2)

    const section = await t.run(async (ctx) => await ctx.db.query('discoverSectionCache')
      .withIndex('by_key', (q) => q.eq('key', 'trending'))
      .unique())
    expect(section).toMatchObject({
      key: 'trending',
      animeIds: [2, 1],
      refreshedAt: now,
      expiresAt: now + 3 * 60 * 60 * 1000,
    })
    const stored = await t.run(async (ctx) => await ctx.db.query('animeSummaries')
      .withIndex('by_anilist_id', (q) => q.eq('anilistId', 1))
      .unique())
    expect(stored).toMatchObject({ ...summary, updatedAt: now })
    expect(await t.run(async (ctx) => await ctx.db.query('discoverCacheLeases')
      .withIndex('by_key', (q) => q.eq('key', 'trending'))
      .unique())).toBeNull()
  })
})
