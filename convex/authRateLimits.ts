import { v } from 'convex/values'

import { internalMutation, internalQuery } from './_generated/server'
import { consumeRateLimit } from './authSecurity'

export const get = internalQuery({
  args: { key: v.string() },
  returns: v.union(
    v.object({ count: v.number(), lastRequest: v.number() }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query('authRateLimits')
      .withIndex('by_key', (q) => q.eq('key', args.key))
      .unique()
    return row
      ? { count: row.count, lastRequest: row.lastRequest }
      : null
  },
})

export const set = internalMutation({
  args: {
    count: v.number(),
    key: v.string(),
    lastRequest: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query('authRateLimits')
      .withIndex('by_key', (q) => q.eq('key', args.key))
      .unique()
    if (row) {
      await ctx.db.patch(row._id, {
        count: args.count,
        lastRequest: args.lastRequest,
      })
      return null
    }
    await ctx.db.insert('authRateLimits', args)
    return null
  },
})

export const consume = internalMutation({
  args: {
    key: v.string(),
    max: v.number(),
    window: v.number(),
  },
  returns: v.object({
    allowed: v.boolean(),
    retryAfter: v.union(v.number(), v.null()),
  }),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query('authRateLimits')
      .withIndex('by_key', (q) => q.eq('key', args.key))
      .unique()
    const decision = consumeRateLimit(
      row ? { count: row.count, lastRequest: row.lastRequest } : null,
      { max: args.max, window: args.window },
      Date.now(),
    )

    if (row) {
      if (decision.allowed) {
        await ctx.db.patch(row._id, decision.next)
      }
    } else {
      await ctx.db.insert('authRateLimits', { key: args.key, ...decision.next })
    }

    return {
      allowed: decision.allowed,
      retryAfter: decision.retryAfter,
    }
  },
})
