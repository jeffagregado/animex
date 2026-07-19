import type { PaginationOptions } from 'convex/server'

import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import { resolveProviderRef } from './catalogIdentityModel'

export type DurableAnimeLane =
  | 'user-anime-entries'
  | 'anime-rewatches'
  | 'anime-milestones'
  | 'reviews'
  | 'feed-cards'
  | 'anime-review-stats'

export type DurableAnimeRow =
  | Doc<'userAnimeEntries'>
  | Doc<'animeRewatchEntries'>
  | Doc<'animeMilestones'>
  | Doc<'reviews'>
  | Doc<'feedCards'>
  | Doc<'animeReviewStats'>

export type DurableAnimePage = {
  continueCursor: string
  isDone: boolean
  rows: DurableAnimeRow[]
}

/** Returns the backing table label for one durable lane. */
const tableName = (lane: DurableAnimeLane): string => {
  if (lane === 'user-anime-entries') return 'userAnimeEntries'
  if (lane === 'anime-rewatches') return 'animeRewatchEntries'
  if (lane === 'anime-milestones') return 'animeMilestones'
  if (lane === 'reviews') return 'reviews'
  if (lane === 'feed-cards') return 'feedCards'
  return 'animeReviewStats'
}

/** Reads exactly one bounded page from one durable Anime table. */
export const paginateDurableAnimeLane = async (
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
export const resolveDurableAnimeId = async (
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

/** Clears receipts invalidated by a Review aggregate identity patch. */
const clearAggregateVerificationMetadata = async (
  ctx: MutationCtx,
  statsId: Id<'animeReviewStats'>,
): Promise<void> => {
  const [checkpoint, aggregateReceipt] = await Promise.all([
    ctx.db.query('catalogAnimeAggregateVerificationState')
      .withIndex('by_stats_id', (q) => q.eq('statsId', statsId))
      .unique(),
    ctx.db.query('catalogAnimeAggregateVerificationReceipts')
      .withIndex('by_stats_id', (q) => q.eq('statsId', statsId))
      .unique(),
  ])
  if (checkpoint) await ctx.db.delete('catalogAnimeAggregateVerificationState', checkpoint._id)
  if (aggregateReceipt) {
    await ctx.db.delete('catalogAnimeAggregateVerificationReceipts', aggregateReceipt._id)
  }
}

/** Patches one absent durable Anime identity after conflict validation. */
const patchAnimeRef = async (
  ctx: MutationCtx,
  lane: DurableAnimeLane,
  row: DurableAnimeRow,
  animeId: Id<'catalogEntities'>,
): Promise<boolean> => {
  if (row.animeId && row.animeId !== animeId) {
    throw new Error(`${tableName(lane)} ${row._id} entity ${row.animeId} conflicts with provider mapping ${animeId}`)
  }
  if (row.animeId) return false
  await ctx.db.patch(row._id, { animeId })
  if (lane === 'anime-review-stats') {
    await clearAggregateVerificationMetadata(ctx, row._id as Id<'animeReviewStats'>)
  }
  return true
}

/** Backfills one already-bounded durable page. */
export const backfillDurableAnimePage = async (
  ctx: MutationCtx,
  lane: DurableAnimeLane,
  rows: DurableAnimeRow[],
): Promise<number> => {
  let patchedCount = 0
  for (const row of rows) {
    const animeId = await resolveDurableAnimeId(ctx, lane, row)
    if (!animeId) continue
    if (await patchAnimeRef(ctx, lane, row, animeId)) patchedCount += 1
  }
  return patchedCount
}

/** Clears a lane receipt after any durable row changed. */
export const clearDurableAnimeLaneReceipt = async (
  ctx: MutationCtx,
  lane: DurableAnimeLane,
): Promise<void> => {
  const receipt = await ctx.db.query('catalogAnimeDataVerificationReceipts')
    .withIndex('by_lane', (q) => q.eq('lane', lane))
    .unique()
  if (receipt) await ctx.db.delete('catalogAnimeDataVerificationReceipts', receipt._id)
}
