/// <reference types="vite/client" />

import { makeFunctionReference } from 'convex/server'
import { convexTest } from 'convex-test'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import schema from './schema'

type PeopleKind = 'characters' | 'staff'
const modules = import.meta.glob([
  './_generated/**/*.*',
  './{animeCache,animeDetailCache,catalogIdentityModel}.ts',
])
const acquireLease = makeFunctionReference<
  'mutation',
  { key: string; leaseId: string; token: string },
  { acquired: boolean; leaseUntil: number | null }
>('animeDetailCache:acquireLease')
const commitDetail = makeFunctionReference<
  'mutation',
  { leaseId: string; token: string; summary: typeof summary; detail: typeof detail },
  null
>('animeDetailCache:commitDetail')
const commitPeoplePage = makeFunctionReference<
  'mutation',
  {
    anilistId: number
    kind: PeopleKind
    page: number
    items: Array<(typeof characters)[number] | (typeof staff)[number]>
    hasNextPage: boolean
    leaseId: string
    token: string
  },
  null
>('animeDetailCache:commitPeoplePage')
const readDetail = makeFunctionReference<
  'query',
  { anilistId: number; token?: string },
  unknown
>('animeDetailCache:readDetail')
const readPeoplePage = makeFunctionReference<
  'query',
  { anilistId: number; kind: PeopleKind; page: number; token?: string },
  unknown
>('animeDetailCache:readPeoplePage')

const token = 'detail-test-token'
const characters = [
  {
    anilistId: 10,
    name: 'Character',
    role: 'MAIN' as const,
    imageUrl: 'https://example.com/character.jpg',
    japaneseVoiceActor: {
      anilistId: 30,
      name: 'Voice Actor',
      imageUrl: 'https://example.com/actor.jpg',
      language: 'Japanese' as const,
    },
  },
]
const staff = [{
  anilistId: 20,
  name: 'Director',
  role: 'Director',
  imageUrl: 'https://example.com/staff.jpg',
}]
const related = {
  anilistId: 2,
  slug: 'related',
  title: 'Related',
  coverImageUrl: 'https://example.com/related.jpg',
  format: 'TV' as const,
  seasonYear: 2025,
}
const recommendation = {
  anilistId: 3,
  slug: 'recommended',
  title: 'Recommended',
  coverImageUrl: 'https://example.com/recommended.jpg',
  format: 'MOVIE' as const,
  seasonYear: 2024,
}
const detail = {
  anilistId: 1,
  slug: 'one',
  titles: { display: 'One', english: 'One', romaji: null, native: null },
  coverImageUrl: 'https://example.com/cover.jpg',
  bannerImageUrl: 'https://example.com/banner.jpg',
  synopsis: 'Synopsis',
  format: 'TV' as const,
  status: 'FINISHED' as const,
  source: 'MANGA',
  season: 'SUMMER' as const,
  seasonYear: 2026,
  episodes: 12,
  durationMinutes: 24,
  startDate: { year: 2026, month: 7, day: 1 },
  endDate: null,
  genres: ['Fantasy'],
  mainStudio: { name: 'Studio', siteUrl: 'https://example.com/studio' },
  related: [related],
  recommendations: [related, recommendation],
  trailer: { youtubeId: 'video', thumbnailUrl: 'https://example.com/trailer.jpg' },
  externalLinks: [{ site: 'Official', url: 'https://example.com/anime' }],
  charactersPage: { items: characters, currentPage: 1, hasNextPage: true, perPage: 24 as const },
  staffPage: { items: staff, currentPage: 1, hasNextPage: false, perPage: 24 as const },
}
const summary = {
  anilistId: 1,
  slug: 'one',
  titles: detail.titles,
  coverImageUrl: detail.coverImageUrl,
  bannerImageUrl: detail.bannerImageUrl,
  format: detail.format,
  season: detail.season,
  seasonYear: detail.seasonYear,
  episodes: detail.episodes,
  genres: detail.genres,
  popularity: 100,
  averageScore: 80,
  trending: 10,
  startDate: detail.startDate,
  nextAiringAt: null,
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

describe('anime detail Convex cache identity bridge', () => {
  test('requires the configured token for raw detail and people reads without changing payloads', async () => {
    const t = createHarness()
    await t.mutation(acquireLease, { key: 'detail:1', leaseId: 'detail-owner', token })
    await t.mutation(commitDetail, { leaseId: 'detail-owner', token, summary, detail })
    await t.mutation(acquireLease, { key: 'people:1:characters:1', leaseId: 'people-owner', token })
    await t.mutation(commitPeoplePage, {
      anilistId: 1,
      kind: 'characters',
      page: 1,
      items: characters,
      hasNextPage: false,
      leaseId: 'people-owner',
      token,
    })

    await expect(t.query(readDetail, { anilistId: 1 })).rejects.toThrow()
    await expect(t.query(readDetail, { anilistId: 1, token: 'wrong-token' }))
      .rejects.toThrow('CACHE_WRITE_UNAUTHORIZED')
    await expect(t.query(readDetail, { anilistId: 1, token })).resolves.toEqual({
      status: 'fresh',
      entry: { payload: detail, refreshedAt: now, expiresAt: now + 24 * 60 * 60 * 1000 },
    })

    await expect(t.query(readPeoplePage, {
      anilistId: 1,
      kind: 'characters',
      page: 1,
    })).rejects.toThrow()
    await expect(t.query(readPeoplePage, {
      anilistId: 1,
      kind: 'characters',
      page: 1,
      token: 'wrong-token',
    })).rejects.toThrow('CACHE_WRITE_UNAUTHORIZED')
    await expect(t.query(readPeoplePage, {
      anilistId: 1,
      kind: 'characters',
      page: 1,
      token,
    })).resolves.toEqual({
      status: 'fresh',
      entry: {
        payload: {
          items: characters,
          currentPage: 1,
          hasNextPage: false,
          perPage: 24,
        },
        refreshedAt: now,
        expiresAt: now + 24 * 60 * 60 * 1000,
      },
    })
  })

  test('registers bounded deduped detail identities while preserving detail cache and lease invariants', async () => {
    const t = createHarness()
    await t.mutation(acquireLease, { key: 'detail:1', leaseId: 'owner', token })
    await t.mutation(commitDetail, { leaseId: 'owner', token, summary, detail })

    const refs = await t.run(async (ctx) => await ctx.db.query('catalogProviderRefs').collect())
    expect(refs.map(({ kind, providerId }) => `${kind}:${providerId}`).sort()).toEqual([
      'anime:1',
      'anime:2',
      'anime:3',
      'character:10',
      'staff:20',
      'staff:30',
    ])
    const stored = await t.run(async (ctx) => await ctx.db.query('animeDetails')
      .withIndex('by_anilist_id', (q) => q.eq('anilistId', 1))
      .unique())
    expect(stored).toMatchObject({
      anilistId: 1,
      detail,
      refreshedAt: now,
      expiresAt: now + 24 * 60 * 60 * 1000,
    })
    const storedSummary = await t.run(async (ctx) => await ctx.db.query('animeSummaries')
      .withIndex('by_anilist_id', (q) => q.eq('anilistId', 1))
      .unique())
    expect(storedSummary).toMatchObject({ ...summary, updatedAt: now })
    expect(await t.run(async (ctx) => await ctx.db.query('animeDetailCacheLeases')
      .withIndex('by_key', (q) => q.eq('key', 'detail:1'))
      .unique())).toBeNull()

    const refreshedAt = now + 1_000
    vi.setSystemTime(refreshedAt)
    const refreshedDetail = {
      ...detail,
      coverImageUrl: 'https://example.com/refreshed-cover.jpg',
      bannerImageUrl: 'https://example.com/refreshed-banner.jpg',
      recommendations: [recommendation, related],
    }
    const refreshedSummary = {
      ...summary,
      coverImageUrl: refreshedDetail.coverImageUrl,
      bannerImageUrl: refreshedDetail.bannerImageUrl,
      popularity: 101,
    }
    await t.mutation(acquireLease, { key: 'detail:1', leaseId: 'refresh-owner', token })
    await t.mutation(commitDetail, {
      leaseId: 'refresh-owner',
      token,
      summary: refreshedSummary,
      detail: refreshedDetail,
    })

    expect(await t.run(async (ctx) => await ctx.db.query('catalogProviderRefs').collect()))
      .toHaveLength(6)
    expect(await t.run(async (ctx) => await ctx.db.query('catalogEntities').collect()))
      .toHaveLength(6)
    expect(await t.run(async (ctx) => await ctx.db.query('animeDetails')
      .withIndex('by_anilist_id', (q) => q.eq('anilistId', 1))
      .unique())).toMatchObject({
        anilistId: 1,
        detail: refreshedDetail,
        refreshedAt,
        expiresAt: refreshedAt + 24 * 60 * 60 * 1000,
      })
    expect(await t.run(async (ctx) => await ctx.db.query('animeSummaries')
      .withIndex('by_anilist_id', (q) => q.eq('anilistId', 1))
      .unique())).toMatchObject({ ...refreshedSummary, updatedAt: refreshedAt })
    expect(await t.run(async (ctx) => await ctx.db.query('animeDetailCacheLeases')
      .withIndex('by_key', (q) => q.eq('key', 'detail:1'))
      .unique())).toBeNull()
  })

  test('registers every person in committed people pages while preserving page fields and lease deletion', async () => {
    const t = createHarness()
    const peopleCharacters = [
      ...characters,
      {
        anilistId: 11,
        name: 'Second Character',
        role: 'SUPPORTING' as const,
        imageUrl: 'https://example.com/second-character.jpg',
        japaneseVoiceActor: {
          anilistId: 31,
          name: 'Second Voice Actor',
          imageUrl: 'https://example.com/second-actor.jpg',
          language: 'Japanese' as const,
        },
      },
    ]
    await t.mutation(acquireLease, {
      key: 'people:1:characters:2',
      leaseId: 'owner',
      token,
    })
    await t.mutation(commitPeoplePage, {
      anilistId: 1,
      kind: 'characters',
      page: 2,
      items: peopleCharacters,
      hasNextPage: false,
      leaseId: 'owner',
      token,
    })

    const refs = await t.run(async (ctx) => await ctx.db.query('catalogProviderRefs').collect())
    expect(refs.map(({ kind, providerId }) => `${kind}:${providerId}`).sort())
      .toEqual(['character:10', 'character:11', 'staff:30', 'staff:31'])
    const stored = await t.run(async (ctx) => await ctx.db.query('animeDetailPeoplePages')
      .withIndex('by_anime_kind_page', (q) => q
        .eq('anilistId', 1)
        .eq('kind', 'characters')
        .eq('page', 2))
      .unique())
    expect(stored).toMatchObject({
      anilistId: 1,
      kind: 'characters',
      page: 2,
      items: peopleCharacters,
      hasNextPage: false,
      refreshedAt: now,
      expiresAt: now + 24 * 60 * 60 * 1000,
    })
    expect(await t.run(async (ctx) => await ctx.db.query('animeDetailCacheLeases')
      .withIndex('by_key', (q) => q.eq('key', 'people:1:characters:2'))
      .unique())).toBeNull()

    const refreshedAt = now + 1_000
    vi.setSystemTime(refreshedAt)
    const refreshedCharacters = [...peopleCharacters].reverse().map((character, index) => ({
      ...character,
      imageUrl: `https://example.com/refreshed-character-${index + 1}.jpg`,
      japaneseVoiceActor: {
        ...character.japaneseVoiceActor,
        imageUrl: `https://example.com/refreshed-actor-${index + 1}.jpg`,
      },
    }))
    await t.mutation(acquireLease, {
      key: 'people:1:characters:2',
      leaseId: 'refresh-owner',
      token,
    })
    await t.mutation(commitPeoplePage, {
      anilistId: 1,
      kind: 'characters',
      page: 2,
      items: refreshedCharacters,
      hasNextPage: true,
      leaseId: 'refresh-owner',
      token,
    })

    expect(await t.run(async (ctx) => await ctx.db.query('catalogProviderRefs').collect()))
      .toHaveLength(4)
    expect(await t.run(async (ctx) => await ctx.db.query('catalogEntities').collect()))
      .toHaveLength(4)
    expect(await t.run(async (ctx) => await ctx.db.query('animeDetailPeoplePages')
      .withIndex('by_anime_kind_page', (q) => q
        .eq('anilistId', 1)
        .eq('kind', 'characters')
        .eq('page', 2))
      .unique())).toMatchObject({
        anilistId: 1,
        kind: 'characters',
        page: 2,
        items: refreshedCharacters,
        hasNextPage: true,
        refreshedAt,
        expiresAt: refreshedAt + 24 * 60 * 60 * 1000,
      })
    expect(await t.run(async (ctx) => await ctx.db.query('animeDetailCacheLeases')
      .withIndex('by_key', (q) => q.eq('key', 'people:1:characters:2'))
      .unique())).toBeNull()
  })

  test('registers and refreshes Staff people pages without changing cache invariants', async () => {
    const t = createHarness()
    const peopleStaff = [
      ...staff,
      {
        anilistId: 21,
        name: 'Writer',
        role: 'Writer',
        imageUrl: 'https://example.com/writer.jpg',
      },
    ]
    await t.mutation(acquireLease, {
      key: 'people:1:staff:2',
      leaseId: 'owner',
      token,
    })
    await t.mutation(commitPeoplePage, {
      anilistId: 1,
      kind: 'staff',
      page: 2,
      items: peopleStaff,
      hasNextPage: false,
      leaseId: 'owner',
      token,
    })

    const refreshedAt = now + 1_000
    vi.setSystemTime(refreshedAt)
    const refreshedStaff = [...peopleStaff].reverse().map((person, index) => ({
      ...person,
      role: index === 0 ? 'Series Writer' : 'Series Director',
      imageUrl: `https://example.com/refreshed-staff-${index + 1}.jpg`,
    }))
    await t.mutation(acquireLease, {
      key: 'people:1:staff:2',
      leaseId: 'refresh-owner',
      token,
    })
    await t.mutation(commitPeoplePage, {
      anilistId: 1,
      kind: 'staff',
      page: 2,
      items: refreshedStaff,
      hasNextPage: true,
      leaseId: 'refresh-owner',
      token,
    })

    const refs = await t.run(async (ctx) => await ctx.db.query('catalogProviderRefs').collect())
    expect(refs.map(({ kind, providerId }) => `${kind}:${providerId}`).sort())
      .toEqual(['staff:20', 'staff:21'])
    expect(await t.run(async (ctx) => await ctx.db.query('catalogEntities').collect()))
      .toHaveLength(2)
    expect(await t.run(async (ctx) => await ctx.db.query('animeDetailPeoplePages')
      .withIndex('by_anime_kind_page', (q) => q
        .eq('anilistId', 1)
        .eq('kind', 'staff')
        .eq('page', 2))
      .unique())).toMatchObject({
        anilistId: 1,
        kind: 'staff',
        page: 2,
        items: refreshedStaff,
        hasNextPage: true,
        refreshedAt,
        expiresAt: refreshedAt + 24 * 60 * 60 * 1000,
      })
    expect(await t.run(async (ctx) => await ctx.db.query('animeDetailCacheLeases')
      .withIndex('by_key', (q) => q.eq('key', 'people:1:staff:2'))
      .unique())).toBeNull()
  })
})
