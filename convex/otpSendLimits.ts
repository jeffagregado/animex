import { v } from 'convex/values'

import { internalMutation } from './_generated/server'
import {
  claimOtpCooldown,
  finalizeOtpCooldown,
  releaseOtpCooldown,
} from './otpCooldown'

export const claim = internalMutation({
  args: { claimId: v.string(), key: v.string() },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const now = Date.now()
    const existing = await ctx.db
      .query('otpSendLimits')
      .withIndex('by_key', (q) => q.eq('key', args.key))
      .unique()
    const value = claimOtpCooldown(existing, args.claimId, now)
    if (!value) return null
    if (existing) {
      await ctx.db.patch(existing._id, value)
    } else {
      await ctx.db.insert('otpSendLimits', { key: args.key, ...value })
    }
    return args.claimId
  },
})

export const release = internalMutation({
  args: { claimId: v.string(), key: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('otpSendLimits')
      .withIndex('by_key', (q) => q.eq('key', args.key))
      .unique()
    if (existing && releaseOtpCooldown(existing, args.claimId)) {
      await ctx.db.delete(existing._id)
      return true
    }
    return false
  },
})

export const finalize = internalMutation({
  args: { claimId: v.string(), key: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('otpSendLimits')
      .withIndex('by_key', (q) => q.eq('key', args.key))
      .unique()
    if (!existing) return false
    const value = finalizeOtpCooldown(existing, args.claimId, Date.now())
    if (!value) return false
    await ctx.db.patch(existing._id, value)
    return true
  },
})
