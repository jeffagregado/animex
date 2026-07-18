/// <reference types="vite/client" />

import { makeFunctionReference } from 'convex/server'
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'

import schema from './schema'

type DurableAnimeLane =
  | 'user-anime-entries'
  | 'anime-rewatches'
  | 'anime-milestones'
  | 'reviews'
  | 'feed-cards'
  | 'anime-review-stats'

type BackfillResult = {
  lane: DurableAnimeLane
  continueCursor: string
  isDone: boolean
  processedCount: number
  patchedCount: number
}

type VerificationResult = {
  lane: DurableAnimeLane
  continueCursor: string
  isDone: boolean
  processedCount: number
  missingAnimeId: number
  mismatchedProviderRef: number
  duplicateUserAnime: number
  duplicateReview: number
  duplicateMilestoneSourceKey: number
  aggregateMismatch: number
  projectionMismatch: number
}
type AggregateResult = {
  continueCursor: string
  isDone: boolean
  processedCount: number
  count: number
  ratingSum: number
  bands: number[]
  aggregateMismatch: number
}

const modules = import.meta.glob([
  './_generated/**/*.*',
  './catalogAnimeAggregateVerification.ts',
  './catalogAnimeDataMigration.ts',
])
const createHarness = () => convexTest(schema, modules)
const paginationOpts = { numItems: 20, cursor: null }
const backfillAnimeRefs = makeFunctionReference<
  'mutation',
  { lane: DurableAnimeLane; paginationOpts: typeof paginationOpts },
  BackfillResult
>('catalogAnimeDataMigration:backfillAnimeRefs')
const backfillMilestoneSourceKeys = makeFunctionReference<
  'mutation',
  { paginationOpts: typeof paginationOpts },
  Omit<BackfillResult, 'lane'>
>('catalogAnimeDataMigration:backfillMilestoneSourceKeys')
const verifyAnimeRefs = makeFunctionReference<
  'mutation',
  { lane: DurableAnimeLane; paginationOpts: typeof paginationOpts },
  VerificationResult
>('catalogAnimeDataMigration:verifyAnimeRefs')
const verifyReviewAggregate = makeFunctionReference<
  'mutation',
  { statsId: string; paginationOpts: { numItems: number; cursor: string | null } },
  AggregateResult
>('catalogAnimeAggregateVerification:verifyReviewAggregate')

/** Seeds one complete legacy durable graph and its authoritative provider mapping. */
const seedLegacyGraph = async (t: ReturnType<typeof createHarness>) => await t.run(async (ctx) => {
  const now = 100
  const userId = await ctx.db.insert('users', {
    authId: 'durable-migration-user',
    username: 'durable',
    usernameKey: 'durable',
    name: 'Durable',
    profileVisibility: 'public',
    visibility: 'public',
    createdAt: now,
    updatedAt: now,
  })
  const animeId = await ctx.db.insert('catalogEntities', {
    kind: 'anime',
    createdAt: now,
    updatedAt: now,
  })
  await ctx.db.insert('catalogProviderRefs', {
    entityId: animeId,
    provider: 'anilist',
    kind: 'anime',
    providerId: 101,
    createdAt: now,
    updatedAt: now,
  })
  const entryId = await ctx.db.insert('userAnimeEntries', {
    userId,
    anilistId: 101,
    status: 'rewatched',
    score: 91,
    favoriteAt: 90,
    rewatchCount: 1,
    lastRewatchSequence: 1,
    createdAt: 80,
    updatedAt: 100,
  })
  const rewatchId = await ctx.db.insert('animeRewatchEntries', {
    entryId,
    userId,
    anilistId: 101,
    completedAt: 95,
    sequence: 1,
  })
  const milestoneId = await ctx.db.insert('animeMilestones', {
    userId,
    anilistId: 101,
    kind: 'rewatched',
    visibility: 'public',
    occurredAt: 95,
    updatedAt: 100,
  })
  const reviewId = await ctx.db.insert('reviews', {
    userId,
    anilistId: 101,
    requestId: 'durable-review',
    state: 'published',
    rating: 91,
    summary: 'Preserve this Review.',
    containsSpoiler: true,
    bodyJson: '{"preserved":true}',
    visibility: 'public',
    publishedAt: 90,
    updatedAt: 100,
    activityState: 'active',
    newestOrderKey: 'newest',
    highRatingOrderKey: 'high',
    lowRatingOrderKey: 'low',
    searchText: 'preserve',
    ratingBand: '90-100',
  })
  const milestoneCardId = await ctx.db.insert('feedCards', {
    sourceKey: `rewatched:${userId}:101`,
    kind: 'rewatched',
    userId,
    anilistId: 101,
    visibility: 'public',
    active: true,
    orderKey: 'milestone-order',
    occurredAt: 95,
    updatedAt: 100,
  })
  const reviewCardId = await ctx.db.insert('feedCards', {
    sourceKey: `review:${reviewId}`,
    kind: 'review',
    userId,
    sourceId: reviewId,
    anilistId: 101,
    visibility: 'public',
    active: true,
    orderKey: 'review-order',
    occurredAt: 90,
    updatedAt: 100,
  })
  const statsId = await ctx.db.insert('animeReviewStats', {
    anilistId: 101,
    count: 1,
    ratingSum: 91,
    bands: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    updatedAt: 100,
  })
  return { animeId, entryId, rewatchId, milestoneId, reviewId, milestoneCardId, reviewCardId, statsId, userId }
})

describe('catalog Anime durable data migration', () => {
  test('backfills every durable row to one entity without changing domain data and reruns cleanly', async () => {
    const t = createHarness()
    const ids = await seedLegacyGraph(t)
    const before = await t.run(async (ctx) => ({
      entry: await ctx.db.get('userAnimeEntries', ids.entryId),
      rewatch: await ctx.db.get('animeRewatchEntries', ids.rewatchId),
      milestone: await ctx.db.get('animeMilestones', ids.milestoneId),
      review: await ctx.db.get('reviews', ids.reviewId),
      milestoneCard: await ctx.db.get('feedCards', ids.milestoneCardId),
      reviewCard: await ctx.db.get('feedCards', ids.reviewCardId),
      stats: await ctx.db.get('animeReviewStats', ids.statsId),
    }))

    const lanes: DurableAnimeLane[] = [
      'user-anime-entries',
      'anime-rewatches',
      'anime-milestones',
      'reviews',
      'feed-cards',
      'anime-review-stats',
    ]
    for (const lane of lanes) {
      await expect(t.mutation(backfillAnimeRefs, { lane, paginationOpts })).resolves.toMatchObject({
        lane,
        processedCount: lane === 'feed-cards' ? 2 : 1,
        patchedCount: lane === 'feed-cards' ? 2 : 1,
      })
      await expect(t.mutation(backfillAnimeRefs, { lane, paginationOpts })).resolves.toMatchObject({
        lane,
        patchedCount: 0,
      })
    }
    await t.mutation(verifyReviewAggregate, { statsId: ids.statsId, paginationOpts })
    for (const lane of lanes) {
      await expect(t.mutation(verifyAnimeRefs, { lane, paginationOpts })).resolves.toMatchObject({
        missingAnimeId: 0,
        mismatchedProviderRef: 0,
        duplicateUserAnime: 0,
        duplicateReview: 0,
        duplicateMilestoneSourceKey: 0,
        aggregateMismatch: 0,
        projectionMismatch: 0,
      })
    }

    const after = await t.run(async (ctx) => ({
      entry: await ctx.db.get('userAnimeEntries', ids.entryId),
      rewatch: await ctx.db.get('animeRewatchEntries', ids.rewatchId),
      milestone: await ctx.db.get('animeMilestones', ids.milestoneId),
      review: await ctx.db.get('reviews', ids.reviewId),
      milestoneCard: await ctx.db.get('feedCards', ids.milestoneCardId),
      reviewCard: await ctx.db.get('feedCards', ids.reviewCardId),
      stats: await ctx.db.get('animeReviewStats', ids.statsId),
    }))
    for (const row of Object.values(after)) expect(row?.animeId).toBe(ids.animeId)
    for (const key of Object.keys(before) as Array<keyof typeof before>) {
      expect(after[key]).toEqual({ ...before[key], animeId: ids.animeId })
    }
  })

  test('migrates legacy milestone source keys once after entity refs exist', async () => {
    const t = createHarness()
    const ids = await seedLegacyGraph(t)
    await t.mutation(backfillAnimeRefs, { lane: 'anime-milestones', paginationOpts })
    await t.mutation(backfillAnimeRefs, { lane: 'feed-cards', paginationOpts })

    await expect(t.mutation(backfillMilestoneSourceKeys, { paginationOpts })).rejects.toThrow('verification receipts')
    const lanes = [
      'user-anime-entries', 'anime-rewatches', 'anime-milestones', 'reviews', 'feed-cards', 'anime-review-stats',
    ] as DurableAnimeLane[]
    for (const lane of lanes) {
      await t.mutation(backfillAnimeRefs, { lane, paginationOpts })
    }
    await t.mutation(verifyReviewAggregate, { statsId: ids.statsId, paginationOpts })
    for (const lane of lanes) {
      await t.mutation(verifyAnimeRefs, { lane, paginationOpts })
    }
    await expect(t.mutation(backfillMilestoneSourceKeys, { paginationOpts })).resolves.toMatchObject({
      processedCount: 2,
      patchedCount: 1,
    })
    const card = await t.run(async (ctx) => await ctx.db.get('feedCards', ids.milestoneCardId))
    expect(card?.sourceKey).toBe(`rewatched:${ids.userId}:${ids.animeId}`)
    expect(card).toMatchObject({ orderKey: 'milestone-order', occurredAt: 95, updatedAt: 100 })
    await expect(t.mutation(backfillMilestoneSourceKeys, { paginationOpts })).resolves.toMatchObject({
      patchedCount: 0,
    })
  })

  test('refuses duplicate milestone targets after verification completes', async () => {
    const t = createHarness()
    const ids = await seedLegacyGraph(t)
    const lanes = [
      'user-anime-entries', 'anime-rewatches', 'anime-milestones', 'reviews', 'feed-cards', 'anime-review-stats',
    ] as DurableAnimeLane[]
    for (const lane of lanes) {
      await t.mutation(backfillAnimeRefs, { lane, paginationOpts })
    }
    await t.mutation(verifyReviewAggregate, { statsId: ids.statsId, paginationOpts })
    for (const lane of lanes) {
      await t.mutation(verifyAnimeRefs, { lane, paginationOpts })
    }
    await t.run(async (ctx) => {
      await ctx.db.insert('feedCards', {
        sourceKey: `rewatched:${ids.userId}:${ids.animeId}`,
        kind: 'rewatched',
        userId: ids.userId,
        anilistId: 101,
        animeId: ids.animeId,
        visibility: 'public',
        active: true,
        orderKey: 'duplicate',
        occurredAt: 95,
        updatedAt: 100,
      })
    })
    await expect(t.mutation(backfillMilestoneSourceKeys, { paginationOpts })).rejects.toThrow('target already exists')
  })

  test('blocks stats lane without aggregate receipt and detects public Reviews missing stats', async () => {
    const t = createHarness()
    const ids = await seedLegacyGraph(t)
    await t.mutation(backfillAnimeRefs, { lane: 'reviews', paginationOpts })
    await t.mutation(backfillAnimeRefs, { lane: 'anime-review-stats', paginationOpts })
    await expect(t.mutation(verifyAnimeRefs, {
      lane: 'anime-review-stats',
      paginationOpts,
    })).resolves.toMatchObject({ aggregateMismatch: 1 })
    await t.run(async (ctx) => await ctx.db.delete('animeReviewStats', ids.statsId))
    await expect(t.mutation(verifyAnimeRefs, {
      lane: 'reviews',
      paginationOpts,
    })).resolves.toMatchObject({ aggregateMismatch: 1 })
  })

  test('persists nonterminal and terminal verification checkpoint status', async () => {
    const t = createHarness()
    const ids = await seedLegacyGraph(t)
    for (const lane of ['anime-milestones', 'reviews', 'feed-cards'] as DurableAnimeLane[]) {
      await t.mutation(backfillAnimeRefs, { lane, paginationOpts })
    }
    const first = await t.mutation(verifyAnimeRefs, {
      lane: 'feed-cards',
      paginationOpts: { numItems: 1, cursor: null },
    })
    await expect(t.run(async (ctx) => await ctx.db.query('catalogAnimeDataVerificationState')
      .withIndex('by_lane', (q) => q.eq('lane', 'feed-cards'))
      .unique())).resolves.toMatchObject({
      nextCursor: first.continueCursor,
      isDone: false,
    })
    await t.run(async (ctx) => await ctx.db.insert('feedCards', {
      sourceKey: `review:mismatched:${ids.reviewId}`,
      kind: 'review',
      userId: ids.userId,
      sourceId: ids.reviewId,
      anilistId: 101,
      animeId: ids.animeId,
      visibility: 'public',
      active: true,
      orderKey: 'mismatched',
      occurredAt: 90,
      updatedAt: 100,
    }))
    await t.mutation(verifyAnimeRefs, { lane: 'feed-cards', paginationOpts })
    await expect(t.run(async (ctx) => await ctx.db.query('catalogAnimeDataVerificationState')
      .withIndex('by_lane', (q) => q.eq('lane', 'feed-cards'))
      .unique())).resolves.toMatchObject({
      isDone: true,
      projectionMismatch: 1,
    })
  })

  test('fails with table and document evidence when provider mapping is missing', async () => {
    const t = createHarness()
    const userId = await t.run(async (ctx) => await ctx.db.insert('users', {
      authId: 'missing-map',
      username: 'missingmap',
      usernameKey: 'missingmap',
      name: 'Missing Map',
      profileVisibility: 'public',
      visibility: 'public',
      createdAt: 1,
      updatedAt: 1,
    }))
    const entryId = await t.run(async (ctx) => await ctx.db.insert('userAnimeEntries', {
      userId,
      anilistId: 999,
      status: null,
      score: null,
      favoriteAt: null,
      rewatchCount: 0,
      lastRewatchSequence: 0,
      createdAt: 1,
      updatedAt: 1,
    }))

    await expect(t.mutation(backfillAnimeRefs, {
      lane: 'user-anime-entries',
      paginationOpts,
    })).rejects.toThrow(`userAnimeEntries ${entryId} provider anilist:anime:999 has no mapping`)
  })
})
