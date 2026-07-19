/// <reference types="vite/client" />

import { makeFunctionReference } from 'convex/server'
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'

import schema from './schema'

type PurgeResult = {
  continueCursor: string
  isDone: boolean
  processedCount: number
  deletedReviewCount: number
  deletedMilestoneCount: number
}

type StateOverrides = Partial<{
  isDone: boolean
  repairCursor: string
  missingAnimeId: number
  mismatchedProviderRef: number
  duplicateUserAnime: number
  duplicateReview: number
  duplicateMilestoneSourceKey: number
  aggregateMismatch: number
  projectionMismatch: number
}>

const modules = import.meta.glob([
  './_generated/**/*.*',
  './catalogAnimeDataMigration.ts',
])
const createHarness = () => convexTest(schema, modules)
const purgeMismatchedFeedProjections = makeFunctionReference<
  'mutation',
  { confirm: boolean; paginationOpts: { numItems: number; cursor: string | null } },
  PurgeResult
>('catalogAnimeDataMigration:purgeMismatchedFeedProjections')

/** Seeds matching projections plus one mismatch for every repairable kind. */
const seedFeedGraph = async (t: ReturnType<typeof createHarness>) => await t.run(async (ctx) => {
  const userId = await ctx.db.insert('users', {
    authId: 'feed-repair-user',
    username: 'feedrepair',
    usernameKey: 'feedrepair',
    name: 'Feed Repair',
    profileVisibility: 'public',
    visibility: 'public',
    createdAt: 80,
    updatedAt: 100,
  })
  const animeId = await ctx.db.insert('catalogEntities', {
    kind: 'anime',
    createdAt: 80,
    updatedAt: 100,
  })
  const reviewId = await ctx.db.insert('reviews', {
    userId,
    anilistId: 101,
    animeId,
    requestId: 'feed-repair-review',
    state: 'published',
    rating: 91,
    summary: 'Preserve authoritative Review.',
    containsSpoiler: false,
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
  const milestoneId = await ctx.db.insert('animeMilestones', {
    userId,
    anilistId: 101,
    animeId,
    kind: 'rewatched',
    visibility: 'public',
    occurredAt: 95,
    updatedAt: 100,
  })
  const matchingReviewId = await ctx.db.insert('feedCards', {
    sourceKey: `review:${reviewId}`,
    kind: 'review',
    userId,
    sourceId: reviewId,
    anilistId: 101,
    animeId,
    visibility: 'public',
    active: true,
    orderKey: 'matching-review',
    occurredAt: 90,
    updatedAt: 100,
  })
  const matchingMilestoneId = await ctx.db.insert('feedCards', {
    sourceKey: `rewatched:${userId}:${animeId}`,
    kind: 'rewatched',
    userId,
    anilistId: 101,
    animeId,
    visibility: 'public',
    active: true,
    orderKey: 'matching-milestone',
    occurredAt: 95,
    updatedAt: 100,
  })
  const mismatchedReviewId = await ctx.db.insert('feedCards', {
    sourceKey: `review:mismatched:${reviewId}`,
    kind: 'review',
    userId,
    sourceId: reviewId,
    anilistId: 101,
    animeId,
    visibility: 'public',
    active: true,
    orderKey: 'mismatched-review',
    occurredAt: 90,
    updatedAt: 100,
  })
  const mismatchedRewatchedId = await ctx.db.insert('feedCards', {
    sourceKey: `rewatched:${userId}:${animeId}:mismatched`,
    kind: 'rewatched',
    userId,
    anilistId: 101,
    animeId,
    visibility: 'private',
    active: true,
    orderKey: 'mismatched-rewatched',
    occurredAt: 95,
    updatedAt: 100,
  })
  const mismatchedCompletedId = await ctx.db.insert('feedCards', {
    sourceKey: `completed:${userId}:${animeId}:mismatched`,
    kind: 'completed',
    userId,
    anilistId: 101,
    animeId,
    visibility: 'public',
    active: true,
    orderKey: 'mismatched-completed',
    occurredAt: 94,
    updatedAt: 100,
  })
  const postId = await ctx.db.insert('feedCards', {
    sourceKey: 'post:preserved',
    kind: 'post',
    userId,
    sourceId: 'post-source',
    visibility: 'public',
    active: true,
    orderKey: 'post-order',
    occurredAt: 100,
    updatedAt: 100,
  })
  return {
    reviewId,
    milestoneId,
    matchingReviewId,
    matchingMilestoneId,
    mismatchedReviewId,
    mismatchedRewatchedId,
    mismatchedCompletedId,
    postId,
  }
})

/** Inserts completed feed verification evidence with explicit overrides. */
const insertFeedState = async (
  t: ReturnType<typeof createHarness>,
  overrides: StateOverrides,
) => await t.run(async (ctx) => await ctx.db.insert('catalogAnimeDataVerificationState', {
  lane: 'feed-cards',
  nextCursor: 'verification-terminal',
  isDone: true,
  missingAnimeId: 0,
  mismatchedProviderRef: 0,
  duplicateUserAnime: 0,
  duplicateReview: 0,
  duplicateMilestoneSourceKey: 0,
  aggregateMismatch: 0,
  projectionMismatch: 3,
  updatedAt: 100,
  ...overrides,
}))

const purgeOne = async (
  t: ReturnType<typeof createHarness>,
  cursor: string | null,
) => await t.mutation(purgeMismatchedFeedProjections, {
  confirm: true,
  paginationOpts: { numItems: 1, cursor },
})

describe('catalog Anime feed projection repair', () => {
  test('rejects repair before feed verification state exists', async () => {
    const t = createHarness()
    await seedFeedGraph(t)
    await expect(purgeOne(t, null)).rejects.toThrow('verification state')
  })

  test('rejects nonterminal verification and corrupt receipt evidence', async () => {
    const nonterminal = createHarness()
    await seedFeedGraph(nonterminal)
    await insertFeedState(nonterminal, { isDone: false })
    await expect(purgeOne(nonterminal, null)).rejects.toThrow('terminal')

    const corrupt = createHarness()
    await seedFeedGraph(corrupt)
    await insertFeedState(corrupt, {})
    await corrupt.run(async (ctx) => await ctx.db.insert('catalogAnimeDataVerificationReceipts', {
      lane: 'feed-cards',
      verifiedAt: 100,
    }))
    await expect(purgeOne(corrupt, null)).rejects.toThrow('receipt')
  })

  test('rejects unsafe verification counters', async () => {
    const cases: StateOverrides[] = [
      { missingAnimeId: 1 },
      { mismatchedProviderRef: 1 },
      { duplicateUserAnime: 1 },
      { duplicateReview: 1 },
      { duplicateMilestoneSourceKey: 1 },
      { aggregateMismatch: 1 },
      { projectionMismatch: 0 },
    ]
    for (const unsafe of cases) {
      const t = createHarness()
      await seedFeedGraph(t)
      await insertFeedState(t, unsafe)
      await expect(purgeOne(t, null)).rejects.toThrow('projection-only')
    }
  })

  test('rejects direct continuation without stored repair cursor', async () => {
    const t = createHarness()
    await seedFeedGraph(t)
    await insertFeedState(t, {})
    await expect(purgeOne(t, 'bogus-cursor')).rejects.toThrow('cursor')
  })

  test('repairs exact one-row pages and consumes verification evidence', async () => {
    const t = createHarness()
    const ids = await seedFeedGraph(t)
    await insertFeedState(t, {})
    await expect(t.mutation(purgeMismatchedFeedProjections, {
      confirm: false,
      paginationOpts: { numItems: 1, cursor: null },
    })).rejects.toThrow()

    let cursor: string | null = null
    let isDone = false
    const totals = { processedCount: 0, deletedReviewCount: 0, deletedMilestoneCount: 0 }
    while (!isDone) {
      const result: PurgeResult = await purgeOne(t, cursor)
      expect(result.processedCount).toBe(1)
      totals.processedCount += result.processedCount
      totals.deletedReviewCount += result.deletedReviewCount
      totals.deletedMilestoneCount += result.deletedMilestoneCount
      cursor = result.continueCursor
      isDone = result.isDone
      const state = await t.run(async (ctx) => await ctx.db.query('catalogAnimeDataVerificationState')
        .withIndex('by_lane', (q) => q.eq('lane', 'feed-cards'))
        .unique())
      if (isDone) expect(state).toBeNull()
      else expect(state?.repairCursor).toBe(cursor)
    }
    expect(totals).toEqual({
      processedCount: 6,
      deletedReviewCount: 1,
      deletedMilestoneCount: 2,
    })
    const after = await t.run(async (ctx) => ({
      mismatchedReview: await ctx.db.get('feedCards', ids.mismatchedReviewId),
      mismatchedRewatched: await ctx.db.get('feedCards', ids.mismatchedRewatchedId),
      mismatchedCompleted: await ctx.db.get('feedCards', ids.mismatchedCompletedId),
      matchingReview: await ctx.db.get('feedCards', ids.matchingReviewId),
      matchingMilestone: await ctx.db.get('feedCards', ids.matchingMilestoneId),
      post: await ctx.db.get('feedCards', ids.postId),
      review: await ctx.db.get('reviews', ids.reviewId),
      milestone: await ctx.db.get('animeMilestones', ids.milestoneId),
    }))
    expect(after).toMatchObject({
      mismatchedReview: null,
      mismatchedRewatched: null,
      mismatchedCompleted: null,
      matchingReview: { _id: ids.matchingReviewId },
      matchingMilestone: { _id: ids.matchingMilestoneId },
      post: { _id: ids.postId },
      review: { _id: ids.reviewId },
      milestone: { _id: ids.milestoneId },
    })
    await expect(purgeOne(t, null)).rejects.toThrow('verification state')
  })
})
