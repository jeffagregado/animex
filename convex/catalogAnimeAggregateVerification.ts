import { type PaginationOptions, paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'

import type { Doc, Id } from './_generated/dataModel'
import { internalMutation, type MutationCtx } from './_generated/server'

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

type AggregateState = {
  bands: number[]
  count: number
  ratingSum: number
}

type AggregateMetadata = {
  checkpoint: Doc<'catalogAnimeAggregateVerificationState'> | null
  laneReceipt: Doc<'catalogAnimeDataVerificationReceipts'> | null
  receipt: Doc<'catalogAnimeAggregateVerificationReceipts'> | null
}

type AggregateWithIdentity = Doc<'animeReviewStats'> & {
  animeId: Id<'catalogEntities'>
}

/** Requires one Review aggregate to have its durable Anime identity. */
const requireAggregateIdentity = (
  aggregate: Doc<'animeReviewStats'> | null,
  statsId: Id<'animeReviewStats'>,
): AggregateWithIdentity => {
  if (!aggregate?.animeId) throw new Error(`animeReviewStats ${statsId} is missing animeId.`)
  return { ...aggregate, animeId: aggregate.animeId }
}

/** Reads one aggregate's checkpoint and receipts together. */
const readAggregateMetadata = async (
  ctx: MutationCtx,
  statsId: Id<'animeReviewStats'>,
): Promise<AggregateMetadata> => {
  const [checkpointRows, receiptRows, laneReceipt] = await Promise.all([
    ctx.db.query('catalogAnimeAggregateVerificationState')
      .withIndex('by_stats_id', (q) => q.eq('statsId', statsId))
      .take(2),
    ctx.db.query('catalogAnimeAggregateVerificationReceipts')
      .withIndex('by_stats_id', (q) => q.eq('statsId', statsId))
      .take(2),
    ctx.db.query('catalogAnimeDataVerificationReceipts')
      .withIndex('by_lane', (q) => q.eq('lane', 'anime-review-stats'))
      .unique(),
  ])
  return {
    checkpoint: readSingleRow(checkpointRows, `Aggregate checkpoint for ${statsId}`),
    receipt: readSingleRow(receiptRows, `Aggregate receipt for ${statsId}`),
    laneReceipt,
  }
}

/** Clears stale receipts before one fresh aggregate verification. */
const prepareFreshAggregateVerification = async (
  ctx: MutationCtx,
  metadata: AggregateMetadata,
  statsId: Id<'animeReviewStats'>,
): Promise<Doc<'catalogAnimeAggregateVerificationState'> | null> => {
  const { checkpoint, receipt, laneReceipt } = metadata
  if (checkpoint) throw new Error(`Aggregate verification checkpoint for ${statsId} already exists.`)
  if (receipt) await ctx.db.delete('catalogAnimeAggregateVerificationReceipts', receipt._id)
  if (laneReceipt) await ctx.db.delete('catalogAnimeDataVerificationReceipts', laneReceipt._id)
  return null
}

/** Requires one continuation cursor to match its durable checkpoint. */
const requireAggregateCheckpoint = (
  checkpoint: Doc<'catalogAnimeAggregateVerificationState'> | null,
  cursor: string,
  statsId: Id<'animeReviewStats'>,
): Doc<'catalogAnimeAggregateVerificationState'> => {
  if (!checkpoint || checkpoint.nextCursor !== cursor) {
    throw new Error(`Aggregate verification cursor for ${statsId} does not match durable checkpoint.`)
  }
  return checkpoint
}

/** Rejects an aggregate changed after checkpoint creation. */
const assertAggregateCheckpointCurrent = (
  checkpoint: Doc<'catalogAnimeAggregateVerificationState'> | null,
  aggregate: AggregateWithIdentity,
): void => {
  if (checkpoint && (
    checkpoint.animeId !== aggregate.animeId
    || checkpoint.statsUpdatedAt !== aggregate.updatedAt
  )) {
    throw new Error(`animeReviewStats ${aggregate._id} changed after its aggregate verification checkpoint.`)
  }
}

/** Validates cursor ownership and clears receipts for a fresh verification. */
const prepareAggregateVerification = async (
  ctx: MutationCtx,
  aggregate: AggregateWithIdentity,
  paginationOpts: PaginationOptions,
  metadata: AggregateMetadata,
): Promise<Doc<'catalogAnimeAggregateVerificationState'> | null> => {
  const checkpoint = paginationOpts.cursor === null
    ? await prepareFreshAggregateVerification(ctx, metadata, aggregate._id)
    : requireAggregateCheckpoint(metadata.checkpoint, paginationOpts.cursor, aggregate._id)
  assertAggregateCheckpointCurrent(checkpoint, aggregate)
  return checkpoint
}

/** Adds one bounded Review page to its aggregate verification state. */
const accumulateReviewPage = (
  initial: AggregateState,
  reviews: Doc<'reviews'>[],
): AggregateState => {
  const state = { ...initial, bands: [...initial.bands] }
  for (const review of reviews) {
    if (review.rating === null) continue
    state.count += 1
    state.ratingSum += review.rating
    const band = 9 - Math.min(9, Math.floor(review.rating / 10))
    state.bands[band] = (state.bands[band] ?? 0) + 1
  }
  return state
}

/** Detects terminal aggregate drift. */
const hasAggregateMismatch = (
  aggregate: Doc<'animeReviewStats'>,
  state: AggregateState,
  isDone: boolean,
): boolean => isDone && ![
  aggregate.count === state.count,
  aggregate.ratingSum === state.ratingSum,
  bandsMatch(aggregate.bands, state.bands),
].every(Boolean)

/** Stores one terminal receipt or the next durable checkpoint. */
const persistAggregateVerification = async (
  ctx: MutationCtx,
  aggregate: AggregateWithIdentity,
  checkpoint: Doc<'catalogAnimeAggregateVerificationState'> | null,
  state: AggregateState,
  continueCursor: string,
  isDone: boolean,
  aggregateMismatch: number,
): Promise<void> => {
  const now = Date.now()
  if (isDone) {
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
    return
  }
  const fields = {
    statsId: aggregate._id,
    animeId: aggregate.animeId,
    nextCursor: continueCursor,
    ...state,
    statsUpdatedAt: aggregate.updatedAt,
    updatedAt: now,
  }
  if (checkpoint) await ctx.db.patch('catalogAnimeAggregateVerificationState', checkpoint._id, fields)
  else await ctx.db.insert('catalogAnimeAggregateVerificationState', fields)
}

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
    const aggregate = requireAggregateIdentity(
      await ctx.db.get('animeReviewStats', args.statsId),
      args.statsId,
    )
    const metadata = await readAggregateMetadata(ctx, args.statsId)
    const checkpoint = await prepareAggregateVerification(ctx, aggregate, args.paginationOpts, metadata)
    const page = await ctx.db.query('reviews').withIndex('by_anime_entity_state_visibility_newest', (q) => q
      .eq('animeId', aggregate.animeId)
      .eq('state', 'published')
      .eq('visibility', 'public')).paginate(args.paginationOpts)
    const initialState = checkpoint
      ? { count: checkpoint.count, ratingSum: checkpoint.ratingSum, bands: [...checkpoint.bands] }
      : { count: 0, ratingSum: 0, bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }
    const state = accumulateReviewPage(initialState, page.page)
    const aggregateMismatch = hasAggregateMismatch(aggregate, state, page.isDone) ? 1 : 0
    await persistAggregateVerification(
      ctx,
      aggregate,
      checkpoint,
      state,
      page.continueCursor,
      page.isDone,
      aggregateMismatch,
    )
    return {
      continueCursor: page.continueCursor,
      isDone: page.isDone,
      processedCount: page.page.length,
      ...state,
      aggregateMismatch,
    }
  },
})
