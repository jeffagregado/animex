import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'

import { internalMutation } from './_generated/server'

const aggregateResultValidator = v.object({
  continueCursor: v.string(),
  isDone: v.boolean(),
  processedCount: v.number(),
  count: v.number(),
  ratingSum: v.number(),
  bands: v.array(v.number()),
  aggregateMismatch: v.number(),
})

const aggregateTargetResultValidator = v.object({
  page: v.array(v.id('animeReviewStats')),
  continueCursor: v.string(),
  isDone: v.boolean(),
})

const aggregateResetResultValidator = v.object({
  statsId: v.id('animeReviewStats'),
  checkpointDeleted: v.boolean(),
  receiptDeleted: v.boolean(),
})

/** Rejects duplicate verification metadata instead of hiding corruption. */
const readSingleRow = <Row>(rows: Row[], label: string): Row | null => {
  if (rows.length > 1) throw new Error(`${label} has duplicate rows; aggregate verification metadata is corrupt.`)
  return rows[0] ?? null
}

/** Compares two fixed Review rating-band snapshots. */
const bandsMatch = (left: number[], right: number[]): boolean => left.length === right.length
  && left.every((value, index) => value === right[index])

/** Lists bounded aggregate targets for authoritative per-row verification. */
export const listReviewAggregateTargets = internalMutation({
  args: { paginationOpts: paginationOptsValidator },
  returns: aggregateTargetResultValidator,
  handler: async (ctx, args) => {
    const page = await ctx.db.query('animeReviewStats').paginate(args.paginationOpts)
    return {
      page: page.page.map((aggregate) => aggregate._id),
      continueCursor: page.continueCursor,
      isDone: page.isDone,
    }
  },
})

/** Clears one aggregate verification attempt without changing domain data. */
export const resetReviewAggregateVerification = internalMutation({
  args: { statsId: v.id('animeReviewStats') },
  returns: aggregateResetResultValidator,
  handler: async (ctx, args) => {
    const [checkpointRows, receiptRows, laneReceipt] = await Promise.all([
      ctx.db.query('catalogAnimeAggregateVerificationState')
        .withIndex('by_stats_id', (q) => q.eq('statsId', args.statsId))
        .take(2),
      ctx.db.query('catalogAnimeAggregateVerificationReceipts')
        .withIndex('by_stats_id', (q) => q.eq('statsId', args.statsId))
        .take(2),
      ctx.db.query('catalogAnimeDataVerificationReceipts')
        .withIndex('by_lane', (q) => q.eq('lane', 'anime-review-stats'))
        .unique(),
    ])
    const checkpoint = readSingleRow(checkpointRows, `Aggregate checkpoint for ${args.statsId}`)
    const receipt = readSingleRow(receiptRows, `Aggregate receipt for ${args.statsId}`)
    if (checkpoint) await ctx.db.delete('catalogAnimeAggregateVerificationState', checkpoint._id)
    if (receipt) await ctx.db.delete('catalogAnimeAggregateVerificationReceipts', receipt._id)
    if (laneReceipt) await ctx.db.delete('catalogAnimeDataVerificationReceipts', laneReceipt._id)
    return {
      statsId: args.statsId,
      checkpointDeleted: checkpoint !== null,
      receiptDeleted: receipt !== null,
    }
  },
})

/** Verifies one Review aggregate through a database-owned bounded checkpoint. */
export const verifyReviewAggregate = internalMutation({
  args: {
    statsId: v.id('animeReviewStats'),
    paginationOpts: paginationOptsValidator,
  },
  returns: aggregateResultValidator,
  handler: async (ctx, args) => {
    const aggregate = await ctx.db.get('animeReviewStats', args.statsId)
    if (!aggregate?.animeId) throw new Error(`animeReviewStats ${args.statsId} is missing animeId.`)
    const [checkpointRows, receiptRows, laneReceipt] = await Promise.all([
      ctx.db.query('catalogAnimeAggregateVerificationState').withIndex('by_stats_id', (q) => q.eq('statsId', args.statsId)).take(2),
      ctx.db.query('catalogAnimeAggregateVerificationReceipts').withIndex('by_stats_id', (q) => q.eq('statsId', args.statsId)).take(2),
      ctx.db.query('catalogAnimeDataVerificationReceipts').withIndex('by_lane', (q) => q.eq('lane', 'anime-review-stats')).unique(),
    ])
    const checkpoint = readSingleRow(checkpointRows, `Aggregate checkpoint for ${args.statsId}`)
    const receipt = readSingleRow(receiptRows, `Aggregate receipt for ${args.statsId}`)
    if (args.paginationOpts.cursor === null) {
      if (checkpoint) throw new Error(`Aggregate verification checkpoint for ${args.statsId} already exists.`)
      if (receipt) await ctx.db.delete('catalogAnimeAggregateVerificationReceipts', receipt._id)
      if (laneReceipt) await ctx.db.delete('catalogAnimeDataVerificationReceipts', laneReceipt._id)
    } else if (!checkpoint || checkpoint.nextCursor !== args.paginationOpts.cursor) {
      throw new Error(`Aggregate verification cursor for ${args.statsId} does not match durable checkpoint.`)
    }
    if (checkpoint && (
      checkpoint.animeId !== aggregate.animeId
      || checkpoint.statsUpdatedAt !== aggregate.updatedAt
    )) {
      throw new Error(`animeReviewStats ${args.statsId} changed after its aggregate verification checkpoint.`)
    }
    const page = await ctx.db.query('reviews').withIndex('by_anime_entity_state_visibility_newest', (q) => q
      .eq('animeId', aggregate.animeId)
      .eq('state', 'published')
      .eq('visibility', 'public')).paginate(args.paginationOpts)
    const state = checkpoint
      ? { count: checkpoint.count, ratingSum: checkpoint.ratingSum, bands: [...checkpoint.bands] }
      : { count: 0, ratingSum: 0, bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }
    for (const review of page.page) {
      if (review.rating === null) continue
      state.count += 1
      state.ratingSum += review.rating
      const band = 9 - Math.min(9, Math.floor(review.rating / 10))
      state.bands[band] = (state.bands[band] ?? 0) + 1
    }
    const aggregateMismatch = page.isDone && (
      aggregate.count !== state.count
      || aggregate.ratingSum !== state.ratingSum
      || !bandsMatch(aggregate.bands, state.bands)
    ) ? 1 : 0
    const now = Date.now()
    if (page.isDone) {
      if (checkpoint) await ctx.db.delete('catalogAnimeAggregateVerificationState', checkpoint._id)
      if (aggregateMismatch === 0) {
        await ctx.db.insert('catalogAnimeAggregateVerificationReceipts', {
          statsId: aggregate._id,
          animeId: aggregate.animeId,
          count: aggregate.count,
          ratingSum: aggregate.ratingSum,
          bands: aggregate.bands,
          statsUpdatedAt: aggregate.updatedAt,
          verifiedAt: now,
        })
      }
    } else {
      const fields = {
        statsId: aggregate._id,
        animeId: aggregate.animeId,
        nextCursor: page.continueCursor,
        ...state,
        statsUpdatedAt: aggregate.updatedAt,
        updatedAt: now,
      }
      if (checkpoint) await ctx.db.patch('catalogAnimeAggregateVerificationState', checkpoint._id, fields)
      else await ctx.db.insert('catalogAnimeAggregateVerificationState', fields)
    }
    return {
      continueCursor: page.continueCursor,
      isDone: page.isDone,
      processedCount: page.page.length,
      ...state,
      aggregateMismatch,
    }
  },
})
