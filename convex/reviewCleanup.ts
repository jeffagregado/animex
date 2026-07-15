import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'

import { internalMutation, internalQuery } from './_generated/server'

const targetValidator = v.union(v.literal('reviews'), v.literal('reviewCards'), v.literal('reviewStats'))
const inspectionResultValidator = v.object({
  cursor: v.string(),
  isDone: v.boolean(),
  processedCount: v.number(),
})
const cleanupResultValidator = v.object({
  cursor: v.string(),
  isDone: v.boolean(),
  processedCount: v.number(),
  deletedCount: v.number(),
})

/** Counts one bounded page without returning Review or user data. */
export const inspectReviewDataPage = internalQuery({
  args: { target: targetValidator, paginationOpts: paginationOptsValidator },
  returns: inspectionResultValidator,
  handler: async (ctx, args) => {
    const page = args.target === 'reviews'
      ? await ctx.db.query('reviews').paginate(args.paginationOpts)
      : args.target === 'reviewCards'
        ? await ctx.db.query('feedCards').withIndex('by_kind_source', (q) => q.eq('kind', 'review')).paginate(args.paginationOpts)
        : await ctx.db.query('animeReviewStats').paginate(args.paginationOpts)
    return { cursor: page.continueCursor, isDone: page.isDone, processedCount: page.page.length }
  },
})

/** Deletes one bounded Review page and each linked projection atomically. */
export const cleanupReviewsPage = internalMutation({
  args: { paginationOpts: paginationOptsValidator },
  returns: cleanupResultValidator,
  handler: async (ctx, args) => {
    const page = await ctx.db.query('reviews').paginate(args.paginationOpts)
    for (const review of page.page) {
      const cards = await ctx.db.query('feedCards').withIndex('by_source_key', (q) => q.eq('sourceKey', `review:${review._id}`)).take(2)
      if (cards.length > 1) throw new Error(`Multiple feed cards found for Review ${review._id}.`)
      if (cards[0] && cards[0].kind !== 'review') {
        throw new Error(`Feed card ${cards[0]._id} for Review ${review._id} has kind ${cards[0].kind}; expected review.`)
      }
      if (cards[0]) await ctx.db.delete('feedCards', cards[0]._id)
      await ctx.db.delete('reviews', review._id)
    }
    return { cursor: page.continueCursor, isDone: page.isDone, processedCount: page.page.length, deletedCount: page.page.length }
  },
})

/** Deletes one bounded page of orphaned Review feed cards. */
export const cleanupOrphanReviewCardsPage = internalMutation({
  args: { paginationOpts: paginationOptsValidator },
  returns: cleanupResultValidator,
  handler: async (ctx, args) => {
    const page = await ctx.db.query('feedCards').withIndex('by_kind_source', (q) => q.eq('kind', 'review')).paginate(args.paginationOpts)
    for (const card of page.page) await ctx.db.delete('feedCards', card._id)
    return { cursor: page.continueCursor, isDone: page.isDone, processedCount: page.page.length, deletedCount: page.page.length }
  },
})

/** Deletes one bounded page of obsolete Review aggregates. */
export const cleanupReviewStatsPage = internalMutation({
  args: { paginationOpts: paginationOptsValidator },
  returns: cleanupResultValidator,
  handler: async (ctx, args) => {
    const page = await ctx.db.query('animeReviewStats').paginate(args.paginationOpts)
    for (const stats of page.page) await ctx.db.delete('animeReviewStats', stats._id)
    return { cursor: page.continueCursor, isDone: page.isDone, processedCount: page.page.length, deletedCount: page.page.length }
  },
})
