import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'

import { internalMutation } from './_generated/server'
import {
  backfillDurableAnimePage,
  clearDurableAnimeLaneReceipt,
  paginateDurableAnimeLane,
  type DurableAnimeLane,
} from './catalogAnimeDataMigrationModel'
import {
  addVerificationCounts,
  emptyVerificationCounts,
  persistProjectionRepair,
  persistVerificationAttempt,
  prepareVerificationAttempt,
  purgeProjectionPage,
  requireProjectionRepairState,
  verifyAnimePage,
} from './catalogAnimeDataVerificationModel'

const laneValidator = v.union(
  v.literal('user-anime-entries'),
  v.literal('anime-rewatches'),
  v.literal('anime-milestones'),
  v.literal('reviews'),
  v.literal('feed-cards'),
  v.literal('anime-review-stats'),
)

const backfillResultValidator = v.object({
  lane: laneValidator,
  continueCursor: v.string(),
  isDone: v.boolean(),
  processedCount: v.number(),
  patchedCount: v.number(),
})

const sourceKeyResultValidator = v.object({
  continueCursor: v.string(),
  isDone: v.boolean(),
  processedCount: v.number(),
  patchedCount: v.number(),
})

const purgeResultValidator = v.object({
  continueCursor: v.string(),
  isDone: v.boolean(),
  processedCount: v.number(),
  deletedReviewCount: v.number(),
  deletedMilestoneCount: v.number(),
})

const verificationResultValidator = v.object({
  lane: laneValidator,
  continueCursor: v.string(),
  isDone: v.boolean(),
  processedCount: v.number(),
  missingAnimeId: v.number(),
  mismatchedProviderRef: v.number(),
  duplicateUserAnime: v.number(),
  duplicateReview: v.number(),
  duplicateMilestoneSourceKey: v.number(),
  aggregateMismatch: v.number(),
  projectionMismatch: v.number(),
})

/** Backfills one durable table page, patching only absent entity references. */
export const backfillAnimeRefs = internalMutation({
  args: { lane: laneValidator, paginationOpts: paginationOptsValidator },
  returns: backfillResultValidator,
  handler: async (ctx, args) => {
    const page = await paginateDurableAnimeLane(ctx, args.lane, args.paginationOpts)
    const patchedCount = await backfillDurableAnimePage(ctx, args.lane, page.rows)
    if (patchedCount > 0) await clearDurableAnimeLaneReceipt(ctx, args.lane)
    return {
      lane: args.lane,
      continueCursor: page.continueCursor,
      isDone: page.isDone,
      processedCount: page.rows.length,
      patchedCount,
    }
  },
})

/** Replaces legacy milestone keys only after entity refs are present. */
export const backfillMilestoneSourceKeys = internalMutation({
  args: { paginationOpts: paginationOptsValidator },
  returns: sourceKeyResultValidator,
  handler: async (ctx, args) => {
    for (const lane of [
      'user-anime-entries', 'anime-rewatches', 'anime-milestones', 'reviews', 'feed-cards', 'anime-review-stats',
    ] as DurableAnimeLane[]) {
      const receipt = await ctx.db.query('catalogAnimeDataVerificationReceipts').withIndex('by_lane', (q) => q.eq('lane', lane)).unique()
      if (!receipt) throw new Error(`Milestone source-key migration requires terminal zero-issue verification receipts; missing ${lane}.`)
    }
    const page = await ctx.db.query('feedCards').paginate(args.paginationOpts)
    let patchedCount = 0
    for (const card of page.page) {
      if (card.kind !== 'completed' && card.kind !== 'rewatched') continue
      if (!card.animeId) throw new Error(`feedCards ${card._id} is missing animeId before source-key migration`)
      const target = `${card.kind}:${card.userId}:${card.animeId}`
      if (card.sourceKey === target) continue
      const duplicate = await ctx.db.query('feedCards').withIndex('by_source_key', (q) => q.eq('sourceKey', target)).take(2)
      if (duplicate.some((row) => row._id !== card._id)) {
        throw new Error(`feedCards ${card._id} cannot migrate sourceKey ${target}; target already exists`)
      }
      await ctx.db.patch(card._id, { sourceKey: target })
      patchedCount += 1
    }
    return {
      continueCursor: page.continueCursor,
      isDone: page.isDone,
      processedCount: page.page.length,
      patchedCount,
    }
  },
})

/** Deletes one bounded page of mismatched Anime-backed feed projections. */
export const purgeMismatchedFeedProjections = internalMutation({
  args: { confirm: v.literal(true), paginationOpts: paginationOptsValidator },
  returns: purgeResultValidator,
  handler: async (ctx, args) => {
    const [state, receipt] = await Promise.all([
      ctx.db.query('catalogAnimeDataVerificationState').withIndex('by_lane', (q) => q.eq('lane', 'feed-cards')).unique(),
      ctx.db.query('catalogAnimeDataVerificationReceipts').withIndex('by_lane', (q) => q.eq('lane', 'feed-cards')).unique(),
    ])
    const repairState = requireProjectionRepairState(state, receipt, args.paginationOpts.cursor)
    const page = await ctx.db.query('feedCards').paginate(args.paginationOpts)
    const counts = await purgeProjectionPage(ctx, page.page)
    await persistProjectionRepair(ctx, repairState, page.continueCursor, page.isDone)
    return {
      continueCursor: page.continueCursor,
      isDone: page.isDone,
      processedCount: page.page.length,
      ...counts,
    }
  },
})

/** Verifies provider/entity agreement and lane-specific durable uniqueness. */
export const verifyAnimeRefs = internalMutation({
  args: { lane: laneValidator, paginationOpts: paginationOptsValidator },
  returns: verificationResultValidator,
  handler: async (ctx, args) => {
    const [storedState, storedReceipt] = await Promise.all([
      ctx.db.query('catalogAnimeDataVerificationState').withIndex('by_lane', (q) => q.eq('lane', args.lane)).unique(),
      ctx.db.query('catalogAnimeDataVerificationReceipts').withIndex('by_lane', (q) => q.eq('lane', args.lane)).unique(),
    ])
    const activeState = await prepareVerificationAttempt(
      ctx,
      args.lane,
      args.paginationOpts.cursor,
      storedState,
      storedReceipt,
    )
    const page = await paginateDurableAnimeLane(ctx, args.lane, args.paginationOpts)
    const counts = await verifyAnimePage(ctx, args.lane, page.rows)
    const totals = addVerificationCounts(activeState ?? emptyVerificationCounts(), counts)
    await persistVerificationAttempt(
      ctx,
      args.lane,
      activeState,
      totals,
      page.continueCursor,
      page.isDone,
    )
    return {
      lane: args.lane,
      continueCursor: page.continueCursor,
      isDone: page.isDone,
      processedCount: page.rows.length,
      ...counts,
    }
  },
})
