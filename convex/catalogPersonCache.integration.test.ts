/// <reference types="vite/client" />

import { makeFunctionReference } from 'convex/server'
import { convexTest } from 'convex-test'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import schema from './schema'

type Kind = 'character' | 'staff'
type Detail = {
  kind: 'character'
  id: number
  name: string
  nativeName: null
  imageUrl: null
  description: null
  age: null
  gender: null
  birthday: null
  bloodType: null
  voiceActorScope: 'all-languages'
  voiceActors: Array<{
    id: number
    name: string
    imageUrl: string | null
    language: string
  }>
}
const modules = import.meta.glob([
  './_generated/**/*.*',
  './{animeCache,catalogIdentityModel,catalogPersonCache}.ts',
])
const readDetail = makeFunctionReference<'query', { kind: Kind; personId: number }, unknown>('catalogPersonCache:readDetail')
const readWorkPage = makeFunctionReference<'query', { kind: Kind; personId: number; page: number }, unknown>('catalogPersonCache:readWorkPage')
const acquireLease = makeFunctionReference<'mutation', { key: string; leaseId: string; token: string }, { acquired: boolean; leaseUntil: number | null }>('catalogPersonCache:acquireLease')
const commitDetail = makeFunctionReference<'mutation', { kind: Kind; personId: number; detail: Detail; leaseId: string; token: string }, null>('catalogPersonCache:commitDetail')
const commitWorkPage = makeFunctionReference<'mutation', {
  kind: Kind
  personId: number
  page: number
  items: Array<{ animeId: number; role: string | null }>
  hasNextPage: boolean
  summaries: typeof summary[]
  leaseId: string
  token: string
}, null>('catalogPersonCache:commitWorkPage')
const releaseLease = makeFunctionReference<'mutation', { key: string; leaseId: string; token: string }, boolean>('catalogPersonCache:releaseLease')

const token = 'catalog-person-test-token'
const now = new Date('2026-07-17T00:00:00.000Z').getTime()
const detail: Detail = {
  kind: 'character', id: 12, name: 'Frieren', nativeName: null, imageUrl: null,
  description: null, age: null, gender: null, birthday: null, bloodType: null,
  voiceActorScope: 'all-languages',
  voiceActors: [
    { id: 21, name: 'Atsumi Tanezaki', imageUrl: null, language: 'Japanese' },
    { id: 22, name: 'English Actor', imageUrl: null, language: 'English' },
  ],
}
const summary = {
  anilistId: 1, slug: 'one', titles: { display: 'One', english: 'One', romaji: null, native: null },
  coverImageUrl: null, bannerImageUrl: null, format: 'TV' as const, season: null,
  seasonYear: 2024, episodes: 12, genres: [], popularity: 1, averageScore: 80,
  trending: null, startDate: { year: 2024, month: 1, day: 1 }, nextAiringAt: null,
}
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

describe('catalog person Convex cache', () => {
  test('guards tokens, validators, indexes, owner commit, and lease deletion', async () => {
    const t = createHarness()
    await expect(t.query(readDetail, { kind: 'character', personId: 0 })).rejects.toThrow()
    await expect(t.mutation(acquireLease, {
      key: 'person:character:12', leaseId: 'owner', token: 'wrong',
    })).rejects.toThrow()

    await expect(t.mutation(acquireLease, {
      key: 'person:character:12', leaseId: 'owner', token,
    })).resolves.toMatchObject({ acquired: true })
    await expect(t.mutation(commitDetail, {
      kind: 'character', personId: 12, detail, leaseId: 'other', token,
    })).rejects.toThrow()
    await t.mutation(commitDetail, {
      kind: 'character', personId: 12, detail, leaseId: 'owner', token,
    })

    await expect(t.query(readDetail, { kind: 'character', personId: 12 }))
      .resolves.toMatchObject({ status: 'fresh', entry: { payload: detail } })
    expect(await t.run(async (ctx) => await ctx.db.query('catalogPersonDetails')
      .withIndex('by_kind_person', (q) => q.eq('kind', 'character').eq('personId', 12))
      .unique())).toMatchObject({
        kind: 'character',
        personId: 12,
        detail,
        refreshedAt: now,
        expiresAt: now + 24 * 60 * 60 * 1000,
      })
    expect(await t.run(async (ctx) => await ctx.db.query('catalogPersonCacheLeases')
      .withIndex('by_key', (q) => q.eq('key', 'person:character:12'))
      .unique())).toBeNull()
    const refs = await t.run(async (ctx) => await ctx.db.query('catalogProviderRefs').collect())
    expect(refs.map(({ kind, providerId }) => `${kind}:${providerId}`).sort())
      .toEqual(['character:12', 'staff:21', 'staff:22'])
  })

  test('upserts full summaries and hydrates ordered work transactionally', async () => {
    const t = createHarness()
    await t.mutation(acquireLease, {
      key: 'person-work:staff:21:1', leaseId: 'work-owner', token,
    })
    const second = {
      ...summary, anilistId: 2, slug: 'two',
      titles: { display: 'Two', english: 'Two', romaji: null, native: null },
    }
    await t.mutation(commitWorkPage, {
      kind: 'staff', personId: 21, page: 1,
      items: [{ animeId: 2, role: 'Director' }, { animeId: 1, role: null }],
      hasNextPage: true, summaries: [summary, second], leaseId: 'work-owner', token,
    })

    await expect(t.query(readWorkPage, { kind: 'staff', personId: 21, page: 1 }))
      .resolves.toMatchObject({
        status: 'fresh',
        entry: { payload: {
          items: [
            { anime: { id: 2, title: 'Two' }, role: 'Director' },
            { anime: { id: 1, title: 'One' }, role: null },
          ],
          currentPage: 1,
          hasNextPage: true,
        } },
      })
    expect(await t.run(async (ctx) => await ctx.db.query('animeSummaries').collect()))
      .toHaveLength(2)
    expect(await t.run(async (ctx) => await ctx.db.query('catalogPersonWorkPages')
      .withIndex('by_kind_person_page', (q) => q
        .eq('kind', 'staff')
        .eq('personId', 21)
        .eq('page', 1))
      .unique())).toMatchObject({
        kind: 'staff',
        personId: 21,
        page: 1,
        items: [{ animeId: 2, role: 'Director' }, { animeId: 1, role: null }],
        hasNextPage: true,
        refreshedAt: now,
        expiresAt: now + 24 * 60 * 60 * 1000,
      })
    expect(await t.run(async (ctx) => await ctx.db.query('catalogPersonCacheLeases')
      .withIndex('by_key', (q) => q.eq('key', 'person-work:staff:21:1'))
      .unique())).toBeNull()
    const refs = await t.run(async (ctx) => await ctx.db.query('catalogProviderRefs').collect())
    expect(refs.map(({ kind, providerId }) => `${kind}:${providerId}`).sort())
      .toEqual(['anime:1', 'anime:2', 'staff:21'])
  })

  test('expires exactly at 24 hours and never returns stale detail', async () => {
    const t = createHarness()
    await t.mutation(acquireLease, {
      key: 'person:character:12', leaseId: 'owner', token,
    })
    await t.mutation(commitDetail, {
      kind: 'character', personId: 12, detail, leaseId: 'owner', token,
    })
    vi.setSystemTime(new Date('2026-07-18T00:00:00.000Z'))
    await expect(t.query(readDetail, { kind: 'character', personId: 12 }))
      .resolves.toEqual({ status: 'expired', entry: null })
  })

  test('expires legacy Character detail without all-language completeness before serving it', async () => {
    const t = createHarness()
    const { voiceActorScope: _voiceActorScope, ...legacyDetail } = detail
    const now = Date.now()
    await t.run(async (ctx) => await ctx.db.insert('catalogPersonDetails', {
      kind: 'character',
      personId: 12,
      detail: legacyDetail,
      refreshedAt: now,
      expiresAt: now + 86_400_000,
    }))

    await expect(t.query(readDetail, { kind: 'character', personId: 12 }))
      .resolves.toEqual({ status: 'expired', entry: null })
  })

  test('rejects missing summary hydration and enforces release ownership', async () => {
    const t = createHarness()
    const now = Date.now()
    await t.run(async (ctx) => await ctx.db.insert('catalogPersonWorkPages', {
      kind: 'character', personId: 12, page: 1,
      items: [{ animeId: 404, role: 'MAIN' }], hasNextPage: false,
      refreshedAt: now, expiresAt: now + 86_400_000,
    }))
    await expect(t.query(readWorkPage, { kind: 'character', personId: 12, page: 1 }))
      .rejects.toThrow('missing anime 404')

    await t.mutation(acquireLease, {
      key: 'person:staff:21', leaseId: 'owner', token,
    })
    await expect(t.mutation(releaseLease, {
      key: 'person:staff:21', leaseId: 'other', token,
    })).rejects.toThrow()
    await expect(t.mutation(releaseLease, {
      key: 'person:staff:21', leaseId: 'owner', token,
    })).resolves.toBe(true)
  })
})
