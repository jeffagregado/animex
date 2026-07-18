import { type PaginationOptions, paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'

import { type Doc, type Id } from './_generated/dataModel'
import { internalMutation, type MutationCtx } from './_generated/server'
import { resolveProviderRef } from './catalogIdentityModel'

const laneValidator = v.union(
  v.literal('user-anime-entries'),
  v.literal('anime-rewatches'),
  v.literal('anime-milestones'),
  v.literal('reviews'),
  v.literal('feed-cards'),
  v.literal('anime-review-stats'),
)

type DurableAnimeLane =
  | 'user-anime-entries'
  | 'anime-rewatches'
  | 'anime-milestones'
  | 'reviews'
  | 'feed-cards'
  | 'anime-review-stats'

type DurableAnimeRow =
  | Doc<'userAnimeEntries'>
  | Doc<'animeRewatchEntries'>
  | Doc<'animeMilestones'>
  | Doc<'reviews'>
  | Doc<'feedCards'>
  | Doc<'animeReviewStats'>

type DurableAnimePage = {
  continueCursor: string
  isDone: boolean
  rows: DurableAnimeRow[]
}

type VerificationCounts = {
  missingAnimeId: number
  mismatchedProviderRef: number
  duplicateUserAnime: number
  duplicateReview: number
  duplicateMilestoneSourceKey: number
  aggregateMismatch: number
  projectionMismatch: number
}

const AGGREGATE_REVIEW_VERIFY_MAX = 1_000

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

const tableName = (lane: DurableAnimeLane): string => {
  if (lane === 'user-anime-entries') return 'userAnimeEntries'
  if (lane === 'anime-rewatches') return 'animeRewatchEntries'
  if (lane === 'anime-milestones') return 'animeMilestones'
  if (lane === 'reviews') return 'reviews'
  if (lane === 'feed-cards') return 'feedCards'
  return 'animeReviewStats'
}

/** Reads exactly one bounded page from one durable Anime table. */
const paginateLane = async (
  ctx: MutationCtx,
  lane: DurableAnimeLane,
  paginationOpts: PaginationOptions,
): Promise<DurableAnimePage> => {
  if (lane === 'user-anime-entries') {
    const page = await ctx.db.query('userAnimeEntries').paginate(paginationOpts)
    return { ...page, rows: page.page }
  }
  if (lane === 'anime-rewatches') {
    const page = await ctx.db.query('animeRewatchEntries').paginate(paginationOpts)
    return { ...page, rows: page.page }
  }
  if (lane === 'anime-milestones') {
    const page = await ctx.db.query('animeMilestones').paginate(paginationOpts)
    return { ...page, rows: page.page }
  }
  if (lane === 'reviews') {
    const page = await ctx.db.query('reviews').paginate(paginationOpts)
    return { ...page, rows: page.page }
  }
  if (lane === 'feed-cards') {
    const page = await ctx.db.query('feedCards').paginate(paginationOpts)
    return { ...page, rows: page.page }
  }
  const page = await ctx.db.query('animeReviewStats').paginate(paginationOpts)
  return { ...page, rows: page.page }
}

/** Resolves existing authoritative mapping without creating identity data. */
const resolveAnimeId = async (
  ctx: MutationCtx,
  lane: DurableAnimeLane,
  row: DurableAnimeRow,
): Promise<Id<'catalogEntities'> | null> => {
  if (row.anilistId === undefined) {
    if (lane === 'feed-cards' && 'kind' in row && row.kind === 'post') return null
    throw new Error(`${tableName(lane)} ${row._id} is missing provider anilistId`)
  }
  const animeId = await resolveProviderRef(ctx, {
    provider: 'anilist',
    kind: 'anime',
    providerId: row.anilistId,
  })
  if (!animeId) {
    throw new Error(`${tableName(lane)} ${row._id} provider anilist:anime:${row.anilistId} has no mapping`)
  }
  return animeId
}

/** Returns zeroed verification counters for one page. */
const emptyCounts = (): VerificationCounts => ({
  missingAnimeId: 0,
  mismatchedProviderRef: 0,
  duplicateUserAnime: 0,
  duplicateReview: 0,
  duplicateMilestoneSourceKey: 0,
  aggregateMismatch: 0,
  projectionMismatch: 0,
})

/** Compares one Review aggregate with entity-indexed public Review truth. */
const aggregateMatches = async (
  ctx: MutationCtx,
  aggregate: Doc<'animeReviewStats'>,
): Promise<boolean> => {
  if (!aggregate.animeId) return false
  const reviews = await ctx.db.query('reviews').withIndex('by_anime_entity_state_visibility_newest', (q) => q
    .eq('animeId', aggregate.animeId)
    .eq('state', 'published')
    .eq('visibility', 'public')).take(AGGREGATE_REVIEW_VERIFY_MAX + 1)
  if (reviews.length > AGGREGATE_REVIEW_VERIFY_MAX) {
    throw new Error(`animeReviewStats ${aggregate._id} verification exceeds ${AGGREGATE_REVIEW_VERIFY_MAX} public Reviews`)
  }
  const ratings = reviews.flatMap((review) => review.rating === null ? [] : [review.rating])
  const bands = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  for (const rating of ratings) {
    const band = 9 - Math.min(9, Math.floor(rating / 10))
    bands[band] = (bands[band] ?? 0) + 1
  }
  return aggregate.count === ratings.length
    && aggregate.ratingSum === ratings.reduce((sum, rating) => sum + rating, 0)
    && aggregate.bands.length === bands.length
    && aggregate.bands.every((value, index) => value === bands[index])
}

/** Compares one Anime-backed feed card with its authoritative source. */
const projectionMatches = async (
  ctx: MutationCtx,
  card: Doc<'feedCards'>,
): Promise<boolean> => {
  if (card.kind === 'post') return true
  if (!card.animeId || card.anilistId === undefined) return false
  if (card.kind === 'review') {
    const reviewId = card.sourceId ? ctx.db.normalizeId('reviews', card.sourceId) : null
    const review = reviewId ? await ctx.db.get('reviews', reviewId) : null
    if (!review) return false
    return card.sourceKey === `review:${review._id}`
      && card.userId === review.userId
      && card.anilistId === review.anilistId
      && card.animeId === review.animeId
      && card.visibility === review.visibility
      && card.active === (review.state === 'published' && review.activityState === 'active')
      && card.occurredAt === review.publishedAt
      && card.updatedAt === review.updatedAt
  }
  if (card.kind !== 'completed' && card.kind !== 'rewatched') return false
  const kind = card.kind
  const milestone = await ctx.db.query('animeMilestones').withIndex('by_user_anime_entity_kind', (q) => q
    .eq('userId', card.userId)
    .eq('animeId', card.animeId)
    .eq('kind', kind)).unique()
  if (!milestone) return false
  const entityKey = `${card.kind}:${card.userId}:${card.animeId}`
  const legacyKey = `${card.kind}:${card.userId}:${card.anilistId}`
  return (card.sourceKey === entityKey || card.sourceKey === legacyKey)
    && card.anilistId === milestone.anilistId
    && card.visibility === milestone.visibility
    && card.occurredAt === milestone.occurredAt
    && card.updatedAt === milestone.updatedAt
}

/** Backfills one durable table page, patching only absent entity references. */
export const backfillAnimeRefs = internalMutation({
  args: { lane: laneValidator, paginationOpts: paginationOptsValidator },
  returns: backfillResultValidator,
  handler: async (ctx, args) => {
    const page = await paginateLane(ctx, args.lane, args.paginationOpts)
    let patchedCount = 0
    for (const row of page.rows) {
      const animeId = await resolveAnimeId(ctx, args.lane, row)
      if (!animeId) continue
      if (row.animeId && row.animeId !== animeId) {
        throw new Error(`${tableName(args.lane)} ${row._id} entity ${row.animeId} conflicts with provider mapping ${animeId}`)
      }
      if (!row.animeId) {
        await ctx.db.patch(row._id, { animeId })
        patchedCount += 1
      }
    }
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

/** Verifies provider/entity agreement and lane-specific durable uniqueness. */
export const verifyAnimeRefs = internalMutation({
  args: { lane: laneValidator, paginationOpts: paginationOptsValidator },
  returns: verificationResultValidator,
  handler: async (ctx, args) => {
    const page = await paginateLane(ctx, args.lane, args.paginationOpts)
    const counts = emptyCounts()
    for (const row of page.rows) {
      const expected = await resolveAnimeId(ctx, args.lane, row)
      if (!expected) continue
      if (!row.animeId) {
        counts.missingAnimeId += 1
        continue
      }
      if (row.animeId !== expected) counts.mismatchedProviderRef += 1
      if (args.lane === 'user-anime-entries' && 'userId' in row) {
        const matches = await ctx.db.query('userAnimeEntries').withIndex('by_user_anime_entity', (q) => q.eq('userId', row.userId).eq('animeId', row.animeId)).take(2)
        if (matches.length > 1) counts.duplicateUserAnime += 1
      }
      if (args.lane === 'reviews' && 'userId' in row) {
        const matches = await ctx.db.query('reviews').withIndex('by_user_anime_entity', (q) => q.eq('userId', row.userId).eq('animeId', row.animeId)).take(2)
        if (matches.length > 1) counts.duplicateReview += 1
      }
      if (args.lane === 'feed-cards' && 'kind' in row && 'userId' in row && (row.kind === 'completed' || row.kind === 'rewatched')) {
        const target = `${row.kind}:${row.userId}:${row.animeId}`
        const matches = await ctx.db.query('feedCards').withIndex('by_source_key', (q) => q.eq('sourceKey', target)).take(2)
        if (matches.length > 1) counts.duplicateMilestoneSourceKey += 1
      }
      if (args.lane === 'feed-cards' && 'sourceKey' in row && !await projectionMatches(ctx, row)) {
        counts.projectionMismatch += 1
      }
      if (args.lane === 'anime-review-stats' && 'bands' in row && !await aggregateMatches(ctx, row)) {
        counts.aggregateMismatch += 1
      }
    }
    return {
      lane: args.lane,
      continueCursor: page.continueCursor,
      isDone: page.isDone,
      processedCount: page.rows.length,
      ...counts,
    }
  },
})
