/// <reference types="vite/client" />

import { makeFunctionReference } from 'convex/server'
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'

import schema from './schema'

type CatalogIdentityLane =
  | 'anime-summaries'
  | 'anime-details'
  | 'anime-people-pages'
  | 'catalog-person-details'
  | 'catalog-person-work-pages'
  | 'user-anime-entries'
  | 'anime-rewatches'
  | 'anime-milestones'
  | 'reviews'
  | 'feed-cards'
  | 'anime-review-stats'

type MigrationResult = {
  lane: CatalogIdentityLane
  continueCursor: string
  isDone: boolean
  processedCount: number
  createdCount: number
  existingCount: number
  missingCount: number
  conflictCount: number
}

const lanes: CatalogIdentityLane[] = [
  'anime-summaries',
  'anime-details',
  'anime-people-pages',
  'catalog-person-details',
  'catalog-person-work-pages',
  'user-anime-entries',
  'anime-rewatches',
  'anime-milestones',
  'reviews',
  'feed-cards',
  'anime-review-stats',
]
const modules = import.meta.glob(['./_generated/**/*.*', './catalogIdentityMigration.ts'])
const backfillLane = makeFunctionReference<
  'mutation',
  { lane: CatalogIdentityLane; paginationOpts: { numItems: number; cursor: string | null } },
  MigrationResult
>('catalogIdentityMigration:backfillLane')
const verifyLane = makeFunctionReference<
  'mutation',
  { lane: CatalogIdentityLane; paginationOpts: { numItems: number; cursor: string | null } },
  MigrationResult
>('catalogIdentityMigration:verifyLane')
const page = (cursor: string | null, numItems: number) => ({ numItems, cursor })
const createHarness = () => convexTest(schema, modules)

const animeDetail = {
  anilistId: 102,
  slug: 'detail',
  titles: { display: 'Detail', english: null, romaji: null, native: null },
  coverImageUrl: null,
  bannerImageUrl: null,
  synopsis: null,
  format: 'TV' as const,
  status: 'FINISHED' as const,
  source: null,
  season: null,
  seasonYear: null,
  episodes: null,
  durationMinutes: null,
  startDate: null,
  endDate: null,
  genres: [],
  mainStudio: null,
  related: [{
    anilistId: 103, slug: 'related', title: 'Related', coverImageUrl: null,
    format: 'TV' as const, seasonYear: null,
  }],
  recommendations: [{
    anilistId: 103, slug: 'related', title: 'Related', coverImageUrl: null,
    format: 'TV' as const, seasonYear: null,
  }],
  trailer: null,
  externalLinks: [],
  charactersPage: {
    items: [{
      anilistId: 201,
      name: 'Character',
      role: 'MAIN' as const,
      imageUrl: null,
      japaneseVoiceActor: {
        anilistId: 301,
        name: 'Voice Actor',
        imageUrl: null,
        language: 'Japanese' as const,
      },
    }],
    currentPage: 1,
    hasNextPage: false,
    perPage: 24 as const,
  },
  staffPage: {
    items: [{ anilistId: 302, name: 'Staff', role: 'Director', imageUrl: null }],
    currentPage: 1,
    hasNextPage: false,
    perPage: 24 as const,
  },
}

/** Inserts one representative source row for every identity lane. */
const seedAllLanes = async (t: ReturnType<typeof createHarness>) => {
  await t.run(async (ctx) => {
    const now = 1
    const userId = await ctx.db.insert('users', {
      authId: 'migration-user',
      username: 'migration',
      usernameKey: 'migration',
      name: 'Migration',
      profileVisibility: 'public',
      visibility: 'public',
      createdAt: now,
      updatedAt: now,
    })
    const entryId = await ctx.db.insert('userAnimeEntries', {
      userId, anilistId: 106, status: 'watching', score: null, favoriteAt: null,
      rewatchCount: 1, lastRewatchSequence: 1, createdAt: now, updatedAt: now,
    })
    await ctx.db.insert('animeSummaries', {
      anilistId: 101, slug: 'summary',
      titles: { display: 'Summary', english: null, romaji: null, native: null },
      coverImageUrl: null, bannerImageUrl: null, format: 'TV', season: null,
      seasonYear: null, episodes: null, genres: [], popularity: 1,
      averageScore: null, trending: null, startDate: null, nextAiringAt: null, updatedAt: now,
    })
    await ctx.db.insert('animeDetails', {
      anilistId: animeDetail.anilistId,
      detail: animeDetail,
      refreshedAt: now,
      expiresAt: now,
    })
    await ctx.db.insert('animeDetailPeoplePages', {
      anilistId: 104,
      kind: 'characters',
      page: 1,
      items: animeDetail.charactersPage.items,
      hasNextPage: false,
      refreshedAt: now,
      expiresAt: now,
    })
    await ctx.db.insert('catalogPersonDetails', {
      kind: 'character',
      personId: 203,
      detail: {
        kind: 'character',
        id: 203,
        name: 'Person',
        nativeName: null,
        imageUrl: null,
        description: [
          '[Story](https://anilist.co/anime/120)',
          '[Friend](https://anilist.co/character/220)',
          '[Colleague](https://anilist.co/staff/320)',
          '[External](https://example.com/anime/999)',
        ].join(' '),
        age: null,
        gender: null,
        birthday: null,
        bloodType: null,
        voiceActorScope: 'all-languages',
        voiceActors: [{ id: 304, name: 'Actor', imageUrl: null, language: 'Japanese' }],
      },
      refreshedAt: now,
      expiresAt: now,
    })
    await ctx.db.insert('catalogPersonWorkPages', {
      kind: 'staff',
      personId: 305,
      page: 1,
      items: [{ animeId: 105, role: 'Director' }, { animeId: 105, role: 'Creator' }],
      hasNextPage: false,
      refreshedAt: now,
      expiresAt: now,
    })
    await ctx.db.insert('animeRewatchEntries', {
      entryId, userId, anilistId: 107, completedAt: now, sequence: 1,
    })
    await ctx.db.insert('animeMilestones', {
      userId, anilistId: 108, kind: 'completed', visibility: 'public',
      occurredAt: now, updatedAt: now,
    })
    const reviewId = await ctx.db.insert('reviews', {
      userId, anilistId: 109, requestId: 'migration-review', state: 'published',
      rating: 80, summary: 'Review', containsSpoiler: false, bodyJson: '{}',
      visibility: 'public', publishedAt: now, updatedAt: now, activityState: 'active',
      newestOrderKey: 'review', highRatingOrderKey: 'review', lowRatingOrderKey: 'review',
      searchText: 'review', ratingBand: '80-89',
    })
    await ctx.db.insert('feedCards', {
      sourceKey: `review:${reviewId}`, kind: 'review', userId, sourceId: reviewId,
      anilistId: 110, visibility: 'public', active: true, orderKey: 'feed',
      occurredAt: now, updatedAt: now,
    })
    await ctx.db.insert('feedCards', {
      sourceKey: 'post:missing-anime', kind: 'post', userId,
      visibility: 'public', active: true, orderKey: 'post',
      occurredAt: now, updatedAt: now,
    })
    await ctx.db.insert('animeReviewStats', {
      anilistId: 111, count: 1, ratingSum: 80,
      bands: [0, 0, 1, 0, 0, 0, 0, 0, 0, 0], updatedAt: now,
    })
  })
}

describe('catalog identity migration', () => {
  test('returns explicit empty results for every lane', async () => {
    const t = createHarness()
    for (const lane of lanes) {
      await expect(t.mutation(backfillLane, { lane, paginationOpts: page(null, 50) })).resolves.toEqual({
        lane,
        continueCursor: expect.any(String),
        isDone: true,
        processedCount: 0,
        createdCount: 0,
        existingCount: 0,
        missingCount: 0,
        conflictCount: 0,
      })
      await expect(t.mutation(verifyLane, { lane, paginationOpts: page(null, 50) })).resolves.toMatchObject({
        lane,
        isDone: true,
        processedCount: 0,
        missingCount: 0,
        conflictCount: 0,
      })
    }
  })

  test('backfills and verifies all source lanes with bounded embedded references', async () => {
    const t = createHarness()
    await seedAllLanes(t)

    for (const lane of lanes) {
      const backfill = await t.mutation(backfillLane, { lane, paginationOpts: page(null, 50) })
      expect(backfill).toMatchObject({ lane, isDone: true, missingCount: 0, conflictCount: 0 })
      expect(backfill.processedCount).toBeGreaterThan(0)
      const verification = await t.mutation(verifyLane, { lane, paginationOpts: page(null, 50) })
      expect(verification).toMatchObject({ lane, isDone: true, missingCount: 0, conflictCount: 0 })
    }

    const refs = await t.run(async (ctx) => await ctx.db.query('catalogProviderRefs').collect())
    const keys = refs.map((ref) => `${ref.kind}:${ref.providerId}`)
    expect(keys).toEqual(expect.arrayContaining([
      'anime:101', 'anime:102', 'anime:103', 'character:201', 'staff:301',
      'staff:302', 'anime:104', 'character:203', 'staff:304', 'staff:305',
      'anime:105', 'anime:106', 'anime:107', 'anime:108', 'anime:109',
      'anime:110', 'anime:111', 'anime:120', 'character:220', 'staff:320',
    ]))
    expect(keys.filter((key) => key === 'anime:103')).toHaveLength(1)
    expect(refs).toHaveLength(new Set(keys).size)
  })

  test('resumes true table pagination and reruns idempotently', async () => {
    const t = createHarness()
    await t.run(async (ctx) => {
      for (const anilistId of [1, 2]) {
        await ctx.db.insert('animeReviewStats', {
          anilistId, count: 0, ratingSum: 0,
          bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], updatedAt: 1,
        })
      }
    })

    const first = await t.mutation(backfillLane, {
      lane: 'anime-review-stats',
      paginationOpts: page(null, 1),
    })
    expect(first).toMatchObject({ isDone: false, processedCount: 1, createdCount: 1 })
    const second = await t.mutation(backfillLane, {
      lane: 'anime-review-stats',
      paginationOpts: page(first.continueCursor, 1),
    })
    expect(second).toMatchObject({ isDone: true, processedCount: 1, createdCount: 1 })

    const rerun = await t.mutation(backfillLane, {
      lane: 'anime-review-stats',
      paginationOpts: page(null, 50),
    })
    expect(rerun).toMatchObject({ createdCount: 0, existingCount: 2 })
  })

  test('keeps equal Character and Staff IDs separate', async () => {
    const t = createHarness()
    await t.run(async (ctx) => {
      for (const kind of ['character', 'staff'] as const) {
        await ctx.db.insert('catalogPersonDetails', {
          kind,
          personId: 700,
          detail: kind === 'character'
            ? {
                kind, id: 700, name: 'Character', nativeName: null, imageUrl: null,
                description: null, age: null, gender: null, birthday: null, bloodType: null,
              }
            : {
                kind, id: 700, name: 'Staff', nativeName: null, imageUrl: null,
                description: null, occupations: [], language: null, hometown: null, activeYears: null,
              },
          refreshedAt: 1,
          expiresAt: 1,
        })
      }
    })

    await t.mutation(backfillLane, {
      lane: 'catalog-person-details',
      paginationOpts: page(null, 50),
    })
    const refs = await t.run(async (ctx) => await ctx.db
      .query('catalogProviderRefs')
      .withIndex('by_provider_kind_id', (q) => q.eq('provider', 'anilist'))
      .collect())
    expect(refs.map(({ kind, providerId }) => ({ kind, providerId }))).toEqual([
      { kind: 'character', providerId: 700 },
      { kind: 'staff', providerId: 700 },
    ])
    expect(refs[0]?.entityId).not.toBe(refs[1]?.entityId)
  })

  test('rejects legacy rows with unbounded embedded references', async () => {
    const t = createHarness()
    await t.run(async (ctx) => {
      await ctx.db.insert('catalogPersonDetails', {
        kind: 'character',
        personId: 800,
        detail: {
          kind: 'character',
          id: 800,
          name: 'Legacy',
          nativeName: null,
          imageUrl: null,
          description: null,
          age: null,
          gender: null,
          birthday: null,
          bloodType: null,
          voiceActorScope: 'all-languages',
          voiceActors: Array.from({ length: 101 }, (_, index) => ({
            id: index + 1,
            name: `Actor ${index + 1}`,
            imageUrl: null,
            language: 'Japanese',
          })),
        },
        refreshedAt: 1,
        expiresAt: 1,
      })
    })

    await expect(t.mutation(backfillLane, {
      lane: 'catalog-person-details',
      paginationOpts: page(null, 50),
    })).rejects.toThrow('embedded provider references')
  })

  test('rejects aggregate page overflow before creating any mappings', async () => {
    const t = createHarness()
    await t.run(async (ctx) => {
      for (const [rowIndex, kind] of (['character', 'staff'] as const).entries()) {
        const baseAnimeId = rowIndex * 50
        await ctx.db.insert('catalogPersonWorkPages', {
          kind,
          personId: 900 + rowIndex,
          page: 1,
          items: Array.from({ length: 50 }, (_, itemIndex) => ({
            animeId: baseAnimeId + itemIndex + 1,
            role: null,
          })),
          hasNextPage: false,
          refreshedAt: 1,
          expiresAt: 1,
        })
      }
    })

    await expect(t.mutation(backfillLane, {
      lane: 'catalog-person-work-pages',
      paginationOpts: page(null, 2),
    })).rejects.toThrow('CATALOG_IDENTITY_PAGE_UNBOUNDED')
    const counts = await t.run(async (ctx) => ({
      entities: (await ctx.db.query('catalogEntities').collect()).length,
      mappings: (await ctx.db.query('catalogProviderRefs').collect()).length,
    }))
    expect(counts).toEqual({ entities: 0, mappings: 0 })
  })

  test('reports missing mappings and fails explicit mapping conflicts', async () => {
    const t = createHarness()
    await t.run(async (ctx) => {
      await ctx.db.insert('animeReviewStats', {
        anilistId: 404, count: 0, ratingSum: 0,
        bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], updatedAt: 1,
      })
    })
    await expect(t.mutation(verifyLane, {
      lane: 'anime-review-stats',
      paginationOpts: page(null, 50),
    })).resolves.toMatchObject({ missingCount: 1, conflictCount: 0 })

    const corrupt = createHarness()
    await corrupt.run(async (ctx) => {
      await ctx.db.insert('animeReviewStats', {
        anilistId: 500, count: 0, ratingSum: 0,
        bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], updatedAt: 1,
      })
      for (const kind of ['anime', 'staff'] as const) {
        const entityId = await ctx.db.insert('catalogEntities', {
          kind, createdAt: 1, updatedAt: 1,
        })
        await ctx.db.insert('catalogProviderRefs', {
          entityId, provider: 'anilist', kind: 'anime',
          providerId: 500, createdAt: 1, updatedAt: 1,
        })
      }
    })
    await expect(corrupt.mutation(backfillLane, {
      lane: 'anime-review-stats',
      paginationOpts: page(null, 50),
    })).rejects.toThrow('multiple mappings')
    await expect(corrupt.mutation(verifyLane, {
      lane: 'anime-review-stats',
      paginationOpts: page(null, 50),
    })).rejects.toThrow('multiple mappings')
  })
})
