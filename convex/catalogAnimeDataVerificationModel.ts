import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import {
  resolveDurableAnimeId,
  type DurableAnimeLane,
  type DurableAnimeRow,
} from './catalogAnimeDataMigrationModel'

export type VerificationCounts = {
  missingAnimeId: number
  mismatchedProviderRef: number
  duplicateUserAnime: number
  duplicateReview: number
  duplicateMilestoneSourceKey: number
  aggregateMismatch: number
  projectionMismatch: number
}

/** Returns zeroed verification counters for one page. */
export const emptyVerificationCounts = (): VerificationCounts => ({
  missingAnimeId: 0,
  mismatchedProviderRef: 0,
  duplicateUserAnime: 0,
  duplicateReview: 0,
  duplicateMilestoneSourceKey: 0,
  aggregateMismatch: 0,
  projectionMismatch: 0,
})

/** Compares two fixed Review rating-band snapshots. */
const bandsMatch = (left: number[], right: number[]): boolean => left.length === right.length
  && left.every((value, index) => value === right[index])

/** Checks that one public Review has exactly one matching aggregate row. */
const reviewAggregateMatches = async (
  ctx: MutationCtx,
  review: Doc<'reviews'>,
): Promise<boolean> => {
  if (!review.animeId || review.state !== 'published' || review.visibility !== 'public') return true
  const matches = await ctx.db.query('animeReviewStats')
    .withIndex('by_anime_entity', (q) => q.eq('animeId', review.animeId))
    .take(2)
  return matches.length === 1 && matches[0]?.anilistId === review.anilistId
}

/** Checks that one aggregate has a current authoritative verification receipt. */
const aggregateReceiptMatches = async (
  ctx: MutationCtx,
  aggregate: Doc<'animeReviewStats'>,
): Promise<boolean> => {
  if (!aggregate.animeId) return false
  const receipt = await ctx.db.query('catalogAnimeAggregateVerificationReceipts')
    .withIndex('by_stats_id', (q) => q.eq('statsId', aggregate._id))
    .unique()
  return receipt !== null
    && receipt.animeId === aggregate.animeId
    && receipt.count === aggregate.count
    && receipt.ratingSum === aggregate.ratingSum
    && bandsMatch(receipt.bands, aggregate.bands)
    && receipt.statsUpdatedAt === aggregate.updatedAt
}

/** Compares one Review feed card with its authoritative source. */
const reviewProjectionMatches = async (
  ctx: MutationCtx,
  card: Doc<'feedCards'>,
): Promise<boolean> => {
  if (!card.animeId || card.anilistId === undefined) return false
  const reviewId = card.sourceId ? ctx.db.normalizeId('reviews', card.sourceId) : null
  const review = reviewId ? await ctx.db.get('reviews', reviewId) : null
  if (!review) return false
  return [
    card.sourceKey === `review:${review._id}`,
    card.userId === review.userId,
    card.anilistId === review.anilistId,
    card.animeId === review.animeId,
    card.visibility === review.visibility,
    card.active === (review.state === 'published' && review.activityState === 'active'),
    card.occurredAt === review.publishedAt,
    card.updatedAt === review.updatedAt,
  ].every(Boolean)
}

/** Compares one milestone feed card with its authoritative source. */
const milestoneProjectionMatches = async (
  ctx: MutationCtx,
  card: Doc<'feedCards'>,
): Promise<boolean> => {
  if (!card.animeId || card.anilistId === undefined) return false
  if (card.kind !== 'completed' && card.kind !== 'rewatched') return false
  const kind = card.kind
  const milestone = await ctx.db.query('animeMilestones')
    .withIndex('by_user_anime_entity_kind', (q) => q
      .eq('userId', card.userId)
      .eq('animeId', card.animeId)
      .eq('kind', kind))
    .unique()
  if (!milestone) return false
  const entityKey = `${card.kind}:${card.userId}:${card.animeId}`
  const legacyKey = `${card.kind}:${card.userId}:${card.anilistId}`
  return [
    [entityKey, legacyKey].includes(card.sourceKey),
    card.anilistId === milestone.anilistId,
    card.visibility === milestone.visibility,
    card.occurredAt === milestone.occurredAt,
    card.updatedAt === milestone.updatedAt,
  ].every(Boolean)
}

/** Compares one Anime-backed feed card with its authoritative source. */
const projectionMatches = async (
  ctx: MutationCtx,
  card: Doc<'feedCards'>,
): Promise<boolean> => {
  if (card.kind === 'post') return true
  if (card.kind === 'review') return await reviewProjectionMatches(ctx, card)
  return await milestoneProjectionMatches(ctx, card)
}

/** Checks whether a feed verification state contains repairable projection drift only. */
const hasProjectionOnlyIssues = (
  state: Doc<'catalogAnimeDataVerificationState'>,
): boolean => [
  state.missingAnimeId === 0,
  state.mismatchedProviderRef === 0,
  state.duplicateUserAnime === 0,
  state.duplicateReview === 0,
  state.duplicateMilestoneSourceKey === 0,
  state.aggregateMismatch === 0,
  state.projectionMismatch > 0,
].every(Boolean)

/** Requires a terminal projection-only state and its exact repair cursor. */
export const requireProjectionRepairState = (
  state: Doc<'catalogAnimeDataVerificationState'> | null,
  receipt: Doc<'catalogAnimeDataVerificationReceipts'> | null,
  cursor: string | null,
): Doc<'catalogAnimeDataVerificationState'> => {
  if (!state) throw new Error('Feed projection repair requires completed feed-cards verification state.')
  if (receipt) throw new Error('Feed projection repair found corrupt feed-cards verification receipt alongside repair state.')
  if (!state.isDone) throw new Error('Feed projection repair requires terminal feed-cards verification state.')
  if (!hasProjectionOnlyIssues(state)) {
    throw new Error('Feed projection repair requires projection-only verification issues.')
  }
  if (cursor === null && state.repairCursor !== undefined) {
    throw new Error('Feed projection repair cursor exists; continue with its exact value.')
  }
  if (cursor !== null && state.repairCursor !== cursor) {
    throw new Error('Feed projection repair cursor does not match durable state.')
  }
  return state
}

export type ProjectionPurgeCounts = {
  deletedMilestoneCount: number
  deletedReviewCount: number
}

/** Deletes mismatched Anime-backed projections from one bounded page. */
export const purgeProjectionPage = async (
  ctx: MutationCtx,
  cards: Doc<'feedCards'>[],
): Promise<ProjectionPurgeCounts> => {
  let deletedReviewCount = 0
  let deletedMilestoneCount = 0
  for (const card of cards) {
    if (card.kind === 'post') continue
    if (await projectionMatches(ctx, card)) continue
    await ctx.db.delete('feedCards', card._id)
    if (card.kind === 'review') deletedReviewCount += 1
    else deletedMilestoneCount += 1
  }
  return { deletedReviewCount, deletedMilestoneCount }
}

/** Advances or removes the durable feed repair cursor. */
export const persistProjectionRepair = async (
  ctx: MutationCtx,
  state: Doc<'catalogAnimeDataVerificationState'>,
  continueCursor: string,
  isDone: boolean,
): Promise<void> => {
  if (isDone) {
    await ctx.db.delete('catalogAnimeDataVerificationState', state._id)
    return
  }
  await ctx.db.patch('catalogAnimeDataVerificationState', state._id, {
    repairCursor: continueCursor,
  })
}

/** Starts a fresh verification or validates its durable continuation cursor. */
export const prepareVerificationAttempt = async (
  ctx: MutationCtx,
  lane: DurableAnimeLane,
  cursor: string | null,
  storedState: Doc<'catalogAnimeDataVerificationState'> | null,
  storedReceipt: Doc<'catalogAnimeDataVerificationReceipts'> | null,
): Promise<Doc<'catalogAnimeDataVerificationState'> | null> => {
  if (cursor === null) {
    if (storedState) await ctx.db.delete('catalogAnimeDataVerificationState', storedState._id)
    if (storedReceipt) await ctx.db.delete('catalogAnimeDataVerificationReceipts', storedReceipt._id)
    return null
  }
  if (!storedState || storedState.nextCursor !== cursor) {
    throw new Error(`Verification cursor for ${lane} does not match durable checkpoint.`)
  }
  return storedState
}

/** Counts duplicate user Anime entity keys. */
const verifyUserAnimeRow = async (
  ctx: MutationCtx,
  row: Doc<'userAnimeEntries'> & { animeId: Id<'catalogEntities'> },
  counts: VerificationCounts,
): Promise<void> => {
  const matches = await ctx.db.query('userAnimeEntries')
    .withIndex('by_user_anime_entity', (q) => q.eq('userId', row.userId).eq('animeId', row.animeId))
    .take(2)
  if (matches.length > 1) counts.duplicateUserAnime += 1
}

/** Counts duplicate Review keys and aggregate drift. */
const verifyReviewRow = async (
  ctx: MutationCtx,
  row: Doc<'reviews'> & { animeId: Id<'catalogEntities'> },
  counts: VerificationCounts,
): Promise<void> => {
  const matches = await ctx.db.query('reviews')
    .withIndex('by_user_anime_entity', (q) => q.eq('userId', row.userId).eq('animeId', row.animeId))
    .take(2)
  if (matches.length > 1) counts.duplicateReview += 1
  if (!await reviewAggregateMatches(ctx, row)) counts.aggregateMismatch += 1
}

/** Counts stale aggregate verification receipts. */
const verifyAggregateRow = async (
  ctx: MutationCtx,
  row: Doc<'animeReviewStats'> & { animeId: Id<'catalogEntities'> },
  counts: VerificationCounts,
): Promise<void> => {
  if (!await aggregateReceiptMatches(ctx, row)) counts.aggregateMismatch += 1
}

/** Counts duplicate milestone keys and stale feed projections. */
const verifyFeedRow = async (
  ctx: MutationCtx,
  row: Doc<'feedCards'> & { animeId: Id<'catalogEntities'> },
  counts: VerificationCounts,
): Promise<void> => {
  if (row.kind === 'completed' || row.kind === 'rewatched') {
    const target = `${row.kind}:${row.userId}:${row.animeId}`
    const matches = await ctx.db.query('feedCards')
      .withIndex('by_source_key', (q) => q.eq('sourceKey', target))
      .take(2)
    if (matches.length > 1) counts.duplicateMilestoneSourceKey += 1
  }
  if (!await projectionMatches(ctx, row)) counts.projectionMismatch += 1
}

/** Verifies one durable row after provider identity resolution. */
const verifyAnimeRow = async (
  ctx: MutationCtx,
  lane: DurableAnimeLane,
  row: DurableAnimeRow,
  counts: VerificationCounts,
): Promise<void> => {
  const expected = await resolveDurableAnimeId(ctx, lane, row)
  if (!expected) return
  if (!row.animeId) {
    counts.missingAnimeId += 1
    return
  }
  if (row.animeId !== expected) counts.mismatchedProviderRef += 1
  if (lane === 'user-anime-entries') {
    await verifyUserAnimeRow(ctx, row as Doc<'userAnimeEntries'> & { animeId: Id<'catalogEntities'> }, counts)
  }
  if (lane === 'reviews') {
    await verifyReviewRow(ctx, row as Doc<'reviews'> & { animeId: Id<'catalogEntities'> }, counts)
  }
  if (lane === 'anime-review-stats') {
    await verifyAggregateRow(ctx, row as Doc<'animeReviewStats'> & { animeId: Id<'catalogEntities'> }, counts)
  }
  if (lane === 'feed-cards') {
    await verifyFeedRow(ctx, row as Doc<'feedCards'> & { animeId: Id<'catalogEntities'> }, counts)
  }
}

/** Verifies one bounded durable page. */
export const verifyAnimePage = async (
  ctx: MutationCtx,
  lane: DurableAnimeLane,
  rows: DurableAnimeRow[],
): Promise<VerificationCounts> => {
  const counts = emptyVerificationCounts()
  for (const row of rows) await verifyAnimeRow(ctx, lane, row, counts)
  return counts
}

/** Adds current page counters to the durable checkpoint totals. */
export const addVerificationCounts = (
  previous: VerificationCounts,
  current: VerificationCounts,
): VerificationCounts => ({
  missingAnimeId: previous.missingAnimeId + current.missingAnimeId,
  mismatchedProviderRef: previous.mismatchedProviderRef + current.mismatchedProviderRef,
  duplicateUserAnime: previous.duplicateUserAnime + current.duplicateUserAnime,
  duplicateReview: previous.duplicateReview + current.duplicateReview,
  duplicateMilestoneSourceKey: previous.duplicateMilestoneSourceKey + current.duplicateMilestoneSourceKey,
  aggregateMismatch: previous.aggregateMismatch + current.aggregateMismatch,
  projectionMismatch: previous.projectionMismatch + current.projectionMismatch,
})

/** Writes one clean receipt or the next verification checkpoint. */
export const persistVerificationAttempt = async (
  ctx: MutationCtx,
  lane: DurableAnimeLane,
  activeState: Doc<'catalogAnimeDataVerificationState'> | null,
  totals: VerificationCounts,
  continueCursor: string,
  isDone: boolean,
): Promise<void> => {
  const now = Date.now()
  const isClean = Object.values(totals).every((value) => value === 0)
  if (isDone && isClean) {
    if (activeState) await ctx.db.delete('catalogAnimeDataVerificationState', activeState._id)
    await ctx.db.insert('catalogAnimeDataVerificationReceipts', { lane, verifiedAt: now })
    return
  }
  const fields = { lane, nextCursor: continueCursor, isDone, ...totals, updatedAt: now }
  if (activeState) await ctx.db.patch('catalogAnimeDataVerificationState', activeState._id, fields)
  else await ctx.db.insert('catalogAnimeDataVerificationState', fields)
}
