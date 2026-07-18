/// <reference types="vite/client" />

import { makeFunctionReference } from 'convex/server'
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'

import type { Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import schema from './schema'

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
const listReviewAggregateTargets = makeFunctionReference<
  'mutation',
  { paginationOpts: { numItems: number; cursor: string | null } },
  { page: string[]; continueCursor: string; isDone: boolean }
>('catalogAnimeAggregateVerification:listReviewAggregateTargets')
const verifyReviewAggregate = makeFunctionReference<
  'mutation',
  { statsId: string; paginationOpts: { numItems: number; cursor: string | null } },
  AggregateResult
>('catalogAnimeAggregateVerification:verifyReviewAggregate')
const resetReviewAggregateVerification = makeFunctionReference<
  'mutation',
  { statsId: string },
  { statsId: string; checkpointDeleted: boolean; receiptDeleted: boolean }
>('catalogAnimeAggregateVerification:resetReviewAggregateVerification')
const verifyAnimeRefs = makeFunctionReference<
  'mutation',
  { lane: 'anime-review-stats'; paginationOpts: typeof paginationOpts },
  { aggregateMismatch: number }
>('catalogAnimeDataMigration:verifyAnimeRefs')

/** Inserts one Public Review for aggregate verification. */
const insertReview = async (
  ctx: MutationCtx,
  userId: Id<'users'>,
  animeId: Id<'catalogEntities'>,
  requestId: string,
  rating: number,
  updatedAt: number,
): Promise<Id<'reviews'>> => await ctx.db.insert('reviews', {
  userId,
  anilistId: 101,
  animeId,
  requestId,
  state: 'published',
  rating,
  summary: requestId,
  containsSpoiler: false,
  bodyJson: '{}',
  visibility: 'public',
  publishedAt: updatedAt,
  updatedAt,
  activityState: 'active',
  newestOrderKey: requestId,
  highRatingOrderKey: requestId,
  lowRatingOrderKey: requestId,
  searchText: requestId,
  ratingBand: rating >= 90 ? '90-100' : rating >= 80 ? '80-89' : '70-79',
})

/** Seeds one authoritative Anime, Review, and aggregate. */
const seedAggregateGraph = async (t: ReturnType<typeof createHarness>) => await t.run(async (ctx) => {
  const userId = await ctx.db.insert('users', {
    authId: 'aggregate-verification-user',
    username: 'aggregate',
    usernameKey: 'aggregate',
    name: 'Aggregate',
    profileVisibility: 'public',
    visibility: 'public',
    createdAt: 100,
    updatedAt: 100,
  })
  const animeId = await ctx.db.insert('catalogEntities', {
    kind: 'anime',
    createdAt: 100,
    updatedAt: 100,
  })
  await ctx.db.insert('catalogProviderRefs', {
    entityId: animeId,
    provider: 'anilist',
    kind: 'anime',
    providerId: 101,
    createdAt: 100,
    updatedAt: 100,
  })
  const reviewId = await insertReview(ctx, userId, animeId, 'aggregate-base', 91, 100)
  const statsId = await ctx.db.insert('animeReviewStats', {
    anilistId: 101,
    animeId,
    count: 1,
    ratingSum: 91,
    bands: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    updatedAt: 100,
  })
  return { animeId, reviewId, statsId, userId }
})

describe('catalog Anime aggregate verification', () => {
  test('enumerates every target and verifies Review aggregates across bounded pages', async () => {
    const t = createHarness()
    const ids = await seedAggregateGraph(t)
    const secondStatsId = await t.run(async (ctx) => {
      await insertReview(ctx, ids.userId, ids.animeId, 'aggregate-81', 81, 101)
      await insertReview(ctx, ids.userId, ids.animeId, 'aggregate-71', 71, 102)
      await ctx.db.patch('animeReviewStats', ids.statsId, {
        count: 3,
        ratingSum: 243,
        bands: [1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
      })
      const secondAnimeId = await ctx.db.insert('catalogEntities', {
        kind: 'anime',
        createdAt: 200,
        updatedAt: 200,
      })
      await ctx.db.insert('catalogProviderRefs', {
        entityId: secondAnimeId,
        provider: 'anilist',
        kind: 'anime',
        providerId: 202,
        createdAt: 200,
        updatedAt: 200,
      })
      return await ctx.db.insert('animeReviewStats', {
        anilistId: 202,
        animeId: secondAnimeId,
        count: 0,
        ratingSum: 0,
        bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        updatedAt: 200,
      })
    })
    const targets = await t.mutation(listReviewAggregateTargets, {
      paginationOpts: { numItems: 1, cursor: null },
    })
    expect(targets).toMatchObject({ page: [ids.statsId], isDone: false })
    await expect(t.mutation(listReviewAggregateTargets, {
      paginationOpts: { numItems: 1, cursor: targets.continueCursor },
    })).resolves.toMatchObject({ page: [secondStatsId], isDone: true })

    const first = await t.mutation(verifyReviewAggregate, {
      statsId: ids.statsId,
      paginationOpts: { numItems: 2, cursor: null },
    })
    expect(first).toMatchObject({ isDone: false, processedCount: 2, aggregateMismatch: 0 })
    await expect(t.mutation(verifyReviewAggregate, {
      statsId: ids.statsId,
      paginationOpts: { numItems: 2, cursor: 'altered' },
    })).rejects.toThrow('checkpoint')
    await expect(t.mutation(verifyReviewAggregate, {
      statsId: ids.statsId,
      paginationOpts: { numItems: 2, cursor: first.continueCursor },
    })).resolves.toMatchObject({
      isDone: true,
      count: 3,
      ratingSum: 243,
      bands: [1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
      aggregateMismatch: 0,
    })
    await expect(t.mutation(verifyAnimeRefs, {
      lane: 'anime-review-stats',
      paginationOpts,
    })).resolves.toMatchObject({ aggregateMismatch: 1 })
    await t.mutation(verifyReviewAggregate, { statsId: secondStatsId, paginationOpts })
    await expect(t.mutation(verifyAnimeRefs, {
      lane: 'anime-review-stats',
      paginationOpts,
    })).resolves.toMatchObject({ aggregateMismatch: 0 })
  })

  test('resets changed and lost checkpoints without changing Reviews or stats', async () => {
    const t = createHarness()
    const ids = await seedAggregateGraph(t)
    const changedReviewId = await t.run(async (ctx) => {
      const reviewId = await insertReview(ctx, ids.userId, ids.animeId, 'checkpoint-change', 71, 101)
      await ctx.db.patch('animeReviewStats', ids.statsId, {
        count: 2,
        ratingSum: 162,
        bands: [1, 0, 1, 0, 0, 0, 0, 0, 0, 0],
        updatedAt: 101,
      })
      return reviewId
    })
    const first = await t.mutation(verifyReviewAggregate, {
      statsId: ids.statsId,
      paginationOpts: { numItems: 1, cursor: null },
    })
    await t.run(async (ctx) => {
      await ctx.db.patch('reviews', changedReviewId, { rating: 70, updatedAt: 102 })
      await ctx.db.patch('animeReviewStats', ids.statsId, { ratingSum: 161, updatedAt: 102 })
      await ctx.db.insert('catalogAnimeDataVerificationReceipts', {
        lane: 'anime-review-stats',
        verifiedAt: 102,
      })
    })
    await expect(t.mutation(verifyReviewAggregate, {
      statsId: ids.statsId,
      paginationOpts: { numItems: 1, cursor: first.continueCursor },
    })).rejects.toThrow('changed after')
    const domainBeforeReset = await t.run(async (ctx) => ({
      review: await ctx.db.get('reviews', changedReviewId),
      stats: await ctx.db.get('animeReviewStats', ids.statsId),
    }))
    await expect(t.mutation(resetReviewAggregateVerification, {
      statsId: ids.statsId,
    })).resolves.toEqual({ statsId: ids.statsId, checkpointDeleted: true, receiptDeleted: false })
    const afterReset = await t.run(async (ctx) => ({
      review: await ctx.db.get('reviews', changedReviewId),
      stats: await ctx.db.get('animeReviewStats', ids.statsId),
      laneReceipt: await ctx.db.query('catalogAnimeDataVerificationReceipts')
        .withIndex('by_lane', (q) => q.eq('lane', 'anime-review-stats'))
        .unique(),
    }))
    expect(afterReset).toMatchObject(domainBeforeReset)
    expect(afterReset.laneReceipt).toBeNull()
    await expect(t.mutation(verifyReviewAggregate, {
      statsId: ids.statsId,
      paginationOpts,
    })).resolves.toMatchObject({ count: 2, ratingSum: 161, aggregateMismatch: 0 })

    const lostCursor = await t.mutation(verifyReviewAggregate, {
      statsId: ids.statsId,
      paginationOpts: { numItems: 1, cursor: null },
    })
    expect(lostCursor.isDone).toBe(false)
    await expect(t.mutation(resetReviewAggregateVerification, {
      statsId: ids.statsId,
    })).resolves.toMatchObject({ checkpointDeleted: true })
    await t.mutation(verifyReviewAggregate, { statsId: ids.statsId, paginationOpts })
    await expect(t.mutation(resetReviewAggregateVerification, {
      statsId: ids.statsId,
    })).resolves.toMatchObject({ checkpointDeleted: false, receiptDeleted: true })
  })

  test('rejects duplicate checkpoint metadata as explicit corruption', async () => {
    const t = createHarness()
    const ids = await seedAggregateGraph(t)
    await t.run(async (ctx) => {
      const fields = {
        statsId: ids.statsId,
        animeId: ids.animeId,
        count: 0,
        ratingSum: 0,
        bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        statsUpdatedAt: 100,
        updatedAt: 100,
      }
      await ctx.db.insert('catalogAnimeAggregateVerificationState', { ...fields, nextCursor: 'one' })
      await ctx.db.insert('catalogAnimeAggregateVerificationState', { ...fields, nextCursor: 'two' })
    })
    await expect(t.mutation(resetReviewAggregateVerification, {
      statsId: ids.statsId,
    })).rejects.toThrow('duplicate rows')
  })
})
